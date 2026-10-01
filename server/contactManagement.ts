import { and, eq, inArray, ne, sql } from "drizzle-orm";
import {
  contactos,
  leads,
  leadsContactos,
  odooContactRequests,
  visitas,
  visitasContactos,
  type Contacto,
} from "@shared/schema";
import { db } from "./db";
export { groupDuplicateContacts } from "./contactDuplicateGroups";

async function detachContactReferences(
  executor: any,
  contactIds: string[],
  empresaId: string,
) {
  await executor
    .update(visitas)
    .set({ contactoId: null })
    .where(
      and(eq(visitas.empresaId, empresaId), inArray(visitas.contactoId, contactIds)),
    );
  await executor
    .update(leads)
    .set({ contactoId: null, updatedAt: new Date() })
    .where(and(eq(leads.empresaId, empresaId), inArray(leads.contactoId, contactIds)));
  await executor
    .update(odooContactRequests)
    .set({ contactoId: null, updatedAt: new Date() })
    .where(
      and(
        eq(odooContactRequests.empresaId, empresaId),
        inArray(odooContactRequests.contactoId, contactIds),
      ),
    );
  await executor
    .delete(visitasContactos)
    .where(
      and(
        eq(visitasContactos.empresaId, empresaId),
        inArray(visitasContactos.contactoId, contactIds),
      ),
    );
  await executor
    .delete(leadsContactos)
    .where(inArray(leadsContactos.contactoId, contactIds));
}

export async function deleteContactSafely(
  id: string,
  empresaId: string,
  userId?: string,
  userRole?: "admin" | "agent",
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const conditions: any[] = [
      eq(contactos.id, id),
      eq(contactos.empresaId, empresaId),
    ];
    if (userId && userRole === "agent") {
      conditions.push(
        sql`(${contactos.createdByUserId} = ${userId} OR ${contactos.assignedUserId} = ${userId})`,
      );
    }
    const [contact] = await tx
      .select({ id: contactos.id })
      .from(contactos)
      .where(and(...conditions))
      .limit(1);
    if (!contact) return false;

    await detachContactReferences(tx, [id], empresaId);
    const deleted = await tx
      .delete(contactos)
      .where(and(eq(contactos.id, id), eq(contactos.empresaId, empresaId)))
      .returning({ id: contactos.id });
    return deleted.length === 1;
  });
}

export async function mergeContacts(
  primaryId: string,
  duplicateIds: string[],
  empresaId: string,
): Promise<Contacto> {
  const ids = Array.from(new Set([primaryId, ...duplicateIds]));
  if (ids.length < 2 || duplicateIds.includes(primaryId)) {
    throw new Error("Selecione um contacto principal e pelo menos um duplicado.");
  }

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`contactos:${empresaId}`}))`,
    );
    const records = await tx
      .select()
      .from(contactos)
      .where(and(eq(contactos.empresaId, empresaId), inArray(contactos.id, ids)));
    if (records.length !== ids.length) {
      throw new Error("Um dos contactos já não existe ou pertence a outra empresa.");
    }

    const primary = records.find((contact) => contact.id === primaryId)!;
    const duplicates = records.filter((contact) => contact.id !== primaryId);
    const firstValue = (field: keyof Contacto) =>
      primary[field] ??
      duplicates.map((contact) => contact[field]).find((value) => value != null) ??
      null;
    const mergedNotes = Array.from(
      new Set(
        records
          .map((contact) => contact.observacoes?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    )
      .join("\n\n");

    await tx
      .update(visitas)
      .set({ contactoId: primaryId })
      .where(
        and(
          eq(visitas.empresaId, empresaId),
          inArray(visitas.contactoId, duplicateIds),
        ),
      );
    await tx
      .update(leads)
      .set({ contactoId: primaryId, updatedAt: new Date() })
      .where(
        and(eq(leads.empresaId, empresaId), inArray(leads.contactoId, duplicateIds)),
      );
    await tx
      .update(odooContactRequests)
      .set({ contactoId: primaryId, updatedAt: new Date() })
      .where(
        and(
          eq(odooContactRequests.empresaId, empresaId),
          inArray(odooContactRequests.contactoId, duplicateIds),
        ),
      );

    await tx.execute(sql`
      INSERT INTO visitas_contactos (id, empresa_id, visita_id, contacto_id, role, created_at)
      SELECT DISTINCT ON (vc.visita_id)
        gen_random_uuid(), vc.empresa_id, vc.visita_id, ${primaryId}, vc.role, vc.created_at
      FROM visitas_contactos vc
      WHERE vc.empresa_id = ${empresaId}
        AND vc.contacto_id IN (${sql.join(duplicateIds.map((id) => sql`${id}`), sql`, `)})
        AND NOT EXISTS (
          SELECT 1 FROM visitas_contactos existing
          WHERE existing.visita_id = vc.visita_id AND existing.contacto_id = ${primaryId}
        )
    `);
    await tx.execute(sql`
      INSERT INTO leads_contactos (id, lead_id, contacto_id, role, created_at)
      SELECT DISTINCT ON (lc.lead_id)
        gen_random_uuid(), lc.lead_id, ${primaryId}, lc.role, lc.created_at
      FROM leads_contactos lc
      INNER JOIN leads l ON l.id = lc.lead_id
      WHERE l.empresa_id = ${empresaId}
        AND lc.contacto_id IN (${sql.join(duplicateIds.map((id) => sql`${id}`), sql`, `)})
        AND NOT EXISTS (
          SELECT 1 FROM leads_contactos existing
          WHERE existing.lead_id = lc.lead_id AND existing.contacto_id = ${primaryId}
        )
    `);

    await tx
      .delete(visitasContactos)
      .where(
        and(
          eq(visitasContactos.empresaId, empresaId),
          inArray(visitasContactos.contactoId, duplicateIds),
        ),
      );
    await tx
      .delete(leadsContactos)
      .where(inArray(leadsContactos.contactoId, duplicateIds));

    const [updated] = await tx
      .update(contactos)
      .set({
        funcao: firstValue("funcao") as string | null,
        telemovel: firstValue("telemovel") as string | null,
        email: firstValue("email") as string | null,
        entidadeId: firstValue("entidadeId") as string | null,
        gabineteId: firstValue("gabineteId") as string | null,
        observacoes: mergedNotes || null,
        fotoUrl: firstValue("fotoUrl") as string | null,
        assignedUserId: firstValue("assignedUserId") as string | null,
        odooContactId: firstValue("odooContactId") as number | null,
        odooPartnerId: firstValue("odooPartnerId") as string | null,
        needsSync: records.some((contact) => contact.needsSync),
        updatedAt: new Date(),
      })
      .where(and(eq(contactos.id, primaryId), eq(contactos.empresaId, empresaId)))
      .returning();

    await tx
      .delete(contactos)
      .where(
        and(
          eq(contactos.empresaId, empresaId),
          inArray(contactos.id, duplicateIds),
          ne(contactos.id, primaryId),
        ),
      );
    return updated;
  });
}
