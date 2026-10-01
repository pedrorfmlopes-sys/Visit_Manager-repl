import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { isAuthenticated } from "../replitAuth";
import {
  isUploadOwnedByEmpresa,
  legacyUploadsDir,
  uploadsDir,
} from "../uploads";

const router = Router();

/**
 * GET /uploads/:filename
 * Serve apenas ficheiros referenciados por dados da empresa autenticada.
 */
router.get("/:filename", isAuthenticated, async (req: Request, res: Response) => {
  const { filename } = req.params;
  const empresaId = (req as any).session?.user?.empresaId;

  if (!filename) {
    return res.status(400).json({ message: "Missing filename" });
  }
  if (!empresaId) {
    return res.status(403).json({ message: "User has no company assigned" });
  }

  const safeFilename = path.basename(filename);
  if (safeFilename !== filename) {
    return res.status(400).json({ message: "Invalid filename" });
  }

  if (!(await isUploadOwnedByEmpresa(safeFilename, empresaId))) {
    return res.status(404).json({ message: "File not found" });
  }

  const candidates = [
    path.join(uploadsDir, safeFilename),
    path.join(legacyUploadsDir, safeFilename),
  ];
  const filePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    return res.status(404).json({ message: "File not found" });
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Security-Policy",
    "sandbox; default-src 'none'; style-src 'unsafe-inline'",
  );
  return res.sendFile(filePath);
});

export default router;
