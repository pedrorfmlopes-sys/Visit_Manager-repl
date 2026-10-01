import { createHash, randomBytes } from "node:crypto";

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export function hashResetToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createPasswordResetToken() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  };
}

export function isResetTokenShapeValid(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
