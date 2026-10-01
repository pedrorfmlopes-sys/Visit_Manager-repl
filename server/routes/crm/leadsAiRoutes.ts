import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { getUserContext } from "../../authContext";
import {
  assertEmpresaModuleEnabled,
  buildModuleDisabledResponse,
  isModuleDisabledError,
} from "../../modules";
import { uploadsDir } from "../../uploads";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    callback(null, file.mimetype.startsWith("audio/"));
  },
});

export function leadsAiRoutes(app: express.Express) {
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (!req.session?.user) {
      return res.status(401).json({ success: false, message: "Nao autenticado" });
    }
    next();
  };

  app.post(
    "/api/crm/leads/ai/transcribe",
    isAuthenticated,
    upload.single("file"),
    async (req: any, res: any) => {
      let filePath: string | null = null;

      try {
        const { empresaId, userId } = await getUserContext(req);

        if (!empresaId || !userId) {
          return res.status(400).json({
            success: false,
            message: "Contexto de utilizador/empresa em falta",
          });
        }

        await assertEmpresaModuleEnabled(empresaId, "ai");

        if (!req.file?.buffer) {
          return res.status(400).json({
            success: false,
            message: "Nenhum ficheiro de audio enviado",
          });
        }

        const ext = req.file.originalname?.split(".").pop() || "webm";
        const tempName = `lead-audio-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}.${ext}`;
        filePath = path.join(uploadsDir, tempName);

        await fs.promises.writeFile(filePath, req.file.buffer);

        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
          return res.status(500).json({
            success: false,
            message: "OpenAI nao esta configurado no servidor",
          });
        }

        const { OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey: openaiApiKey });
        const stream = fs.createReadStream(filePath);

        const transcription = await client.audio.transcriptions.create({
          file: stream as any,
          model: "whisper-1",
          language: "pt",
        });

        return res.json({
          success: true,
          text: (transcription as any).text ?? String(transcription ?? ""),
        });
      } catch (error: any) {
        if (isModuleDisabledError(error)) {
          return res.status(403).json(buildModuleDisabledResponse(error));
        }

        console.error("[leadsAiRoutes] Erro a transcrever audio:", error);
        return res.status(500).json({
          success: false,
          message:
            error?.message ||
            "Erro interno ao transcrever audio. Ver logs do servidor.",
        });
      } finally {
        if (filePath) {
          try {
            await fs.promises.unlink(filePath);
          } catch (cleanupError) {
            console.warn(
              "[leadsAiRoutes] Falha ao apagar ficheiro temporario:",
              cleanupError,
            );
          }
        }
      }
    },
  );
}
