import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
} from "../../server/secretCrypto";

process.env.APP_ENCRYPTION_KEY = "unit-test-encryption-key";

test("encrypts and decrypts secrets without exposing plaintext", () => {
  const plaintext = "sensitive-value";
  const encrypted = encryptSecret(plaintext);

  assert.equal(isEncryptedSecret(encrypted), true);
  assert.equal(encrypted.includes(plaintext), false);
  assert.equal(decryptSecret(encrypted), plaintext);
});

test("keeps legacy plaintext readable and does not encrypt twice", () => {
  const encrypted = encryptSecret("legacy-value");

  assert.equal(decryptSecret("legacy-value"), "legacy-value");
  assert.equal(encryptSecret(encrypted), encrypted);
});

test("rejects tampered encrypted values", () => {
  const encrypted = encryptSecret("protected");
  const parts = encrypted.split(".");
  const ciphertext = Buffer.from(parts[2], "base64url");
  ciphertext[0] ^= 1;
  parts[2] = ciphertext.toString("base64url");
  const tampered = parts.join(".");

  assert.throws(() => decryptSecret(tampered));
});
