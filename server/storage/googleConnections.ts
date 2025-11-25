import {
  googleConnections,
  type GoogleConnection,
  type InsertGoogleConnection,
} from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";

export class GoogleConnectionsStorage {
  async getGoogleConnectionByUserId(userId: string): Promise<GoogleConnection | undefined> {
    const [connection] = await db
      .select()
      .from(googleConnections)
      .where(eq(googleConnections.userId, userId))
      .limit(1);
    return connection;
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
          updatedAt: new Date(),
        })
        .where(eq(googleConnections.userId, input.userId))
        .returning();
      return updated;
    } else {
      // Insert new connection
      const [newConnection] = await db
        .insert(googleConnections)
        .values(input)
        .returning();
      return newConnection;
    }
  }
}

export const googleConnectionsStorage = new GoogleConnectionsStorage();
