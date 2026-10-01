import {
  microsoftConnections,
  type MicrosoftConnection,
  type InsertMicrosoftConnection,
} from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "../secretCrypto";

export class MicrosoftConnectionsStorage {
  async getMicrosoftConnectionByUserId(userId: string): Promise<MicrosoftConnection | undefined> {
    const [connection] = await db
      .select()
      .from(microsoftConnections)
      .where(eq(microsoftConnections.userId, userId))
      .limit(1);
    return connection
      ? {
          ...connection,
          accessToken: decryptSecret(connection.accessToken),
          refreshToken: decryptSecret(connection.refreshToken),
        }
      : undefined;
  }

  async upsertMicrosoftConnection(input: InsertMicrosoftConnection): Promise<MicrosoftConnection> {
    // Check if connection already exists for this user
    const existing = await this.getMicrosoftConnectionByUserId(input.userId);
    
    if (existing) {
      // Update existing connection
      const [updated] = await db
        .update(microsoftConnections)
        .set({
          ...input,
          accessToken: encryptSecret(input.accessToken),
          refreshToken: encryptSecret(input.refreshToken),
          updatedAt: new Date(),
        })
        .where(eq(microsoftConnections.userId, input.userId))
        .returning();
      return {
        ...updated,
        accessToken: decryptSecret(updated.accessToken),
        refreshToken: decryptSecret(updated.refreshToken),
      };
    } else {
      // Insert new connection
      const [newConnection] = await db
        .insert(microsoftConnections)
        .values({
          ...input,
          accessToken: encryptSecret(input.accessToken),
          refreshToken: encryptSecret(input.refreshToken),
        })
        .returning();
      return {
        ...newConnection,
        accessToken: decryptSecret(newConnection.accessToken),
        refreshToken: decryptSecret(newConnection.refreshToken),
      };
    }
  }

  async deleteMicrosoftConnectionByUserId(userId: string): Promise<void> {
    await db
      .delete(microsoftConnections)
      .where(eq(microsoftConnections.userId, userId));
  }
}

export const microsoftConnectionsStorage = new MicrosoftConnectionsStorage();
