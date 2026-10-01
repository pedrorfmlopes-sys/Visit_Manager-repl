import { db } from "../db";
import { odooConnections, empresas } from "@shared/schema";
import { eq } from "drizzle-orm";
import { assertEmpresaModuleEnabled } from "../modules";
import { odooConnectionsStorage } from "../storage/odooConnections";

export type OdooConnection = typeof odooConnections.$inferSelect;

export type OdooAuthResponse = {
  userId: number;
};

export type OdooPartner = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  vat?: string | null;
  city?: string | null;
  country?: string | null;
  street?: string | null;
  zip?: string | null;
  website?: string | null;
  isCompany?: boolean | null;
  parentId?: number | null;
};

export type UpsertOdooPartnerInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  vat?: string | null;
  city?: string | null;
  street?: string | null;
  zip?: string | null;
  website?: string | null;
  isCompany?: boolean;
  parentId?: number | null;
  comment?: string | null;
};

export type OdooLeadAttachment = {
  id: number;
  name: string;
  mimetype: string | null;
  fileSize: number | null;
  createdAt: string;
  downloadUrl: string;
};

export type OdooLeadRecord = {
  id: number;
  name: string;
  description: string | null;
  descriptionHtml: string | null;
  expectedRevenue: string | null;
  writeDate: string | null;
  tipoLead: string | null;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  partnerId: number | null;
  salespersonUserId: number | null;
  salespersonName: string | null;
  salespersonPartnerId: number | null;
  followerPartnerIds: number[];
};

export type OdooTaskRecord = {
  id: number;
  name: string;
  description: string | null;
  descriptionHtml: string | null;
  writeDate: string | null;
  dueDate: string | null;
};

type OdooLeadFieldConfig = {
  fieldName: string | null;
  verified: boolean;
  type: string | null;
  selectionOptions: Array<{ value: string; label: string }>;
};

export type CreateOdooLeadInput = {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  description?: string | null;
};

export type AppLeadSyncMetadata = {
  appRecordId?: string | null;
  appRecordRef?: string | null;
  appLeadRef?: string | null;
  appOrigin?: "app" | "odoo" | null;
  createdByUserId?: string | null;
  createdByUserName?: string | null;
  createdByUserEmail?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  lastSyncAt?: Date | string | null;
  syncStatus?: "never" | "pending" | "synced" | "error" | null;
  lastSyncDirection?: "app_to_odoo" | "odoo_to_app" | "bidirectional" | null;
  internalNotes?: string | null;
  visitContext?: string | null;
};

export type AppTaskSyncMetadata = {
  appRecordId?: string | null;
  appRecordRef?: string | null;
  appTaskRef?: string | null;
  appOrigin?: "app" | "odoo" | null;
  createdByUserId?: string | null;
  createdByUserName?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  lastSyncAt?: Date | string | null;
  internalNotes?: string | null;
};

/**
 * Valida se Odoo CRM está ativo para a empresa
 */
export async function assertOdooEnabled(empresaId: string): Promise<void> {
  await assertEmpresaModuleEnabled(empresaId, "odoo");
}

/**
 * Busca a configuração Odoo para uma empresa
 */
export async function getOdooConnectionForEmpresa(empresaId: string): Promise<OdooConnection> {
  const connection =
    await odooConnectionsStorage.getOdooConnectionByEmpresaId(empresaId);

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

  if (typeof uid === "number" && Number.isFinite(uid) && uid > 0) {
    return uid;
  }

  // Alguns tenants Odoo devolvem false no common.authenticate mas aceitam
  // a mesma credencial no endpoint web/session/authenticate.
  const fallbackAuth = await authenticateOdooWebSession(conn);
  if (
    typeof fallbackAuth.userId === "number" &&
    Number.isFinite(fallbackAuth.userId) &&
    fallbackAuth.userId > 0
  ) {
    return fallbackAuth.userId;
  }

  throw new Error(
    `Odoo authenticate did not return a numeric uid (got: ${String(uid)})`
  );
}

function mapOdooPartnerRecord(p: any): OdooPartner {
  const normalize = (value: any) =>
    value === false || value === undefined || value === "" || value === "false"
      ? null
      : value;
  return {
    id: p.id,
    name: p.name,
    email: normalize(p.email),
    phone: normalize(p.phone),
    vat: normalize(p.vat),
    city: normalize(p.city),
    country: p.country_id?.[1] ?? null,
    street: normalize(p.street),
    zip: normalize(p.zip),
    website: normalize(p.website),
    isCompany: normalize(p.is_company),
    parentId: Array.isArray(p.parent_id) ? p.parent_id[0] : normalize(p.parent_id),
  };
}

function normalizeOdooValue(value: any) {
  return value === false || value === undefined || value === "" || value === "false"
    ? null
    : value;
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function htmlToPlainText(value: any): string | null {
  const normalized = normalizeOdooValue(value);
  if (normalized === null) return null;

  const text = String(normalized)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<\/div>\s*<div[^>]*>/gi, "\n")
    .replace(/<\/li>\s*<li[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .trim();

  return decodeHtmlEntities(text) || null;
}

function normalizeWhitespaceInsideHtml(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function odooChecklistToEditorHtml(html: string) {
  return html.replace(
    /<ul([^>]*class="[^"]*\bo_checklist\b[^"]*"[^>]*)>([\s\S]*?)<\/ul>/gi,
    (_match, _attrs, inner) => {
      const items = inner.replace(
        /<li([^>]*)>([\s\S]*?)<\/li>/gi,
        (_liMatch: string, liAttrs: string, liInner: string) => {
          const checked = /\bo_checked\b/i.test(liAttrs);
          const content = normalizeWhitespaceInsideHtml(liInner) || "<p></p>";
          return `<li data-type="taskItem" data-checked="${checked ? "true" : "false"}"><label><input type="checkbox"${checked ? ' checked="checked"' : ""}><span></span></label><div>${content}</div></li>`;
        },
      );

      return `<ul data-type="taskList">${items}</ul>`;
    },
  );
}

function editorChecklistToOdooHtml(html: string) {
  const withTaskLists = html.replace(
    /<ul[^>]*data-type="taskList"[^>]*>([\s\S]*?)<\/ul>/gi,
    (_match, inner) => {
      const items = inner.replace(
        /<li(?=[^>]*data-type="taskItem")(?=[^>]*data-checked="(true|false)")[^>]*>[\s\S]*?<label[\s\S]*?<\/label>\s*<div>([\s\S]*?)<\/div>\s*<\/li>/gi,
        (_liMatch: string, checked: string, content: string) => {
          const liClass = checked === "true" ? ' class="o_checked"' : "";
          const normalizedContent = normalizeWhitespaceInsideHtml(content) || "<p></p>";
          return `<li${liClass}>${normalizedContent}</li>`;
        },
      );

      return `<ul class="o_checklist">${items}</ul>`;
    },
  );

  return withTaskLists
    .replace(/<label>\s*<input[^>]*>\s*<span><\/span>\s*<\/label>/gi, "")
    .replace(/\sdata-checked="(?:true|false)"/gi, "")
    .replace(/\sdata-type="(?:taskList|taskItem)"/gi, "");
}

function normalizeOdooHtmlForEditor(value: any): string | null {
  const normalized = normalizeOdooValue(value);
  if (normalized === null) return null;

  const html = String(normalized).trim();
  if (!html) return null;

  return odooChecklistToEditorHtml(html);
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainTextToOdooHtml(value: any): string | null {
  const normalized = normalizeOdooValue(value);
  if (normalized === null) return null;

  const text = String(normalized).trim();
  if (!text) return null;

  if (/<[a-z][\s\S]*>/i.test(text)) {
    return editorChecklistToOdooHtml(text);
  }

  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

async function getEmpresaUiSettings(empresaId: string): Promise<Record<string, any>> {
  const empresa = await db
    .select({ uiSettings: empresas.uiSettings })
    .from(empresas)
    .where(eq(empresas.id, empresaId))
    .limit(1)
    .then((rows) => rows[0]);

  return (empresa?.uiSettings ?? {}) as Record<string, any>;
}

async function getOdooLeadFieldConfig(empresaId: string): Promise<OdooLeadFieldConfig> {
  const uiSettings = await getEmpresaUiSettings(empresaId);
  const odooSettings = (uiSettings.odoo ?? {}) as Record<string, any>;
  const rawFieldName =
    typeof odooSettings.leadTypeFieldName === "string"
      ? odooSettings.leadTypeFieldName.trim()
      : "";

  if (!rawFieldName || odooSettings.leadTypeFieldVerified !== true) {
    return { fieldName: null, verified: false, type: null, selectionOptions: [] };
  }

  const selectionOptions = Array.isArray(odooSettings.leadTypeFieldOptions)
    ? odooSettings.leadTypeFieldOptions
        .map((option) => {
          const value =
            typeof option?.value === "string" ? option.value.trim() : "";
          const label =
            typeof option?.label === "string" ? option.label.trim() : "";

          if (!value || !label) return null;
          return { value, label };
        })
        .filter((option): option is { value: string; label: string } => Boolean(option))
    : [];

  return {
    fieldName: rawFieldName,
    verified: true,
    type:
      typeof odooSettings.leadTypeFieldType === "string"
        ? odooSettings.leadTypeFieldType
        : null,
    selectionOptions,
  };
}

function normalizeLeadTypeFromOdooValue(
  value: any,
  fieldConfig?: OdooLeadFieldConfig
): string | null {
  const normalized = normalizeOdooValue(value);
  if (normalized === null) return null;

  const rawValue = String(normalized);
  if (fieldConfig?.type === "selection" && fieldConfig.selectionOptions.length > 0) {
    const matchedOption = fieldConfig.selectionOptions.find(
      (option) => option.value === rawValue || option.label === rawValue
    );
    return matchedOption?.label ?? rawValue;
  }

  return rawValue;
}

function mapLeadTypeForOdooWrite(
  value: unknown,
  fieldConfig?: OdooLeadFieldConfig
): string | false {
  const normalized = normalizeOdooValue(value);
  if (normalized === null) return false;

  const rawValue = String(normalized).trim();
  if (!rawValue) return false;

  if (fieldConfig?.type === "selection" && fieldConfig.selectionOptions.length > 0) {
    const normalizedValue = rawValue.toLowerCase();
    const matchedOption = fieldConfig.selectionOptions.find((option) => {
      return (
        option.value === rawValue ||
        option.label === rawValue ||
        option.value.toLowerCase() === normalizedValue ||
        option.label.toLowerCase() === normalizedValue
      );
    });

    if (!matchedOption) {
      const allowedOptions = fieldConfig.selectionOptions
        .map((option) => option.label)
        .join(", ");
      throw new Error(
        `O valor "${rawValue}" não existe no campo Odoo ${fieldConfig.fieldName}. Opções válidas: ${allowedOptions}.`
      );
    }

    return matchedOption.value;
  }

  return rawValue;
}

function mapOdooLeadRecord(lead: any, fieldConfig?: OdooLeadFieldConfig): OdooLeadRecord {
  const expectedRevenueValue = normalizeOdooValue(lead.expected_revenue);
  const descriptionHtml = normalizeOdooHtmlForEditor(lead.description);
  const tipoLeadValue =
    fieldConfig?.fieldName && fieldConfig.fieldName in lead
      ? normalizeLeadTypeFromOdooValue(lead[fieldConfig.fieldName], fieldConfig)
      : null;

  return {
    id: lead.id,
    name: lead.name,
    description: htmlToPlainText(descriptionHtml),
    descriptionHtml,
    expectedRevenue:
      expectedRevenueValue === null ? null : String(expectedRevenueValue),
    writeDate: normalizeOdooValue(lead.write_date),
    tipoLead: tipoLeadValue,
    email: normalizeOdooValue(lead.email_from),
    phone: normalizeOdooValue(lead.phone),
    contactName: normalizeOdooValue(lead.contact_name),
    partnerId: Array.isArray(lead.partner_id)
      ? lead.partner_id[0]
      : normalizeOdooValue(lead.partner_id),
    salespersonUserId: Array.isArray(lead.user_id)
      ? Number(lead.user_id[0]) || null
      : null,
    salespersonName: Array.isArray(lead.user_id)
      ? String(lead.user_id[1] || "") || null
      : null,
    salespersonPartnerId: null,
    followerPartnerIds: Array.isArray(lead.message_partner_ids)
      ? lead.message_partner_ids
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isFinite(value) && value > 0)
      : [],
  };
}

function mapOdooTaskRecord(task: any): OdooTaskRecord {
  const descriptionHtml = normalizeOdooHtmlForEditor(task.description);
  return {
    id: task.id,
    name: task.name,
    description: htmlToPlainText(descriptionHtml),
    descriptionHtml,
    writeDate: normalizeOdooValue(task.write_date),
    dueDate: normalizeOdooValue(task.date_deadline),
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

async function findOdooUserIdByPartnerId(
  conn: OdooConnection,
  uid: number,
  partnerId: unknown,
): Promise<number | null> {
  const normalizedPartnerId = Number(partnerId);
  if (!Number.isFinite(normalizedPartnerId) || normalizedPartnerId <= 0) {
    return null;
  }
  try {
    const users = await callOdooJsonRpc<any[]>(conn, {
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [
          conn.dbName,
          uid,
          conn.apiKey,
          "res.users",
          "search_read",
          [[
            ["partner_id", "=", normalizedPartnerId],
            ["active", "=", true],
          ]],
          { fields: ["id"], limit: 1 },
        ],
      },
    });
    return Number(users[0]?.id) || null;
  } catch (error: any) {
    console.warn("[Odoo] Não foi possível mapear contacto para vendedor", {
      partnerId: normalizedPartnerId,
      error: error?.message,
    });
    return null;
  }
}

function extractRejectedOdooField(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const wrongValueMatch = message.match(/Wrong value for .*?\.(x_[a-zA-Z0-9_]+):/);
  if (wrongValueMatch?.[1]) return wrongValueMatch[1];

  const invalidFieldMatch = message.match(/Invalid field '(x_[a-zA-Z0-9_]+)'/);
  if (invalidFieldMatch?.[1]) return invalidFieldMatch[1];

  return null;
}

export async function verifyOdooModelField(args: {
  empresaId: string;
  model: string;
  fieldName: string;
}): Promise<{
  exists: boolean;
  fieldName: string;
  type: string | null;
  label: string | null;
  selectionOptions: Array<{ value: string; label: string }>;
}> {
  const { empresaId, model, fieldName } = args;
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const uid = await authenticateOdoo(conn);

  const result = await callOdooJsonRpc<Record<string, any>>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        uid,
        conn.apiKey,
        model,
        "fields_get",
        [[fieldName]],
        {
          attributes: ["string", "type", "selection"],
        },
      ],
    },
  });

  const field = result?.[fieldName];
  return {
    exists: Boolean(field),
    fieldName,
    type: field?.type ?? null,
    label: field?.string ?? null,
    selectionOptions: Array.isArray(field?.selection)
      ? field.selection
          .map((option: any) => {
            const value = Array.isArray(option) ? option[0] : null;
            const label = Array.isArray(option) ? option[1] : null;
            if (typeof value !== "string" || typeof label !== "string") return null;
            return { value, label };
          })
          .filter(
            (option: { value: string; label: string } | null): option is {
              value: string;
              label: string;
            } => Boolean(option)
          )
      : [],
  };
}

async function executeLeadWriteWithFallback<T>(args: {
  conn: OdooConnection;
  requestFactory: (payload: Record<string, any>) => any;
  payload: Record<string, any>;
  operationLabel: string;
  protectedFields?: string[];
}): Promise<T> {
  const { conn, requestFactory, operationLabel } = args;
  const payload = { ...args.payload };
  const removedFields = new Set<string>();
  const protectedFields = new Set(args.protectedFields ?? []);

  while (true) {
    try {
      return await callOdooJsonRpc<T>(conn, requestFactory(payload));
    } catch (error) {
      const rejectedField = extractRejectedOdooField(error);
      if (rejectedField && protectedFields.has(rejectedField)) {
        throw error;
      }
      if (!rejectedField || !(rejectedField in payload) || removedFields.has(rejectedField)) {
        throw error;
      }

      delete payload[rejectedField];
      removedFields.add(rejectedField);
      console.warn(
        `[Odoo] ${operationLabel}: campo custom rejeitado pelo Odoo, a repetir sem ${rejectedField}`
      );
    }
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
  const normalizedQuery = query.trim();
  const domain = normalizedQuery
    ? [
        "|",
        ["name", "ilike", normalizedQuery],
        ["email", "ilike", normalizedQuery],
      ]
    : [];

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
        [domain],
        {
          fields: [
            "name",
            "email",
            "phone",
            "vat",
            "city",
            "country_id",
            "street",
            "zip",
            "website",
            "is_company",
            "parent_id",
          ],
          limit: 20,
          order: "name asc, id asc",
        },
      ],
    },
  });

  return result.map(mapOdooPartnerRecord);
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
            "zip",
            "website",
            "is_company",
            "parent_id",
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

  return mapOdooPartnerRecord(p);
}

export async function createOdooPartner(
  empresaId: string,
  input: UpsertOdooPartnerInput
): Promise<{ id: number; partner: OdooPartner | null }> {
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const uid = await authenticateOdoo(conn);

  const payload: Record<string, any> = {
    name: input.name,
    is_company: input.isCompany ?? false,
  };

  if (input.email) payload.email = input.email;
  if (input.phone) payload.phone = input.phone;
  if (input.vat) payload.vat = input.vat;
  if (input.city) payload.city = input.city;
  if (input.street) payload.street = input.street;
  if (input.zip) payload.zip = input.zip;
  if (input.website) payload.website = input.website;
  if (typeof input.parentId === "number") payload.parent_id = input.parentId;
  if (input.comment) payload.comment = input.comment;

  const result = await callOdooJsonRpc<number>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        uid,
        conn.apiKey,
        "res.partner",
        "create",
        [payload],
      ],
    },
  });

  const partner = await getOdooPartnerById(empresaId, result);
  return { id: result, partner };
}

export async function updateOdooPartner(
  empresaId: string,
  partnerId: number,
  input: UpsertOdooPartnerInput
): Promise<{ id: number; partner: OdooPartner | null }> {
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const uid = await authenticateOdoo(conn);

  const payload: Record<string, any> = {
    name: input.name,
    is_company: input.isCompany ?? false,
    email: input.email ?? false,
    phone: input.phone ?? false,
    vat: input.vat ?? false,
    city: input.city ?? false,
    street: input.street ?? false,
    zip: input.zip ?? false,
    website: input.website ?? false,
    comment: input.comment ?? false,
    parent_id: typeof input.parentId === "number" ? input.parentId : false,
  };

  await callOdooJsonRpc<boolean>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        uid,
        conn.apiKey,
        "res.partner",
        "write",
        [[partnerId], payload],
      ],
    },
  });

  const partner = await getOdooPartnerById(empresaId, partnerId);
  return { id: partnerId, partner };
}

export async function deleteOdooPartnerById(
  empresaId: string,
  partnerId: number,
): Promise<void> {
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const uid = await authenticateOdoo(conn);
  await callOdooJsonRpc<boolean>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        uid,
        conn.apiKey,
        "res.partner",
        "unlink",
        [[partnerId]],
      ],
    },
  });
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

export async function downloadLeadAttachment(params: {
  empresaId: string;
  odooLeadId: string;
  attachmentId: number;
}) {
  const conn = await getOdooConnectionForEmpresa(params.empresaId);
  const uid = await authenticateOdoo(conn);
  const leadId = Number(params.odooLeadId);
  if (!Number.isFinite(leadId) || leadId <= 0) {
    throw new Error("Invalid Odoo lead ID");
  }

  const records = await callOdooJsonRpc<any[]>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        uid,
        conn.apiKey,
        "ir.attachment",
        "read",
        [[params.attachmentId]],
        { fields: ["id", "name", "mimetype", "datas", "res_model", "res_id"] },
      ],
    },
  });
  const attachment = records[0];
  if (
    !attachment ||
    attachment.res_model !== "crm.lead" ||
    Number(attachment.res_id) !== leadId ||
    typeof attachment.datas !== "string"
  ) {
    return null;
  }
  return {
    name: String(attachment.name || `anexo-${params.attachmentId}`),
    mimetype: String(attachment.mimetype || "application/octet-stream"),
    buffer: Buffer.from(attachment.datas, "base64"),
  };
}

export async function listLeadChatter(params: {
  empresaId: string;
  odooLeadId: string;
  limit?: number;
}) {
  const conn = await getOdooConnectionForEmpresa(params.empresaId);
  const uid = await authenticateOdoo(conn);
  const leadId = Number(params.odooLeadId);
  if (!Number.isFinite(leadId) || leadId <= 0) {
    throw new Error("Invalid Odoo lead ID");
  }

  const messages = await callOdooJsonRpc<any[]>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        uid,
        conn.apiKey,
        "mail.message",
        "search_read",
        [
          [
            ["model", "=", "crm.lead"],
            ["res_id", "=", leadId],
            ["message_type", "in", ["comment", "email"]],
          ],
        ],
        {
          fields: ["id", "date", "body", "author_id", "message_type"],
          order: "date desc, id desc",
          limit: Math.min(Math.max(params.limit ?? 30, 1), 100),
        },
      ],
    },
  });

  return messages.map((message) => ({
    id: Number(message.id),
    date: message.date ? String(message.date) : null,
    bodyHtml: typeof message.body === "string" ? message.body : "",
    authorName: Array.isArray(message.author_id)
      ? String(message.author_id[1] || "")
      : null,
    messageType: String(message.message_type || "comment"),
  }));
}

export async function listOdooLeadChatterRecipients(params: {
  empresaId: string;
  odooLeadId: string;
}) {
  const leadId = Number(params.odooLeadId);
  if (!Number.isFinite(leadId) || leadId <= 0) {
    throw new Error("Invalid Odoo lead ID");
  }

  const lead = await getOdooLeadById(params.empresaId, leadId);
  const partnerIds = lead?.followerPartnerIds ?? [];
  if (partnerIds.length === 0) return [];

  const conn = await getOdooConnectionForEmpresa(params.empresaId);
  const uid = await authenticateOdoo(conn);
  const partners = await callOdooJsonRpc<any[]>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        uid,
        conn.apiKey,
        "res.partner",
        "read",
        [partnerIds],
        { fields: ["id", "name", "email", "active"] },
      ],
    },
  });

  return partners
    .filter((partner) => partner.active !== false)
    .map((partner) => ({
      id: Number(partner.id),
      name: String(partner.name || "Seguidor Odoo"),
      email:
        typeof partner.email === "string" && partner.email.trim()
          ? partner.email.trim()
          : null,
    }));
}

export async function postOdooLeadChatterMessage(params: {
  empresaId: string;
  odooLeadId: string;
  body: string;
  authorLabel: string;
}) {
  const leadId = Number(params.odooLeadId);
  if (!Number.isFinite(leadId) || leadId <= 0) {
    throw new Error("Invalid Odoo lead ID");
  }

  const messageHtml = plainTextToOdooHtml(params.body);
  if (!messageHtml) throw new Error("A mensagem não pode estar vazia.");
  const signature = `<p><small>Publicado pela Visit Manager por ${escapeHtml(params.authorLabel)}.</small></p>`;
  const conn = await getOdooConnectionForEmpresa(params.empresaId);
  const uid = await authenticateOdoo(conn);

  return callOdooJsonRpc<number>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        uid,
        conn.apiKey,
        "crm.lead",
        "message_post",
        [[leadId]],
        {
          body: `${messageHtml}${signature}`,
          message_type: "comment",
          subtype_xmlid: "mail.mt_comment",
        },
      ],
    },
  });
}

/**
 * Cria um anexo (ir.attachment) para uma lead (crm.lead) no Odoo
 */
export async function createLeadAttachment(params: {
  empresaId: string;
  odooLeadId: string | number;
  fileName: string;
  mimetype: string | null;
  buffer: Buffer;
}): Promise<number> {
  const { empresaId, odooLeadId, fileName, mimetype, buffer } = params;
  
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const uid = await authenticateOdoo(conn);
  
  // Validar e converter odooLeadId para inteiro
  const leadIdInt = typeof odooLeadId === "string" ? parseInt(odooLeadId, 10) : odooLeadId;
  if (isNaN(leadIdInt) || leadIdInt <= 0) {
    throw new Error("Invalid odooLeadId for attachment upload");
  }
  
  // Converter buffer para base64
  const datas = buffer.toString("base64");
  
  // Preparar payload para ir.attachment.create
  const payload: Record<string, any> = {
    name: fileName,
    res_model: "crm.lead",
    res_id: leadIdInt,
    type: "binary",
    datas: datas,
  };
  
  // Adicionar mimetype apenas se existir (não enviar null)
  if (mimetype) {
    payload.mimetype = mimetype;
  }
  
  console.log(`[Odoo] Creating attachment for lead ${leadIdInt}: ${fileName}`);
  
  try {
    const result = await callOdooJsonRpc<number>(conn, {
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [
          conn.dbName,
          uid,
          conn.apiKey,
          "ir.attachment",
          "create",
          [payload],
        ],
      },
    });
    
    console.log(`[Odoo] Attachment created successfully. ID: ${result}`);
    return result;
  } catch (error: any) {
    console.error("[Odoo] Error creating attachment:", {
      message: error?.message,
      leadId: leadIdInt,
      fileName,
    });
    throw error;
  }
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

export async function getOdooLeadById(
  empresaId: string,
  odooLeadId: number
): Promise<OdooLeadRecord | null> {
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const uid = await authenticateOdoo(conn);
  const leadFieldConfig = await getOdooLeadFieldConfig(empresaId);
  const fields = [
    "name",
    "description",
    "expected_revenue",
    "write_date",
    "email_from",
    "phone",
    "contact_name",
    "partner_id",
    "user_id",
    "message_partner_ids",
  ];

  if (leadFieldConfig.fieldName) {
    fields.push(leadFieldConfig.fieldName);
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
        "crm.lead",
        "search_read",
        [[["id", "=", odooLeadId]]],
        {
          fields,
          limit: 1,
        },
      ],
    },
  });

  if (!result || result.length === 0) {
    return null;
  }

  const mappedLead = mapOdooLeadRecord(result[0], leadFieldConfig);
  if (!mappedLead.salespersonUserId) return mappedLead;

  try {
    const salespeople = await callOdooJsonRpc<any[]>(conn, {
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [
          conn.dbName,
          uid,
          conn.apiKey,
          "res.users",
          "read",
          [[mappedLead.salespersonUserId]],
          { fields: ["partner_id"] },
        ],
      },
    });
    const salespersonPartner = salespeople[0]?.partner_id;
    return {
      ...mappedLead,
      salespersonPartnerId: Array.isArray(salespersonPartner)
        ? Number(salespersonPartner[0]) || null
        : null,
    };
  } catch (error: any) {
    console.warn("[Odoo] Lead lido sem parceiro do vendedor", {
      leadId: odooLeadId,
      error: error?.message,
    });
    return mappedLead;
  }
}

export async function searchOdooLeads(args: {
  empresaId: string;
  query?: string;
  followerPartnerId?: number | null;
  limit?: number;
}): Promise<OdooLeadRecord[]> {
  const conn = await getOdooConnectionForEmpresa(args.empresaId);
  const uid = await authenticateOdoo(conn);
  const leadFieldConfig = await getOdooLeadFieldConfig(args.empresaId);
  const query = args.query?.trim() ?? "";
  const domain: any[] = [];

  if (args.followerPartnerId) {
    domain.push([
      "message_partner_ids",
      "in",
      [args.followerPartnerId],
    ]);
  }
  if (query) {
    domain.push(
      "|",
      ["name", "ilike", query],
      ["contact_name", "ilike", query],
    );
  }

  const fields = [
    "name",
    "description",
    "expected_revenue",
    "write_date",
    "email_from",
    "phone",
    "contact_name",
    "partner_id",
    "user_id",
    "message_partner_ids",
  ];
  if (leadFieldConfig.fieldName) fields.push(leadFieldConfig.fieldName);

  const result = await callOdooJsonRpc<any[]>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        uid,
        conn.apiKey,
        "crm.lead",
        "search_read",
        [domain],
        {
          fields,
          limit: Math.min(Math.max(args.limit ?? 50, 1), 100),
          order: "write_date desc, id desc",
        },
      ],
    },
  });

  return result.map((record) => mapOdooLeadRecord(record, leadFieldConfig));
}

export async function subscribeOdooLeadFollowers(args: {
  empresaId: string;
  odooLeadId: number;
  partnerIds: number[];
}) {
  const partnerIds = Array.from(
    new Set(args.partnerIds.filter((id) => Number.isFinite(id) && id > 0)),
  );
  if (partnerIds.length === 0) return;

  const conn = await getOdooConnectionForEmpresa(args.empresaId);
  const uid = await authenticateOdoo(conn);
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
        "message_subscribe",
        [[args.odooLeadId]],
        { partner_ids: partnerIds },
      ],
    },
  });
}

export async function postOdooLeadAuditNote(args: {
  empresaId: string;
  odooLeadId: number;
  body: string;
}) {
  const conn = await getOdooConnectionForEmpresa(args.empresaId);
  const uid = await authenticateOdoo(conn);
  await callOdooJsonRpc<number>(conn, {
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        conn.dbName,
        uid,
        conn.apiKey,
        "crm.lead",
        "message_post",
        [[args.odooLeadId]],
        {
          body: args.body,
          message_type: "comment",
          subtype_xmlid: "mail.mt_note",
        },
      ],
    },
  });
}

export async function deleteOdooLeadById(
  empresaId: string,
  odooLeadId: number,
): Promise<void> {
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const uid = await authenticateOdoo(conn);
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
        "unlink",
        [[odooLeadId]],
      ],
    },
  });
}

export async function updateOdooLeadTitle(
  empresaId: string,
  odooLeadId: number,
  title: string,
): Promise<void> {
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const uid = await authenticateOdoo(conn);
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
        [[odooLeadId], { name: title }],
      ],
    },
  });
}

export async function updateOdooLeadType(
  empresaId: string,
  odooLeadId: number,
  value: string | null,
): Promise<void> {
  const fieldConfig = await getOdooLeadFieldConfig(empresaId);
  if (!fieldConfig.fieldName) {
    throw new Error("Odoo lead type field is not configured");
  }

  const conn = await getOdooConnectionForEmpresa(empresaId);
  const uid = await authenticateOdoo(conn);
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
        [
          [odooLeadId],
          {
            [fieldConfig.fieldName]: mapLeadTypeForOdooWrite(
              value,
              fieldConfig,
            ),
          },
        ],
      ],
    },
  });
}

export async function getOdooTaskById(
  empresaId: string,
  odooTaskId: number
): Promise<OdooTaskRecord | null> {
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
        "project.task",
        "search_read",
        [[["id", "=", odooTaskId]]],
        {
          fields: ["name", "description", "write_date", "date_deadline"],
          limit: 1,
        },
      ],
    },
  });

  if (!result || result.length === 0) {
    return null;
  }

  return mapOdooTaskRecord(result[0]);
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
  appSync?: AppLeadSyncMetadata;
}): Promise<number> {
  const { vmLead, entidade, contacto, empresaId, appSync } = args;

  // Validar que a entidade tem odooPartnerId
  if (!entidade?.odooPartnerId) {
    throw new Error(
      `Entidade "${entidade?.nome || 'Unknown'}" não tem parceiro Odoo configurado (odooPartnerId ausente). Configure o parceiro Odoo para esta entidade antes de criar leads.`
    );
  }

  try {
    const conn = await getOdooConnectionForEmpresa(empresaId);
    const uid = await authenticateOdoo(conn);
    const leadFieldConfig = await getOdooLeadFieldConfig(empresaId);

    // Preparar payload para create no Odoo
    const payload: Record<string, any> = {
      name: vmLead.titulo,
      partner_id: entidade.odooPartnerId, // FK para res.partner
    };

    // Adicionar campos opcionais
    const normalizedDescription = plainTextToOdooHtml(
      vmLead.descricaoHtml ?? vmLead.descricao
    );
    if (normalizedDescription) {
      payload.description = normalizedDescription;
    }

    if (contacto) {
      const salespersonUserId = await findOdooUserIdByPartnerId(
        conn,
        uid,
        contacto.odooPartnerId,
      );
      if (salespersonUserId) {
        payload.user_id = salespersonUserId;
      } else {
        if (contacto.nome) payload.contact_name = contacto.nome;
        if (contacto.email) payload.email_from = contacto.email;
        if (contacto.telefone) payload.phone = contacto.telefone;
      }
    }

    if (vmLead.valorPrevisto) {
      payload.expected_revenue = vmLead.valorPrevisto;
    }
    if (leadFieldConfig.fieldName) {
      payload[leadFieldConfig.fieldName] = mapLeadTypeForOdooWrite(
        vmLead.tipoLead,
        leadFieldConfig
      );
    }

    applyAppLeadSyncMetadata(payload, appSync);

    // Fazer call_kw create; se um campo custom do Studio falhar, removemo-lo e repetimos
    const result = await executeLeadWriteWithFallback<number>({
      conn,
      payload,
      operationLabel: "create crm.lead",
      protectedFields: leadFieldConfig.fieldName ? [leadFieldConfig.fieldName] : [],
      requestFactory: (currentPayload) => ({
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
            [currentPayload],
          ],
        },
      }),
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
  appSync?: AppLeadSyncMetadata;
}): Promise<void> {
  const { odooLeadId, vmLead, entidade, contacto, empresaId, appSync } = args;

  try {
    const conn = await getOdooConnectionForEmpresa(empresaId);
    const uid = await authenticateOdoo(conn);
    const leadFieldConfig = await getOdooLeadFieldConfig(empresaId);

    // Preparar payload para write no Odoo
    const payload: Record<string, any> = {
      name: vmLead.titulo,
    };

    if (entidade?.odooPartnerId) {
      payload.partner_id = Number(entidade.odooPartnerId);
    }

    // Atualizar campos opcionais
    const normalizedDescription = plainTextToOdooHtml(
      vmLead.descricaoHtml ?? vmLead.descricao
    );
    if (normalizedDescription) {
      payload.description = normalizedDescription;
    } else if (vmLead.descricao === null || vmLead.descricao === "") {
      payload.description = false;
    }

    if (contacto) {
      const salespersonUserId = await findOdooUserIdByPartnerId(
        conn,
        uid,
        contacto.odooPartnerId,
      );
      if (salespersonUserId) {
        payload.user_id = salespersonUserId;
      } else {
        if (contacto.nome) payload.contact_name = contacto.nome;
        if (contacto.email) payload.email_from = contacto.email;
        if (contacto.telefone) payload.phone = contacto.telefone;
      }
    }

    if (vmLead.valorPrevisto !== undefined) {
      payload.expected_revenue = vmLead.valorPrevisto;
    }
    if (leadFieldConfig.fieldName) {
      payload[leadFieldConfig.fieldName] = mapLeadTypeForOdooWrite(
        vmLead.tipoLead,
        leadFieldConfig
      );
    }

    applyAppLeadSyncMetadata(payload, appSync);
    console.log("[Odoo] updateLeadFromVmLead payload", {
      odooLeadId,
      vmLeadId: vmLead?.id,
      payload,
    });

    // Fazer call_kw write; se um campo custom do Studio falhar, removemo-lo e repetimos
    await executeLeadWriteWithFallback<boolean>({
      conn,
      payload,
      operationLabel: "write crm.lead",
      protectedFields: leadFieldConfig.fieldName ? [leadFieldConfig.fieldName] : [],
      requestFactory: (currentPayload) => ({
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
            [[odooLeadId], currentPayload],
          ],
        },
      }),
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

function applyAppLeadSyncMetadata(
  payload: Record<string, any>,
  metadata?: AppLeadSyncMetadata
) {
  void payload;
  void metadata;
  return;
  /*
  if (!metadata) return;

  const studioField = (name: string) => `x_studio_${name}`;
  const studioOriginValue =
    metadata.appOrigin === "app"
      ? "App"
      : metadata.appOrigin === "odoo"
        ? "Odoo"
        : false;

  const dateValue =
    metadata.lastSyncAt instanceof Date
      ? metadata.lastSyncAt.toISOString().slice(0, 19).replace("T", " ")
      : metadata.lastSyncAt ?? false;

  payload[studioField("x_app_record_id")] = metadata.appRecordId ?? false;
  payload[studioField("x_app_record_ref")] = metadata.appRecordRef ?? false;
  payload[studioField("x_app_lead_ref")] = metadata.appLeadRef ?? false;
  payload[studioField("x_app_origin")] = studioOriginValue;
  payload[studioField("x_app_created_by_user_id")] = metadata.createdByUserId ?? false;
  payload[studioField("x_app_created_by_user_name")] = metadata.createdByUserName ?? false;
  payload[studioField("x_app_created_by_user_email")] = metadata.createdByUserEmail ?? false;
  payload[studioField("x_app_assigned_user_id")] = metadata.assignedUserId ?? false;
  payload[studioField("x_app_assigned_user_name")] = metadata.assignedUserName ?? false;
  payload[studioField("x_app_company_id")] = metadata.companyId ?? false;
  payload[studioField("x_app_company_name")] = metadata.companyName ?? false;
  payload[studioField("x_app_last_sync_at")] = dateValue;
  // Os Selection criados via Studio podem ficar com chaves internas imprevisíveis.
  // Mantemos estes dois campos fora do payload até termos os valores exactos do tenant.
  payload[studioField("x_app_internal_notes")] =
    htmlToPlainText(metadata.internalNotes) ?? false;
  payload[studioField("x_app_visit_context")] = metadata.visitContext ?? false;
  */
}

function applyAppTaskSyncMetadata(
  payload: Record<string, any>,
  metadata?: AppTaskSyncMetadata
) {
  void payload;
  void metadata;
  return;
  /*
  if (!metadata) return;

  const studioField = (name: string) => `x_studio_${name}`;
  const studioOriginValue =
    metadata.appOrigin === "app"
      ? "App"
      : metadata.appOrigin === "odoo"
        ? "Odoo"
        : false;

  const dateValue =
    metadata.lastSyncAt instanceof Date
      ? metadata.lastSyncAt.toISOString().slice(0, 19).replace("T", " ")
      : metadata.lastSyncAt ?? false;

  payload[studioField("x_app_record_id")] = metadata.appRecordId ?? false;
  payload[studioField("x_app_record_ref")] = metadata.appRecordRef ?? false;
  payload[studioField("x_app_task_ref")] = metadata.appTaskRef ?? false;
  payload[studioField("x_app_origin")] = studioOriginValue;
  payload[studioField("x_app_created_by_user_id")] = metadata.createdByUserId ?? false;
  payload[studioField("x_app_created_by_user_name")] = metadata.createdByUserName ?? false;
  payload[studioField("x_app_assigned_user_id")] = metadata.assignedUserId ?? false;
  payload[studioField("x_app_assigned_user_name")] = metadata.assignedUserName ?? false;
  payload[studioField("x_app_company_id")] = metadata.companyId ?? false;
  payload[studioField("x_app_company_name")] = metadata.companyName ?? false;
  payload[studioField("x_app_last_sync_at")] = dateValue;
  payload[studioField("x_app_internal_notes")] =
    htmlToPlainText(metadata.internalNotes) ?? false;
  */
}

export async function createTaskFromVmTask(args: {
  vmTask: any;
  empresaId: string;
  appSync?: AppTaskSyncMetadata;
}): Promise<number> {
  const { vmTask, empresaId, appSync } = args;
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const uid = await authenticateOdoo(conn);

  const payload: Record<string, any> = {
    name: vmTask.titulo,
  };

  const normalizedDescription = plainTextToOdooHtml(vmTask.descricao);
  if (normalizedDescription) {
    payload.description = normalizedDescription;
  }
  if (vmTask.dueDate) {
    const due = new Date(vmTask.dueDate);
    if (!Number.isNaN(due.getTime())) {
      payload.date_deadline = due.toISOString().slice(0, 10);
    }
  }

  applyAppTaskSyncMetadata(payload, appSync);

  return executeLeadWriteWithFallback<number>({
    conn,
    payload,
    operationLabel: "create project.task",
    requestFactory: (currentPayload) => ({
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [
          conn.dbName,
          uid,
          conn.apiKey,
          "project.task",
          "create",
          [currentPayload],
        ],
      },
    }),
  });
}

export async function updateTaskFromVmTask(args: {
  odooTaskId: number;
  vmTask: any;
  empresaId: string;
  appSync?: AppTaskSyncMetadata;
}): Promise<void> {
  const { odooTaskId, vmTask, empresaId, appSync } = args;
  const conn = await getOdooConnectionForEmpresa(empresaId);
  const uid = await authenticateOdoo(conn);

  const payload: Record<string, any> = {
    name: vmTask.titulo,
  };

  const normalizedDescription = plainTextToOdooHtml(vmTask.descricao);
  if (normalizedDescription) {
    payload.description = normalizedDescription;
  } else if (vmTask.descricao === null || vmTask.descricao === "") {
    payload.description = false;
  }

  if (vmTask.dueDate) {
    const due = new Date(vmTask.dueDate);
    payload.date_deadline = Number.isNaN(due.getTime())
      ? false
      : due.toISOString().slice(0, 10);
  } else if (vmTask.dueDate === null || vmTask.dueDate === undefined) {
    payload.date_deadline = false;
  }

  applyAppTaskSyncMetadata(payload, appSync);

  await executeLeadWriteWithFallback<boolean>({
    conn,
    payload,
    operationLabel: "write project.task",
    requestFactory: (currentPayload) => ({
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [
          conn.dbName,
          uid,
          conn.apiKey,
          "project.task",
          "write",
          [[odooTaskId], currentPayload],
        ],
      },
    }),
  });
}
