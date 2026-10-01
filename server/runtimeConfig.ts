type RuntimeEnvironment = NodeJS.ProcessEnv;

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

export function getProductionConfigErrors(
  env: RuntimeEnvironment = process.env,
): string[] {
  if (env.NODE_ENV !== "production") return [];

  const errors: string[] = [];
  const sessionSecret = env.SESSION_SECRET?.trim() ?? "";
  const encryptionKey = env.APP_ENCRYPTION_KEY?.trim() ?? "";

  if (!hasValue(env.DATABASE_URL)) errors.push("DATABASE_URL is required");
  if (sessionSecret.length < 32) {
    errors.push("SESSION_SECRET must contain at least 32 characters");
  }
  if (encryptionKey.length < 32) {
    errors.push("APP_ENCRYPTION_KEY must contain at least 32 characters");
  }
  if (sessionSecret && encryptionKey && sessionSecret === encryptionKey) {
    errors.push("APP_ENCRYPTION_KEY must be different from SESSION_SECRET");
  }

  try {
    const appUrl = new URL(env.APP_BASE_URL?.trim() ?? "");
    if (appUrl.protocol !== "https:") {
      errors.push("APP_BASE_URL must use HTTPS");
    }
  } catch {
    errors.push("APP_BASE_URL must be a valid absolute HTTPS URL");
  }

  const hasSmtp =
    hasValue(env.SMTP_FROM) &&
    (hasValue(env.SMTP_URL) || hasValue(env.SMTP_HOST));
  if (!hasSmtp) {
    errors.push(
      "SMTP_FROM and SMTP_URL or SMTP_HOST are required for account recovery",
    );
  }
  if (env.ENABLE_E2E_AUTH_HELPERS === "true") {
    errors.push("ENABLE_E2E_AUTH_HELPERS must not be enabled in production");
  }

  return errors;
}

export function validateRuntimeConfig(
  env: RuntimeEnvironment = process.env,
): void {
  const errors = getProductionConfigErrors(env);
  if (errors.length > 0) {
    throw new Error(
      `Unsafe or incomplete production configuration:\n- ${errors.join("\n- ")}`,
    );
  }
}
