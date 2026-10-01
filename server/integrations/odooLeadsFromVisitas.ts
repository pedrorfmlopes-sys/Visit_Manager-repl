import { db } from "../db";
import { visitas, entidades, contactos } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { createOdooLead } from "./odooClient";

export type CreateLeadFromVisitaResult = {
  visitaId: string;
  leadId: number;
};

/**
 * Cria uma lead no Odoo a partir de uma visita
 */
export async function createLeadForVisita(
  empresaId: string,
  visitaId: string
): Promise<CreateLeadFromVisitaResult> {
  // 1) Buscar visita + entidade + contacto (se existir)
  const [row] = await db
    .select({
      visita: visitas,
      entidade: entidades,
      contacto: contactos, // left join, porque pode ser null
    })
    .from(visitas)
    .innerJoin(entidades, and(
      eq(entidades.id, visitas.entidadeId),
      eq(entidades.empresaId, empresaId)
    ))
    .leftJoin(contactos, and(
      eq(contactos.id, visitas.contactoId),
      eq(contactos.empresaId, empresaId)
    ))
    .where(
      and(
        eq(visitas.id, visitaId),
        eq(visitas.empresaId, empresaId)
      )
    );

  if (!row) {
    throw new Error("VISITA_NOT_FOUND");
  }

  const { visita, entidade, contacto } = row;

  // 2) Construir campos para a lead
  const leadName =
    visita.dataVisita && visita.dataVisita.toISOString()
      ? `Visita – ${entidade?.nome || "sem título"} (${new Date(visita.dataVisita).toLocaleDateString("pt-PT")})`
      : (visita.dataVisita
          ? `Visita – ${entidade?.nome || "sem título"}`
          : `Visita – ${entidade?.nome || "sem título"}`);

  const contactName =
    contacto?.nome?.trim() ||
    entidade?.nome?.trim() ||
    null;

  const email =
    contacto?.email?.trim() ||
    entidade?.email?.trim() ||
    null;

  const phone =
    contacto?.telemovel?.trim() ||
    entidade?.telefone?.trim() ||
    null;

  const descricaoPartes: string[] = [];

  if (visita.dataVisita) {
    descricaoPartes.push(`Data da visita: ${new Date(visita.dataVisita).toISOString()}`);
  }
  if (visita.notas?.trim()) {
    descricaoPartes.push(`Notas da visita:\n${visita.notas.trim()}`);
  }
  if (entidade?.nome) {
    descricaoPartes.push(`Entidade: ${entidade.nome}`);
  }
  if (contacto?.nome) {
    descricaoPartes.push(`Contacto: ${contacto.nome}`);
  }

  const description =
    descricaoPartes.length > 0
      ? descricaoPartes.join("\n\n")
      : "Lead criada automaticamente a partir de uma visita na aplicação Visit Manager.";

  // 3) Chamar Odoo
  const result = await createOdooLead(empresaId, {
    name: leadName,
    contactName,
    email,
    phone,
    description,
  });

  // 4) Guardar odooLeadId na visita
  await db
    .update(visitas)
    .set({ odooLeadId: String(result.id) })
    .where(
      and(
        eq(visitas.id, visitaId),
        eq(visitas.empresaId, empresaId)
      )
    );

  return {
    visitaId,
    leadId: result.id,
  };
}
