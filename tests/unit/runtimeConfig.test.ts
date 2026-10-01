import assert from "node:assert/strict";
import test from "node:test";
import {
  getProductionConfigErrors,
  validateRuntimeConfig,
} from "../../server/runtimeConfig";

const validProductionEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://example.test/visit_manager",
  SESSION_SECRET: "session-secret-with-more-than-32-characters",
  APP_ENCRYPTION_KEY: "different-encryption-key-with-32-characters",
  APP_BASE_URL: "https://visit.example.test",
  SMTP_FROM: "noreply@example.test",
  SMTP_HOST: "smtp.example.test",
  ENABLE_E2E_AUTH_HELPERS: "false",
};

test("runtime config remains permissive outside production", () => {
  assert.deepEqual(getProductionConfigErrors({ NODE_ENV: "development" }), []);
  assert.doesNotThrow(() =>
    validateRuntimeConfig({ NODE_ENV: "development" }),
  );
});

test("runtime config accepts a complete secure production environment", () => {
  assert.deepEqual(getProductionConfigErrors(validProductionEnv), []);
  assert.doesNotThrow(() => validateRuntimeConfig(validProductionEnv));
});

test("runtime config reports all critical production problems", () => {
  const errors = getProductionConfigErrors({
    NODE_ENV: "production",
    SESSION_SECRET: "short",
    APP_ENCRYPTION_KEY: "short",
    APP_BASE_URL: "http://visit.example.test",
    ENABLE_E2E_AUTH_HELPERS: "true",
  });

  assert.ok(errors.some((error) => error.includes("DATABASE_URL")));
  assert.ok(errors.some((error) => error.includes("SESSION_SECRET")));
  assert.ok(errors.some((error) => error.includes("APP_ENCRYPTION_KEY")));
  assert.ok(errors.some((error) => error.includes("HTTPS")));
  assert.ok(errors.some((error) => error.includes("SMTP")));
  assert.ok(errors.some((error) => error.includes("ENABLE_E2E_AUTH_HELPERS")));
});

test("runtime config requires separate session and encryption secrets", () => {
  const sharedSecret = "one-shared-secret-with-more-than-32-characters";
  const errors = getProductionConfigErrors({
    ...validProductionEnv,
    SESSION_SECRET: sharedSecret,
    APP_ENCRYPTION_KEY: sharedSecret,
  });

  assert.ok(errors.some((error) => error.includes("must be different")));
});
