import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";

const router = Router();

// Pasta onde os uploads do Multer ficam armazenados
const UPLOADS_DIR = "/tmp/uploads";

// Garantir que a pasta existe
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * GET /uploads/:filename
 * Permite aceder a ficheiros enviados (PDFs, imagens, áudio, etc.)
 * Neste momento **não** está a validar autenticação,
 * para evitar erro de import. Depois ligamos ao rbac.ts.
 */
router.get("/:filename", (req: Request, res: Response) => {
  const { filename } = req.params;

  if (!filename) {
    return res.status(400).json({ message: "Missing filename" });
  }

  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "File not found" });
  }

  return res.sendFile(filePath);
});

export default router;
