import crypto from "crypto";

const PREFIX = "enc:v1:";

function getKey() {
  const secret =
    process.env.APP_ENCRYPTION_KEY?.trim() ||
    process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "APP_ENCRYPTION_KEY or SESSION_SECRET must be configured",
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function isEncryptedSecret(value: string) {
  return value.startsWith(PREFIX);
}

export function encryptSecret(value: string) {
  if (!value || isEncryptedSecret(value)) {
    return value;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return (
    PREFIX +
    [iv, authTag, encrypted]
      .map((part) => part.toString("base64url"))
      .join(".")
  );
}

export function decryptSecret(value: string) {
  if (!value || !isEncryptedSecret(value)) {
    return value;
  }

  const [ivValue, authTagValue, encryptedValue] = value
    .slice(PREFIX.length)
    .split(".");
  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Encrypted secret has an invalid format");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

