import {
  odooConnections,
  type OdooConnection,
  type InsertOdooConnection,
} from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "../secretCrypto";

export class OdooConnectionsStorage {
  async getOdooConnectionByEmpresaId(empresaId: string): Promise<OdooConnection | undefined> {
    const [connection] = await db
      .select()
      .from(odooConnections)
      .where(eq(odooConnections.empresaId, empresaId))
      .limit(1);

    return connection
      ? { ...connection, apiKey: decryptSecret(connection.apiKey) }
      : undefined;
  }

  async upsertOdooConnection(input: InsertOdooConnection): Promise<OdooConnection> {
    const [existing] = await db
      .select()
      .from(odooConnections)
      .where(eq(odooConnections.empresaId, input.empresaId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(odooConnections)
        .set({
          baseUrl: input.baseUrl,
          dbName: input.dbName,
          username: input.username,
          apiKey: encryptSecret(input.apiKey),
          environment: input.environment,
          isActive: input.isActive,
          updatedAt: new Date(),
        })
        .where(eq(odooConnections.id, existing.id))
        .returning();

      return { ...updated, apiKey: decryptSecret(updated.apiKey) };
    }

    const [created] = await db
      .insert(odooConnections)
      .values({ ...input, apiKey: encryptSecret(input.apiKey) })
      .returning();

    return { ...created, apiKey: decryptSecret(created.apiKey) };
  }
}

export const odooConnectionsStorage = new OdooConnectionsStorage();
