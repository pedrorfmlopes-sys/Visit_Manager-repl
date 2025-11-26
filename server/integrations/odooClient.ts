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
 * Autentica com a instância Odoo via JSON-RPC
 */
async function authenticateOdoo(conn: OdooConnection): Promise<OdooAuthResponse> {
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
 * Testa a ligação com Odoo
 */
export async function testOdooConnection(empresaId: string): Promise<{
  ok: boolean;
  baseUrl: string;
  dbName: string;
  userId: number;
}> {
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const auth = await authenticateOdoo(conn);

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
    throw new Error(`[Odoo] HTTP error ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(
      `[Odoo] RPC error: ${data.error.message ?? "Unknown error"}`
    );
  }

  return data.result as T;
}

/**
 * Pesquisa parceiros (res.partner) no Odoo
 */
export async function searchOdooPartners(
  empresaId: string,
  query: string
): Promise<OdooPartner[]> {
  const conn = await getOdooConnectionForEmpresa(empresaId);

  const result = await callOdooJsonRpc<any[]>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        conn.username,
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
