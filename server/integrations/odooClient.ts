import { db } from "../db";
import { odooConnections } from "@shared/schema";
import { eq } from "drizzle-orm";

export type OdooConnection = typeof odooConnections.$inferSelect;

export type OdooAuthResponse = {
  userId: number;
};

export type OdooPartner = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  vat?: string | null;
  city?: string | null;
  country?: string | null;
  street?: string | null;
};

export type CreateOdooLeadInput = {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  description?: string | null;
};

/**
 * Busca a configuração Odoo para uma empresa
 */
export async function getOdooConnectionForEmpresa(empresaId: string): Promise<OdooConnection> {
  const connection = await db
    .select()
    .from(odooConnections)
    .where(eq(odooConnections.empresaId, empresaId))
    .limit(1)
    .then(rows => rows[0]);

  if (!connection) {
    throw new Error("ODOO_NOT_CONFIGURED");
  }

  return connection;
}

/**
 * Autentica com a instância Odoo via web/session/authenticate (usado por testOdooConnection)
 */
async function authenticateOdooWebSession(conn: OdooConnection): Promise<OdooAuthResponse> {
  const url = new URL("/web/session/authenticate", conn.baseUrl).toString();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: {
        db: conn.dbName,
        login: conn.username,
        password: conn.apiKey,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data: any = await response.json();

  if (data.error) {
    throw new Error(`Odoo error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  if (!data.result || !data.result.uid) {
    throw new Error("No user ID returned from Odoo authentication");
  }

  return {
    userId: data.result.uid,
  };
}

/**
 * Autentica com a instância Odoo via JSON-RPC common.authenticate (para execute_kw)
 */
export async function authenticateOdoo(conn: OdooConnection): Promise<number> {
  const uid = await callOdooJsonRpc<number>(conn, {
    method: "call",
    params: {
      service: "common",
      method: "authenticate",
      args: [
        conn.dbName,
        conn.username, // login (email)
        conn.apiKey,   // API key como password
        {},
      ],
    },
  });

  if (typeof uid !== "number") {
    throw new Error(
      `Odoo authenticate did not return a numeric uid (got: ${String(uid)})`
    );
  }

  return uid;
}

/**
 * Testa a ligação com Odoo
 */
export async function testOdooConnection(empresaId: string): Promise<{
  ok: boolean;
  baseUrl: string;
  dbName: string;
  userId: number;
}> {
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const auth = await authenticateOdooWebSession(conn);

  return {
    ok: true,
    baseUrl: conn.baseUrl,
    dbName: conn.dbName,
    userId: auth.userId,
  };
}

/**
 * Helper genérico para chamadas JSON-RPC ao Odoo
 */
async function callOdooJsonRpc<T>(
  conn: OdooConnection,
  payload: any
): Promise<T> {
  try {
    const response = await fetch(`${conn.baseUrl}/jsonrpc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        ...payload,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();

    if (json.error) {
      // LOGAR ERRO COMPLETO
      console.error("[Odoo] JSON-RPC error payload:", json.error);

      const name = json.error?.data?.name ?? json.error?.name ?? "OdooError";
      const message =
        json.error?.data?.message ??
        json.error?.message ??
        "Odoo Server Error";

      // Incluir um excerto de debug (sem ser gigante)
      const debugShort =
        typeof json.error?.data?.debug === "string"
          ? json.error.data.debug.slice(0, 500)
          : undefined;

      const fullMessage = debugShort
        ? `${name}: ${message} | DEBUG: ${debugShort}`
        : `${name}: ${message}`;

      throw new Error(fullMessage);
    }

    return json.result as T;
  } catch (error: any) {
    console.error("[Odoo] callOdooJsonRpc error:", {
      message: error?.message,
      stack: error?.stack,
    });
    throw error;
  }
}

/**
 * Pesquisa parceiros (res.partner) no Odoo
 */
export async function searchOdooPartners(
  empresaId: string,
  query: string
): Promise<OdooPartner[]> {
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const uid = await authenticateOdoo(conn);

  const result = await callOdooJsonRpc<any[]>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        uid,
        conn.apiKey,
        "res.partner",
        "search_read",
        [
          [
            "|",
            ["name", "ilike", query],
            ["email", "ilike", query],
          ],
        ],
        {
          fields: [
            "name",
            "email",
            "phone",
            "mobile",
            "vat",
            "city",
            "country_id",
            "street",
          ],
          limit: 10,
        },
      ],
    },
  });

  return result.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email ?? null,
    phone: p.phone ?? null,
    mobile: p.mobile ?? null,
    vat: p.vat ?? null,
    city: p.city ?? null,
    country: p.country_id?.[1] ?? null,
    street: p.street ?? null,
  }));
}

/**
 * Busca um parceiro específico por ID no Odoo
 */
export async function getOdooPartnerById(
  empresaId: string,
  partnerId: number
): Promise<OdooPartner | null> {
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const uid = await authenticateOdoo(conn);

  const result = await callOdooJsonRpc<any[]>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        uid,
        conn.apiKey,
        "res.partner",
        "search_read",
        [[["id", "=", partnerId]]],
        {
          fields: [
            "name",
            "email",
            "phone",
            "mobile",
            "vat",
            "city",
            "country_id",
            "street",
          ],
          limit: 1,
        },
      ],
    },
  });

  if (!result || result.length === 0) {
    return null;
  }

  const p = result[0];

  return {
    id: p.id,
    name: p.name,
    email: p.email ?? null,
    phone: p.phone ?? null,
    mobile: p.mobile ?? null,
    vat: p.vat ?? null,
    city: p.city ?? null,
    country: p.country_id?.[1] ?? null,
    street: p.street ?? null,
  };
}

/**
 * Cria uma lead (crm.lead) no Odoo
 */
export async function createOdooLead(
  empresaId: string,
  input: CreateOdooLeadInput
): Promise<{ id: number }> {
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const uid = await authenticateOdoo(conn);

  const payload: Record<string, any> = {
    name: input.name,
  };

  if (input.contactName) {
    payload.contact_name = input.contactName;
  }
  if (input.email) {
    payload.email_from = input.email;
  }
  if (input.phone) {
    payload.phone = input.phone;
  }
  if (input.description) {
    payload.description = input.description;
  }

  const result = await callOdooJsonRpc<number>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        uid,
        conn.apiKey,
        "crm.lead",
        "create",
        [payload],
      ],
    },
  });

  return { id: result };
}
