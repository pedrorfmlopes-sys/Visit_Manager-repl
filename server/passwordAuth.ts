import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const FORMAT = "scrypt-v1";
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

function deriveKey(password: string, salt: Buffer, keyLength: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      SCRYPT_OPTIONS,
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(password, salt, KEY_LENGTH);

  return [
    FORMAT,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join(":");
}

export async function verifyPassword(password: string, storedHash: string) {
  const [format, encodedSalt, encodedKey, extra] = storedHash.split(":");
  if (format !== FORMAT || !encodedSalt || !encodedKey || extra !== undefined) {
    return false;
  }

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const storedKey = Buffer.from(encodedKey, "base64url");
    if (salt.length !== 16 || storedKey.length !== KEY_LENGTH) {
      return false;
    }

    const derivedKey = await deriveKey(password, salt, storedKey.length);
    return timingSafeEqual(storedKey, derivedKey);
  } catch {
    return false;
  }
}
