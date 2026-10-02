import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "./db";
import {ContactAccessService} from './contactAccessService';
import {contactRecordBoundary} from './contactRecordBoundary';
import {
  contactos,
  entidadeTipos,
  entidades,
  marcas,
  users,
  visitas,
} from "@shared/schema";

export class TenantValidationError extends Error {
  status = 400;
}

type TenantReferences = {
  entidadeId?: string | null;
  contactoId?: string | null;
  visitaId?: string | null;
  visitaAnteriorId?: string | null;
  assignedUserId?: string | null;
  entidadeTipoId?: string | null;
  contactosIds?: string[];
  marcasIds?: string[];
};

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function assertComplete(
  label: string,
  requestedIds: string[],
  existingIds: string[],
) {
  if (requestedIds.length !== existingIds.length) {
    throw new TenantValidationError(
      `${label} inválido ou pertencente a outra empresa.`,
    );
  }
}

export async function assertTenantReferences(
  empresaId: string,
  references: TenantReferences,
  actor?: {userId:string;userRole:string},
) {
  const entityIds = uniqueIds([references.entidadeId]);
  const contactIds = uniqueIds([
    references.contactoId,
    ...(references.contactosIds ?? []),
  ]);
  const visitIds = uniqueIds([
    references.visitaId,
    references.visitaAnteriorId,
  ]);
  const userIds = uniqueIds([references.assignedUserId]);
  const entityTypeIds = uniqueIds([references.entidadeTipoId]);
  const brandIds = uniqueIds(references.marcasIds ?? []);

  if(process.env.CONTACT_ACCESS_V2==='true') {
    if(!actor)throw new TenantValidationError('Contexto de autorização em falta.');
    const access=new ContactAccessService(pool);
    for(const id of entityIds)if(!await access.allowed(actor.userId,'entity',id))throw new TenantValidationError('Registo indisponível.');
    for(const id of contactIds)if(!await access.allowed(actor.userId,'person',id))throw new TenantValidationError('Registo indisponível.');
    if(visitIds.length) {
      const allowed=await contactRecordBoundary(empresaId,actor.userId,actor.userRole);
      const records=await db.select().from(visitas).where(and(eq(visitas.empresaId,empresaId),inArray(visitas.id,visitIds)));
      if(records.some(record=>!allowed(record)))throw new TenantValidationError('Registo indisponível.');
    }
  }

  const [
    existingEntities,
    existingContacts,
    existingVisits,
    existingUsers,
    existingEntityTypes,
    existingBrands,
  ] = await Promise.all([
    entityIds.length
      ? db
          .select({ id: entidades.id })
          .from(entidades)
          .where(
            and(
              eq(entidades.empresaId, empresaId),
              inArray(entidades.id, entityIds),
            ),
          )
      : [],
    contactIds.length
      ? db
          .select({ id: contactos.id })
          .from(contactos)
          .where(
            and(
              eq(contactos.empresaId, empresaId),
              inArray(contactos.id, contactIds),
            ),
          )
      : [],
    visitIds.length
      ? db
          .select({ id: visitas.id })
          .from(visitas)
          .where(
            and(
              eq(visitas.empresaId, empresaId),
              inArray(visitas.id, visitIds),
            ),
          )
      : [],
    userIds.length
      ? db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.empresaId, empresaId),
              eq(users.ativo, true),
              inArray(users.id, userIds),
            ),
          )
      : [],
    entityTypeIds.length
      ? db
          .select({ id: entidadeTipos.id })
          .from(entidadeTipos)
          .where(
            and(
              eq(entidadeTipos.empresaId, empresaId),
              inArray(entidadeTipos.id, entityTypeIds),
            ),
          )
      : [],
    brandIds.length
      ? db
          .select({ id: marcas.id })
          .from(marcas)
          .where(
            and(
              eq(marcas.empresaId, empresaId),
              inArray(marcas.id, brandIds),
            ),
          )
      : [],
  ]);

  assertComplete("Entidade", entityIds, existingEntities.map(({ id }) => id));
  assertComplete("Contacto", contactIds, existingContacts.map(({ id }) => id));
  assertComplete("Visita", visitIds, existingVisits.map(({ id }) => id));
  assertComplete("Utilizador", userIds, existingUsers.map(({ id }) => id));
  assertComplete(
    "Tipo de entidade",
    entityTypeIds,
    existingEntityTypes.map(({ id }) => id),
  );
  assertComplete("Marca", brandIds, existingBrands.map(({ id }) => id));
}

