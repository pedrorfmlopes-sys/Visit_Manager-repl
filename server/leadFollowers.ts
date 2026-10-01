import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { leadFollowers, users } from "@shared/schema";

export async function syncLeadFollowersFromOdoo(input: {
  empresaId: string;
  leadId: string;
  followerPartnerIds: number[];
}) {
  const partnerIds = Array.from(
    new Set(input.followerPartnerIds.map(String)),
  );
  const mappedUsers =
    partnerIds.length > 0
      ? await db
          .select({
            id: users.id,
            odooPartnerId: users.odooPartnerId,
          })
          .from(users)
          .where(
            and(
              eq(users.empresaId, input.empresaId),
              eq(users.ativo, true),
              inArray(users.odooPartnerId, partnerIds),
            ),
          )
      : [];

  await db.transaction(async (tx) => {
    await tx
      .delete(leadFollowers)
      .where(
        and(
          eq(leadFollowers.empresaId, input.empresaId),
          eq(leadFollowers.leadId, input.leadId),
          eq(leadFollowers.source, "odoo"),
        ),
      );

    if (mappedUsers.length > 0) {
      await tx
        .insert(leadFollowers)
        .values(
          mappedUsers.map((user) => ({
            empresaId: input.empresaId,
            leadId: input.leadId,
            userId: user.id,
            odooPartnerId: user.odooPartnerId,
            source: "odoo",
            syncedAt: new Date(),
          })),
        )
        .onConflictDoNothing();
    }
  });

  return mappedUsers.map((user) => user.id);
}

export async function addLocalLeadFollower(input: {
  empresaId: string;
  leadId: string;
  userId: string;
  odooPartnerId?: string | null;
  source?: "odoo" | "app";
}) {
  await db
    .insert(leadFollowers)
    .values({
      empresaId: input.empresaId,
      leadId: input.leadId,
      userId: input.userId,
      odooPartnerId: input.odooPartnerId ?? null,
      source: input.source ?? "app",
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [leadFollowers.leadId, leadFollowers.userId],
      set: {
        odooPartnerId: input.odooPartnerId ?? null,
        source: input.source ?? "app",
        syncedAt: new Date(),
      },
    });
}
