import type { Contacto } from "@shared/schema";

export type ContactDuplicateGroup = {
  id: string;
  matchedBy: Array<"odoo" | "email" | "phone">;
  contacts: Contacto[];
};

function normalizedEmail(value: unknown): string | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized.includes("@") ? normalized : null;
}

function normalizedPhone(value: unknown): string | null {
  let normalized = String(value ?? "").replace(/\D/g, "");
  if (normalized.startsWith("00")) normalized = normalized.slice(2);
  if (normalized.startsWith("351") && normalized.length === 12) {
    normalized = normalized.slice(3);
  }
  return normalized.length >= 7 ? normalized : null;
}

export function groupDuplicateContacts(
  companyContacts: Contacto[],
): ContactDuplicateGroup[] {
  const parent = new Map(companyContacts.map((contact) => [contact.id, contact.id]));
  const reasons = new Map<string, Set<"odoo" | "email" | "phone">>();
  const indexes = {
    odoo: new Map<string, string>(),
    email: new Map<string, string>(),
    phone: new Map<string, string>(),
  };
  const find = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };

  for (const contact of companyContacts) {
    const values = {
      odoo: String(contact.odooPartnerId ?? "").trim() || null,
      email: normalizedEmail(contact.email),
      phone: normalizedPhone(contact.telemovel),
    };
    for (const kind of ["odoo", "email", "phone"] as const) {
      const value = values[kind];
      if (!value) continue;
      const existingId = indexes[kind].get(value);
      if (existingId) {
        union(existingId, contact.id);
        const key = [existingId, contact.id].sort().join(":");
        const pairReasons = reasons.get(key) ?? new Set();
        pairReasons.add(kind);
        reasons.set(key, pairReasons);
      } else {
        indexes[kind].set(value, contact.id);
      }
    }
  }

  const grouped = new Map<string, Contacto[]>();
  for (const contact of companyContacts) {
    const root = find(contact.id);
    grouped.set(root, [...(grouped.get(root) ?? []), contact]);
  }

  return Array.from(grouped.values())
    .filter((group) => group.length > 1)
    .map((group) => {
      const ids = new Set(group.map((contact) => contact.id));
      const matchedBy = new Set<"odoo" | "email" | "phone">();
      for (const [key, pairReasons] of Array.from(reasons.entries())) {
        if (key.split(":").every((id) => ids.has(id))) {
          pairReasons.forEach((reason) => matchedBy.add(reason));
        }
      }
      return {
        id: group.map((contact) => contact.id).sort().join("-"),
        matchedBy: Array.from(matchedBy),
        contacts: group.sort(
          (a, b) =>
            new Date(a.createdAt ?? 0).getTime() -
            new Date(b.createdAt ?? 0).getTime(),
        ),
      };
    });
}
