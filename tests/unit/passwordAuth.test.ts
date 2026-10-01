import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../../server/passwordAuth";

test("password hashes are salted and can be verified", async () => {
  const password = "Uma palavra-passe forte 2026";
  const firstHash = await hashPassword(password);
  const secondHash = await hashPassword(password);

  assert.notEqual(firstHash, secondHash);
  assert.equal(firstHash.includes(password), false);
  assert.equal(await verifyPassword(password, firstHash), true);
  assert.equal(await verifyPassword("palavra-passe errada", firstHash), false);
});

test("malformed password hashes are rejected", async () => {
  assert.equal(await verifyPassword("qualquer", "invalid"), false);
  assert.equal(await verifyPassword("qualquer", "scrypt-v1:bad:bad"), false);
});
