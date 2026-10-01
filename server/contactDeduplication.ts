import { and, eq, ne, or, sql } from "drizzle-orm";
import { db } from "./db";
import { contactos, type Contacto } from "@shared/schema";

export type ContactDuplicateMatch = {
  contacto: Contacto;
  matchedBy: "odoo" | "email" | "phone";
};

export function normalizeContactEmail(value: unknown): string | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized.includes("@") ? normalized : null;
}

export function normalizeContactPhone(value: unknown): string | null {
  let normalized = String(value ?? "").replace(/\D/g, "");
  if (normalized.startsWith("00")) normalized = normalized.slice(2);
  if (normalized.startsWith("351") && normalized.length === 12) {
    normalized = normalized.slice(3);
  }
  return normalized.length >= 7 ? normalized : null;
}

export async function findDuplicateContacto(
  input: {
    empresaId: string;
    email?: unknown;
    telemovel?: unknown;
    odooPartnerId?: unknown;
    excludeId?: string;
  },
  executor: any = db,
): Promise<ContactDuplicateMatch | null> {
  const email = normalizeContactEmail(input.email);
  const phone = normalizeContactPhone(input.telemovel);
  const odooPartnerId = String(input.odooPartnerId ?? "").trim() || null;
  const duplicateConditions: any[] = [];

  if (odooPartnerId) {
    duplicateConditions.push(
      sql`btrim(coalesce(${contactos.odooPartnerId}, '')) = ${odooPartnerId}`,
    );
  }
  if (email) {
    duplicateConditions.push(
      sql`lower(btrim(coalesce(${contactos.email}, ''))) = ${email}`,
    );
  }
  if (phone) {
    duplicateConditions.push(
      sql`(
        case
          when regexp_replace(coalesce(${contactos.telemovel}, ''), '[^0-9]', '', 'g') like '00351%'
            and length(regexp_replace(coalesce(${contactos.telemovel}, ''), '[^0-9]', '', 'g')) = 14
            then right(regexp_replace(coalesce(${contactos.telemovel}, ''), '[^0-9]', '', 'g'), 9)
          when regexp_replace(coalesce(${contactos.telemovel}, ''), '[^0-9]', '', 'g') like '351%'
            and length(regexp_replace(coalesce(${contactos.telemovel}, ''), '[^0-9]', '', 'g')) = 12
            then right(regexp_replace(coalesce(${contactos.telemovel}, ''), '[^0-9]', '', 'g'), 9)
          else regexp_replace(coalesce(${contactos.telemovel}, ''), '[^0-9]', '', 'g')
        end
      ) = ${phone}`,
    );
  }
  if (duplicateConditions.length === 0) return null;

  const companyConditions: any[] = [eq(contactos.empresaId, input.empresaId)];
  if (input.excludeId) companyConditions.push(ne(contactos.id, input.excludeId));

  const candidates = await executor
    .select()
    .from(contactos)
    .where(and(...companyConditions, or(...duplicateConditions)))
    .limit(20);

  const byOdoo = odooPartnerId
    ? candidates.find(
        (contacto: Contacto) =>
          String(contacto.odooPartnerId ?? "").trim() === odooPartnerId,
      )
    : null;
  if (byOdoo) return { contacto: byOdoo, matchedBy: "odoo" };

  const byEmail = email
    ? candidates.find(
        (contacto: Contacto) =>
          normalizeContactEmail(contacto.email) === email,
      )
    : null;
  if (byEmail) return { contacto: byEmail, matchedBy: "email" };

  const byPhone = phone
    ? candidates.find(
        (contacto: Contacto) =>
          normalizeContactPhone(contacto.telemovel) === phone,
      )
    : null;
  return byPhone ? { contacto: byPhone, matchedBy: "phone" } : null;
}

export async function createContactoIfUnique(
  contacto: Record<string, unknown>,
  empresaId: string,
): Promise<
  | { created: true; contacto: Contacto }
  | ({ created: false } & ContactDuplicateMatch)
> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`contactos:${empresaId}`}))`,
    );

    const duplicate = await findDuplicateContacto(
      {
        empresaId,
        email: contacto.email,
        telemovel: contacto.telemovel,
        odooPartnerId: contacto.odooPartnerId,
      },
      tx,
    );
    if (duplicate) return { created: false as const, ...duplicate };

    const [created] = await tx
      .insert(contactos)
      .values({ ...contacto, empresaId } as any)
      .returning();
    return { created: true as const, contacto: created };
  });
}

export function contactDuplicateMessage(
  match: Pick<ContactDuplicateMatch, "contacto" | "matchedBy">,
): string {
  const reason =
    match.matchedBy === "odoo"
      ? "parceiro Odoo"
      : match.matchedBy === "email"
        ? "email"
        : "telefone";
  return `Já existe o contacto "${match.contacto.nome}" com o mesmo ${reason}.`;
}
