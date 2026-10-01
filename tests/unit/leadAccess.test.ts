import assert from "node:assert/strict";
import test from "node:test";
import { changesRequireAdminApproval } from "../../shared/leadPermissions";

test("view and propose modes always require administrator approval", () => {
  assert.equal(
    changesRequireAdminApproval("view", { titulo: "Novo título" }),
    true,
  );
  assert.equal(
    changesRequireAdminApproval("propose", { titulo: "Novo título" }),
    true,
  );
});

test("publish mode allows non-sensitive changes directly", () => {
  assert.equal(
    changesRequireAdminApproval(
      "publish",
      { titulo: "Novo título", descricao: "Nova descrição" },
      { titulo: "Anterior", descricao: "Anterior" },
    ),
    false,
  );
});

test("publish mode requires approval when a sensitive value changes", () => {
  assert.equal(
    changesRequireAdminApproval(
      "publish",
      { estado: "ganhou", valorPrevisto: 1500 },
      { estado: "novo", valorPrevisto: "1000" },
    ),
    true,
  );
});

test("unchanged sensitive fields do not force approval", () => {
  assert.equal(
    changesRequireAdminApproval(
      "publish",
      { estado: "novo", valorPrevisto: 1000, titulo: "Novo título" },
      { estado: "novo", valorPrevisto: "1000", titulo: "Anterior" },
    ),
    false,
  );
});
