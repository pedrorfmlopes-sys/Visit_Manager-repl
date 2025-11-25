import {
  microsoftConnections,
  type MicrosoftConnection,
  type InsertMicrosoftConnection,
} from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";

export class MicrosoftConnectionsStorage {
  async getMicrosoftConnectionByUserId(userId: string): Promise<MicrosoftConnection | undefined> {
    const [connection] = await db
      .select()
      .from(microsoftConnections)
      .where(eq(microsoftConnections.userId, userId))
      .limit(1);
    return connection;
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
          updatedAt: new Date(),
        })
        .where(eq(microsoftConnections.userId, input.userId))
        .returning();
      return updated;
    } else {
      // Insert new connection
      const [newConnection] = await db
        .insert(microsoftConnections)
        .values(input)
        .returning();
      return newConnection;
    }
  }
}

export const microsoftConnectionsStorage = new MicrosoftConnectionsStorage();
