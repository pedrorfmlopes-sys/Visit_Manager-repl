import assert from "node:assert/strict";
import test from "node:test";
import {
  createPasswordResetToken,
  hashResetToken,
  isResetTokenShapeValid,
  PASSWORD_RESET_TTL_MS,
} from "../../server/passwordReset";

test("password reset tokens are random, hashed and short-lived", () => {
  const first = createPasswordResetToken();
  const second = createPasswordResetToken();

  assert.notEqual(first.token, second.token);
  assert.notEqual(first.tokenHash, second.tokenHash);
  assert.equal(first.tokenHash, hashResetToken(first.token));
  assert.equal(first.tokenHash.includes(first.token), false);
  assert.equal(isResetTokenShapeValid(first.token), true);

  const remaining = first.expiresAt.getTime() - Date.now();
  assert.ok(remaining <= PASSWORD_RESET_TTL_MS);
  assert.ok(remaining > PASSWORD_RESET_TTL_MS - 5_000);
});

test("password reset token shape rejects malformed input", () => {
  assert.equal(isResetTokenShapeValid("short"), false);
  assert.equal(isResetTokenShapeValid("a".repeat(43)), true);
  assert.equal(isResetTokenShapeValid(`${"a".repeat(42)}!`), false);
});
