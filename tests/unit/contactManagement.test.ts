import assert from "node:assert/strict";
import test from "node:test";
import type { Contacto } from "../../shared/schema";
import { groupDuplicateContacts } from "../../server/contactDuplicateGroups";

function contact(
  id: string,
  values: Partial<Contacto> = {},
): Contacto {
  return {
    id,
    empresaId: "company-1",
    nome: `Contacto ${id}`,
    funcao: null,
    telemovel: null,
    email: null,
    entidadeId: null,
    gabineteId: null,
    observacoes: null,
    fotoUrl: null,
    createdByUserId: null,
    assignedUserId: null,
    odooContactId: null,
    odooPartnerId: null,
    needsSync: false,
    syncStatus: "never",
    lastSyncAt: null,
    syncError: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...values,
  };
}

test("groups contacts by normalized email, Portuguese phone and Odoo partner", () => {
  const groups = groupDuplicateContacts([
    contact("a", { email: " USER@example.com " }),
    contact("b", { email: "user@example.com", telemovel: "+351 912 345 678" }),
    contact("c", { telemovel: "912345678" }),
    contact("d", { odooPartnerId: "42" }),
    contact("e", { odooPartnerId: "42" }),
    contact("unique", { email: "other@example.com" }),
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((group) => group.contacts.map(({ id }) => id).sort()).sort(),
    [["a", "b", "c"], ["d", "e"]],
  );
  assert.deepEqual(groups[0].matchedBy.sort(), ["email", "phone"]);
});

test("does not group contacts without a reliable identifier", () => {
  const groups = groupDuplicateContacts([
    contact("a", { nome: "Mesmo nome" }),
    contact("b", { nome: "Mesmo nome" }),
  ]);
  assert.deepEqual(groups, []);
});
