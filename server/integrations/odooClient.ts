import { db } from "../db";
import { odooConnections } from "@shared/schema";
import { eq } from "drizzle-orm";

export type OdooConnection = typeof odooConnections.$inferSelect;

export type OdooAuthResponse = {
  userId: number;
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
