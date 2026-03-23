// server/routes/crm/leadsAiRoutes.ts
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { getUserContext } from "../../authContext";

const uploadsDir = "/tmp/uploads";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Guardar ficheiros em memória e depois escrever em disco
const upload = multer({
  storage: multer.memoryStorage(),
});

export function leadsAiRoutes(app: express.Express) {
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (!req.session?.user) {
      return res.status(401).json({ success: false, message: "Não autenticado" });
    }
    next();
  };

  // ========================================================
  // POST /api/crm/leads/ai/transcribe
  //  - recebe FormData com campo "file"
  //  - usa OpenAI Whisper para transcrever
  //  - devolve { success: true, text }
  // ========================================================
  app.post(
    "/api/crm/leads/ai/transcribe",
    isAuthenticated,
    upload.single("file"),
    async (req: any, res: any) => {
      try {
        const { empresaId, userId } = await getUserContext(req);

        if (!empresaId || !userId) {
          return res
            .status(400)
            .json({ success: false, message: "Contexto de utilizador/empresa em falta" });
        }

        if (!req.file || !req.file.buffer) {
          return res
            .status(400)
            .json({ success: false, message: "Nenhum ficheiro de áudio enviado" });
        }

        // Escrever ficheiro temporário em disco (como fazemos nas visitas)
        const ext = req.file.originalname?.split(".").pop() || "webm";
        const tempName = `lead-audio-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}.${ext}`;
        const filePath = path.join(uploadsDir, tempName);

        await fs.promises.writeFile(filePath, req.file.buffer);

        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
          console.error("[leadsAiRoutes] OPENAI_API_KEY em falta");
          return res.status(500).json({
            success: false,
            message: "OpenAI não está configurado no servidor",
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

        const text =
          (transcription as any).text ?? String(transcription ?? "");

        // Limpar ficheiro temporário (best effort)
        try {
          await fs.promises.unlink(filePath);
        } catch (e) {
          console.warn("[leadsAiRoutes] Falha ao apagar ficheiro temporário:", e);
        }

        return res.json({
          success: true,
          text,
        });
      } catch (error: any) {
        console.error("[leadsAiRoutes] Erro a transcrever áudio:", error);
        return res.status(500).json({
          success: false,
          message:
            error?.message ||
            "Erro interno ao transcrever áudio. Ver logs do servidor.",
        });
      }
    },
  );
}
