import { db } from "../db";
import { odooConnections, empresas } from "@shared/schema";
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

export type OdooLeadAttachment = {
  id: number;
  name: string;
  mimetype: string | null;
  fileSize: number | null;
  createdAt: string;
  downloadUrl: string;
};

export type CreateOdooLeadInput = {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  description?: string | null;
};

/**
 * Valida se Odoo CRM está ativo para a empresa
 */
export async function assertOdooEnabled(empresaId: string): Promise<void> {
  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.id, empresaId),
    columns: {
      id: true,
      odooCrmEnabled: true,
    },
  });

  if (!empresa?.odooCrmEnabled) {
    const error: any = new Error("ODOO_NOT_ENABLED");
    error.code = "ODOO_NOT_ENABLED";
    throw error;
  }
}

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
    mobile: null,
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
    mobile: null,
    vat: p.vat ?? null,
    city: p.city ?? null,
    country: p.country_id?.[1] ?? null,
    street: p.street ?? null,
  };
}

/**
 * Lista anexos (ir.attachment) de uma lead (crm.lead) no Odoo
 */
export async function listLeadAttachments(params: {
  empresaId: string;
  odooLeadId: string;
}): Promise<OdooLeadAttachment[]> {
  const { empresaId, odooLeadId } = params;
  
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const uid = await authenticateOdoo(conn);
  
  const odooLeadIdInt = parseInt(odooLeadId, 10);
  if (isNaN(odooLeadIdInt)) {
    throw new Error(`Invalid odooLeadId: ${odooLeadId}`);
  }
  
  const result = await callOdooJsonRpc<any[]>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        uid,
        conn.apiKey,
        "ir.attachment",
        "search_read",
        [
          [
            ["res_model", "=", "crm.lead"],
            ["res_id", "=", odooLeadIdInt],
            ["type", "=", "binary"],
          ],
        ],
        {
          fields: ["id", "name", "mimetype", "file_size", "create_date"],
        },
      ],
    },
  });
  
  return result.map((attachment) => ({
    id: attachment.id,
    name: attachment.name,
    mimetype: attachment.mimetype ?? null,
    fileSize: attachment.file_size ?? null,
    createdAt: attachment.create_date,
    downloadUrl: `${conn.baseUrl}/web/content/${attachment.id}?download=1`,
  }));
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

/**
 * Cria uma lead no Odoo a partir de um Lead VM com Entidade e Contacto
 * @param vmLead - Lead da nossa BD (VM)
 * @param entidade - Entidade associada ao lead
 * @param contacto - Contacto associado ao lead
 * @param empresaId - ID da empresa
 * @returns ID do lead criado no Odoo
 */
export async function createLeadFromVmLead(args: {
  vmLead: any;
  entidade: any;
  contacto: any;
  empresaId: string;
}): Promise<number> {
  const { vmLead, entidade, contacto, empresaId } = args;

  // Validar que a entidade tem odooPartnerId
  if (!entidade?.odooPartnerId) {
    throw new Error(
      `Entidade "${entidade?.nome || 'Unknown'}" não tem parceiro Odoo configurado (odooPartnerId ausente). Configure o parceiro Odoo para esta entidade antes de criar leads.`
    );
  }

  try {
    const conn = await getOdooConnectionForEmpresa(empresaId);
    const uid = await authenticateOdoo(conn);

    // Preparar payload para create no Odoo
    const payload: Record<string, any> = {
      name: vmLead.titulo,
      partner_id: entidade.odooPartnerId, // FK para res.partner
    };

    // Adicionar campos opcionais
    if (vmLead.descricao) {
      payload.description = vmLead.descricao;
    }

    if (contacto) {
      if (contacto.nome) {
        payload.contact_name = contacto.nome;
      }
      if (contacto.email) {
        payload.email_from = contacto.email;
      }
      if (contacto.telefone) {
        payload.phone = contacto.telefone;
      }
    }

    if (vmLead.valorPrevisto) {
      payload.expected_revenue = vmLead.valorPrevisto;
    }

    // Fazer call_kw create
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

    console.log(`[Odoo] Lead criado com sucesso. Odoo Lead ID: ${result}`);
    return result;
  } catch (error: any) {
    console.error("[Odoo] Erro ao criar lead:", {
      message: error?.message,
      vmLeadId: vmLead?.id,
      entidadeId: entidade?.id,
      contactoId: contacto?.id,
    });
    throw error;
  }
}

/**
 * Actualiza uma lead no Odoo a partir de um Lead VM com Entidade e Contacto
 * @param odooLeadId - ID da lead no Odoo
 * @param vmLead - Lead da nossa BD (VM)
 * @param entidade - Entidade associada ao lead
 * @param contacto - Contacto associado ao lead
 * @param empresaId - ID da empresa
 */
export async function updateLeadFromVmLead(args: {
  odooLeadId: number;
  vmLead: any;
  entidade: any;
  contacto: any;
  empresaId: string;
}): Promise<void> {
  const { odooLeadId, vmLead, entidade, contacto, empresaId } = args;

  try {
    const conn = await getOdooConnectionForEmpresa(empresaId);
    const uid = await authenticateOdoo(conn);

    // Preparar payload para write no Odoo
    const payload: Record<string, any> = {
      name: vmLead.titulo,
      // Não alterar partner_id (manter o original)
    };

    // Atualizar campos opcionais
    if (vmLead.descricao) {
      payload.description = vmLead.descricao;
    }

    if (contacto) {
      if (contacto.nome) {
        payload.contact_name = contacto.nome;
      }
      if (contacto.email) {
        payload.email_from = contacto.email;
      }
      if (contacto.telefone) {
        payload.phone = contacto.telefone;
      }
    }

    if (vmLead.valorPrevisto !== undefined) {
      payload.expected_revenue = vmLead.valorPrevisto;
    }

    // Fazer call_kw write
    await callOdooJsonRpc<boolean>(conn, {
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [
          conn.dbName,
          uid,
          conn.apiKey,
          "crm.lead",
          "write",
          [[odooLeadId], payload],
        ],
      },
    });

    console.log(`[Odoo] Lead ${odooLeadId} actualizado com sucesso`);
  } catch (error: any) {
    console.error("[Odoo] Erro ao actualizar lead:", {
      message: error?.message,
      odooLeadId,
      vmLeadId: vmLead?.id,
    });
    throw error;
  }
}
