import fs from "fs";
import path from "path";
import { and, arrayContains, eq, inArray, or } from "drizzle-orm";
import { db } from "./db";
import {
  empresas,
  entidades,
  marcas,
  visitas,
  visitasAudio,
} from "@shared/schema";

export const uploadsDir = path.resolve(
  process.env.UPLOADS_DIR?.trim() || path.join(process.cwd(), "uploads"),
);
export const legacyUploadsDir = path.resolve("/tmp/uploads");

fs.mkdirSync(uploadsDir, { recursive: true });

export function getUploadFilename(fileUrl: string | null | undefined) {
  if (!fileUrl) return null;

  const pathname = fileUrl.split(/[?#]/, 1)[0].replace(/\\/g, "/");
  const prefixes = ["/uploads/", "/api/uploads/"];
  const prefix = prefixes.find((candidate) => pathname.startsWith(candidate));
  if (!prefix) return null;

  const filename = pathname.slice(prefix.length);
  if (!filename || path.basename(filename) !== filename) return null;
  return filename;
}

export async function isUploadOwnedByEmpresa(
  filename: string,
  empresaId: string,
): Promise<boolean> {
  if (path.basename(filename) !== filename) return false;
  const fileUrl = `/uploads/${filename}`;
  const compatibleFileUrls = [fileUrl, `/api/uploads/${filename}`];

  const [companyRows, entityRows, brandRows, visitRows, audioRows] =
    await Promise.all([
      db
        .select({ id: empresas.id })
        .from(empresas)
        .where(
          and(
            eq(empresas.id, empresaId),
            inArray(empresas.logoUrl, compatibleFileUrls),
          ),
        )
        .limit(1),
      db
        .select({ id: entidades.id })
        .from(entidades)
        .where(
          and(
            eq(entidades.empresaId, empresaId),
            inArray(entidades.logoUrl, compatibleFileUrls),
          ),
        )
        .limit(1),
      db
        .select({ id: marcas.id })
        .from(marcas)
        .where(
          and(
            eq(marcas.empresaId, empresaId),
            inArray(marcas.logoUrl, compatibleFileUrls),
          ),
        )
        .limit(1),
      db
        .select({ id: visitas.id })
        .from(visitas)
        .where(
          and(
            eq(visitas.empresaId, empresaId),
            or(
              inArray(visitas.audioUrl, compatibleFileUrls),
              arrayContains(visitas.mediaUrls, [fileUrl]),
              arrayContains(visitas.mediaUrls, [`/api/uploads/${filename}`]),
            ),
          ),
        )
        .limit(1),
      db
        .select({ id: visitasAudio.id })
        .from(visitasAudio)
        .where(
          and(
            eq(visitasAudio.empresaId, empresaId),
            inArray(visitasAudio.fileUrl, compatibleFileUrls),
          ),
        )
        .limit(1),
    ]);

  return (
    companyRows.length > 0 ||
    entityRows.length > 0 ||
    brandRows.length > 0 ||
    audioRows.length > 0 ||
    visitRows.length > 0
  );
}

export async function removeUploadByUrl(
  fileUrl: string | null | undefined,
): Promise<boolean> {
  const filename = getUploadFilename(fileUrl);
  if (!filename) return false;

  let removed = false;
  for (const directory of [uploadsDir, legacyUploadsDir]) {
    const candidate = path.resolve(directory, filename);
    if (path.dirname(candidate) !== directory) continue;

    try {
      await fs.promises.unlink(candidate);
      removed = true;
    } catch (error: any) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return removed;
}

export async function removeUploadsByUrl(
  fileUrls: Array<string | null | undefined>,
): Promise<void> {
  await Promise.all(Array.from(new Set(fileUrls)).map(removeUploadByUrl));
}

export async function isSupportedUploadedFile(
  filePath: string,
  expectedKind: "logo" | "audio" | "media",
): Promise<boolean> {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(32);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const header = buffer.subarray(0, bytesRead);
    const ascii = header.toString("ascii");

    const isPng =
      header.length >= 8 &&
      header.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    const isJpeg =
      header.length >= 3 &&
      header[0] === 0xff &&
      header[1] === 0xd8 &&
      header[2] === 0xff;
    const isGif = ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a");
    const isWebp =
      ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
    const isWave =
      ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE";
    const isOgg = ascii.startsWith("OggS");
    const isWebm =
      header.length >= 4 &&
      header[0] === 0x1a &&
      header[1] === 0x45 &&
      header[2] === 0xdf &&
      header[3] === 0xa3;
    const isMp3 =
      ascii.startsWith("ID3") ||
      (header.length >= 2 && header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
    const isIsoMedia =
      header.length >= 12 && ascii.slice(4, 8) === "ftyp";

    if (expectedKind === "logo") {
      return isPng || isJpeg || isWebp;
    }
    if (expectedKind === "audio") {
      return isWave || isOgg || isWebm || isMp3 || isIsoMedia;
    }
    return isPng || isJpeg || isGif || isWebp || isWebm || isIsoMedia;
  } finally {
    await handle.close();
  }
}
