import {
  googleConnections,
  type GoogleConnection,
  type InsertGoogleConnection,
} from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "../secretCrypto";

export class GoogleConnectionsStorage {
  async getGoogleConnectionByUserId(userId: string): Promise<GoogleConnection | undefined> {
    const [connection] = await db
      .select()
      .from(googleConnections)
      .where(eq(googleConnections.userId, userId))
      .limit(1);
    return connection
      ? {
          ...connection,
          accessToken: decryptSecret(connection.accessToken),
          refreshToken: decryptSecret(connection.refreshToken),
        }
      : undefined;
  }

  async upsertGoogleConnection(input: InsertGoogleConnection): Promise<GoogleConnection> {
    // Check if connection already exists for this user
    const existing = await this.getGoogleConnectionByUserId(input.userId);

    if (existing) {
      // Update existing connection
      const [updated] = await db
        .update(googleConnections)
        .set({
          ...input,
          accessToken: encryptSecret(input.accessToken),
          refreshToken: encryptSecret(input.refreshToken),
          updatedAt: new Date(),
        })
        .where(eq(googleConnections.userId, input.userId))
        .returning();
      return {
        ...updated,
        accessToken: decryptSecret(updated.accessToken),
        refreshToken: decryptSecret(updated.refreshToken),
      };
    } else {
      // Insert new connection
      const [newConnection] = await db
        .insert(googleConnections)
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
}

export const googleConnectionsStorage = new GoogleConnectionsStorage();
