import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../../server/db";
import {
  contactos,
  empresas,
  entidades,
  leads,
  leadsContactos,
  users,
  visitas,
  visitasContactos,
  tarefas,
} from "../../shared/schema";
import {
  deleteContactSafely,
  mergeContacts,
} from "../../server/contactManagement";
import { storage } from "../../server/storage";

test("merge and delete contacts preserve CRM history", async () => {
  const suffix = randomUUID();
  const [company] = await db
    .insert(empresas)
    .values({ nome: `Contact management test ${suffix}` })
    .returning();

  try {
    const [user] = await db
      .insert(users)
      .values({
        id: `contact-test-${suffix}`,
        email: `contact-test-${suffix}@example.invalid`,
        empresaId: company.id,
        role: "admin",
      })
      .returning();
    const [entity] = await db
      .insert(entidades)
      .values({ empresaId: company.id, nome: "Entidade teste" })
      .returning();
    const [primary, duplicate, removable] = await db
      .insert(contactos)
      .values([
        {
          empresaId: company.id,
          nome: "Principal",
          email: `merge-${suffix}@example.invalid`,
          createdByUserId: user.id,
        },
        {
          empresaId: company.id,
          nome: "Duplicado",
          telemovel: "+351 912 345 678",
          observacoes: "Nota preservada",
          createdByUserId: user.id,
        },
        {
          empresaId: company.id,
          nome: "Removível",
          createdByUserId: user.id,
        },
      ])
      .returning();
    const [mergeVisit, deleteVisit] = await db
      .insert(visitas)
      .values([
        {
          empresaId: company.id,
          entidadeId: entity.id,
          contactoId: duplicate.id,
          userId: user.id,
          dataVisita: new Date(),
        },
        {
          empresaId: company.id,
          entidadeId: entity.id,
          contactoId: removable.id,
          userId: user.id,
          dataVisita: new Date(),
        },
      ])
      .returning();
    const [mergeLead, deleteLead] = await db
      .insert(leads)
      .values([
        {
          empresaId: company.id,
          entidadeId: entity.id,
          contactoId: duplicate.id,
          titulo: "Lead merge",
        },
        {
          empresaId: company.id,
          entidadeId: entity.id,
          contactoId: removable.id,
          titulo: "Lead delete",
        },
      ])
      .returning();
    await db.insert(visitasContactos).values({
      empresaId: company.id,
      visitaId: mergeVisit.id,
      contactoId: duplicate.id,
    });
    await db.insert(leadsContactos).values({
      leadId: mergeLead.id,
      contactoId: duplicate.id,
    });

    const merged = await mergeContacts(primary.id, [duplicate.id], company.id);
    assert.equal(merged.telemovel, "+351 912 345 678");
    assert.equal(merged.observacoes, "Nota preservada");
    assert.equal(
      (
        await db
          .select()
          .from(visitas)
          .where(eq(visitas.id, mergeVisit.id))
      )[0].contactoId,
      primary.id,
    );
    assert.equal(
      (
        await db.select().from(leads).where(eq(leads.id, mergeLead.id))
      )[0].contactoId,
      primary.id,
    );
    assert.equal(
      (
        await db
          .select()
          .from(visitasContactos)
          .where(
            and(
              eq(visitasContactos.visitaId, mergeVisit.id),
              eq(visitasContactos.contactoId, primary.id),
            ),
          )
      ).length,
      1,
    );

    assert.equal(
      await deleteContactSafely(removable.id, company.id, user.id, "admin"),
      true,
    );
    assert.equal(
      (
        await db.select().from(visitas).where(eq(visitas.id, deleteVisit.id))
      )[0].contactoId,
      null,
    );
    assert.equal(
      (
        await db.select().from(leads).where(eq(leads.id, deleteLead.id))
      )[0].contactoId,
      null,
    );
  } finally {
    await db.delete(empresas).where(eq(empresas.id, company.id));
  }
});

test("GPS suggestions find an overdue task with an adaptive rural radius", async () => {
  const suffix = randomUUID();
  const [company] = await db
    .insert(empresas)
    .values({ nome: `GPS test ${suffix}`, mostrarGPS: true })
    .returning();

  try {
    const [user] = await db
      .insert(users)
      .values({
        id: `gps-test-${suffix}`,
        email: `gps-test-${suffix}@example.invalid`,
        empresaId: company.id,
        role: "agent",
      })
      .returning();
    const [entity] = await db
      .insert(entidades)
      .values({
        empresaId: company.id,
        nome: "Cliente próximo",
        latitude: "38.7200",
        longitude: "-9.1300",
        proximityAlertsEnabled: true,
        createdByUserId: user.id,
        assignedUserId: user.id,
      })
      .returning();
    const [task] = await db
      .insert(tarefas)
      .values({
        empresaId: company.id,
        entidadeId: entity.id,
        titulo: "Seguimento atrasado",
        createdByUserId: user.id,
        assignedUserId: user.id,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .returning();

    const result = await storage.getNearbyVisitSuggestions(
      company.id,
      38.721,
      -9.13,
      { userId: user.id, userRole: "agent", inactivityDays: 60 },
    );
    assert.equal(result.radiusMeters, 2000);
    assert.equal(result.density, "rural");
    assert.equal(result.suggestions[0].tipo, "tarefa_atrasada");
    assert.equal(result.suggestions[0].tarefaId, task.id);
  } finally {
    await db.delete(empresas).where(eq(empresas.id, company.id));
  }
});
