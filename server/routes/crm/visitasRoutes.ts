// server/routes/crm/visitasRoutes.ts
import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { randomUUID } from "crypto";
import { storage } from "../../storage";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { generateVisitSummary } from "../../openai";
import { sendVisitEmail } from "../../email";

// ----------------------
// Multer setup
// ----------------------
const uploadsDir = "/tmp/uploads";
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const upload = multer({
  dest: uploadsDir,
});

// ----------------------
// Middleware helpers
// ----------------------
const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.session?.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

async function getUserContext(req: any) {
  return {
    userId: req.session?.user?.id || null,
    role: req.session?.user?.role || null,
    userRole: req.session?.user?.role || null,
    empresaId: req.session?.user?.empresaId || null,
    empresa: req.session?.user?.empresa || null,
  };
}

export function visitasRoutes(app: express.Express) {
  // =====================================================
  // GET /api/visitas/:id/pdf — PDF normal
  // =====================================================
  app.get("/api/visitas/:id/pdf", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);

      const visita = await storage.getVisita(
        req.params.id,
        empresaId,
        userId,
        userRole
      );
      if (!visita)
        return res.status(404).json({ message: "Visita not found" });

      const tarefas = await storage.getTarefas(
        empresaId,
        userId,
        userRole
      );
      const visitaTarefas = tarefas.filter(
        (t: any) => t.visitaId === req.params.id
      );

      const { generateVisitaPDF } = await import("../../pdfGenerator");
      const pdfBuffer = await generateVisitaPDF(visita, visitaTarefas);

      const entidadeNome = visita.entidade?.nome || "visita";
      const dataVisita = new Date(visita.dataVisita)
        .toISOString()
        .split("T")[0];
      const fileName = `Visita-${entidadeNome.replace(
        /\s/g,
        "-"
      )}-${dataVisita}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );
      res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      console.error("Error generating visit PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // =====================================================
  // GET /api/visitas/:id/ics — ICS Calendar Export
  // =====================================================
  app.get("/api/visitas/:id/ics", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);

      const visita = await storage.getVisita(
        req.params.id,
        empresaId,
        userId,
        userRole
      );
      if (!visita)
        return res.status(404).json({ message: "Visita not found" });

      const { generateVisitaICS, generateVisitaICSFilename } = await import(
        "../../icsExport"
      );
      const content = generateVisitaICS(visita);
      const fileName = generateVisitaICSFilename(visita);

      res.setHeader("Content-Type", "text/calendar");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );
      res.send(content);
    } catch (error) {
      console.error("Error generating ICS:", error);
      res.status(500).json({ message: "Failed to generate ICS" });
    }
  });

  // =====================================================
  // AUDIO — upload / list / delete / transcrever
  // =====================================================

  // Upload audio
  app.post(
    "/api/visitas/:id/audio",
    isAuthenticated,
    upload.single("audio"),
    async (req: any, res) => {
      try {
        const { empresaId, userId, userRole } = await getUserContext(req);
        const visita = await storage.getVisita(
          req.params.id,
          empresaId,
          userId,
          userRole
        );
        if (!visita)
          return res.status(404).json({ message: "Visita not found" });

        if (!req.file)
          return res.status(400).json({ message: "No audio file" });

        const fileUrl = `/uploads/${req.file.filename}`;

        const audioRecord = await storage.addAudioToVisita(
          req.params.id,
          fileUrl,
          empresaId
        );

        res.json(audioRecord);
      } catch (error) {
        console.error("Error uploading audio:", error);
        res.status(500).json({ message: "Failed to upload audio" });
      }
    }
  );

  // Listar audios
  app.get("/api/visitas/:id/audio", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);
      const visita = await storage.getVisita(
        req.params.id,
        empresaId,
        userId,
        userRole
      );
      if (!visita)
        return res.status(404).json({ message: "Visita not found" });

      const audios = await storage.getVisitasAudio(req.params.id, empresaId);
      res.json(audios);
    } catch (error) {
      console.error("Error fetching audio:", error);
      res.status(500).json({ message: "Failed to fetch audio" });
    }
  });

  // Apagar audio
  app.delete(
    "/api/visitas/:id/audio/:audioId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { empresaId, userId, userRole } = await getUserContext(req);

        const visita = await storage.getVisita(
          req.params.id,
          empresaId,
          userId,
          userRole
        );
        if (!visita)
          return res.status(404).json({ message: "Visita not found" });

        await storage.deleteVisitasAudio(req.params.audioId, empresaId);

        res.json({ message: "Audio deleted" });
      } catch (error) {
        console.error("Error deleting audio:", error);
        res.status(500).json({ message: "Failed to delete audio" });
      }
    }
  );

  // Transcrever audio
  app.post(
    "/api/visitas/:id/audio/:audioId/transcrever",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { empresaId, userId, userRole } = await getUserContext(req);

        const visita = await storage.getVisita(
          req.params.id,
          empresaId,
          userId,
          userRole
        );
        if (!visita)
          return res.status(404).json({ message: "Visita not found" });

        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey)
          return res.status(500).json({ message: "OpenAI not configured" });

        const { OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey: openaiApiKey });

        const all = await storage.getVisitasAudio(req.params.id, empresaId);
        const audioRecord = all.find(
          (a: any) => a.id === req.params.audioId
        );

        if (!audioRecord?.fileUrl) {
          return res.status(404).json({ message: "Audio not found" });
        }

        const filename = audioRecord.fileUrl.split("/").pop();
        const filePath = path.join(uploadsDir, filename!);

        if (!fs.existsSync(filePath)) {
          return res
            .status(404)
            .json({ message: "Audio file not on disk" });
        }

        const stream = fs.createReadStream(filePath);

        const transcription = await client.audio.transcriptions.create({
          file: stream as any,
          model: "whisper-1",
          language: "pt",
        });

        const updated = await storage.updateVisitasAudioTranscription(
          req.params.audioId,
          (transcription as any).text ?? String(transcription ?? "")
        );

        res.json(updated);
      } catch (error) {
        console.error("Error transcribing audio:", error);
        res.status(500).json({ message: "Failed to transcribe audio" });
      }
    }
  );

  // =====================================================
  // POST /api/visitas — Criar nova visita
  // =====================================================
  app.post(
    "/api/visitas",
    isAuthenticated,
    upload.fields([
      { name: "audio", maxCount: 1 },
      { name: "media", maxCount: 10 },
    ]),
    async (req: any, res) => {
      try {
        const { empresaId, userId, userRole } = await getUserContext(req);
        const files = req.files as any;

        let marcasEntregues: string[] = [];
        if (req.body.marcasEntregues) {
          try {
            const parsed = JSON.parse(req.body.marcasEntregues);
            if (Array.isArray(parsed)) marcasEntregues = parsed;
          } catch {}
        }

        let latitude: string | null = null;
        let longitude: string | null = null;
        let accuracy: string | null = null;

        if (req.body.latitude && req.body.longitude) {
          const lat = parseFloat(req.body.latitude);
          const lng = parseFloat(req.body.longitude);
          const acc = req.body.locationAccuracy
            ? parseFloat(req.body.locationAccuracy)
            : null;

          if (!isNaN(lat) && !isNaN(lng)) {
            latitude = String(lat);
            longitude = String(lng);
            accuracy = acc && !isNaN(acc) ? String(acc) : null;
          }
        }

        const visitaData = {
          entidadeId: req.body.entidadeId || null,
          contactoId: req.body.contactoId || null,
          userId,
          createdByUserId: userId,
          dataVisita: new Date(req.body.dataVisita),
          notas: req.body.notas || null,
          marcasEntregues,
          latitude,
          longitude,
          locationAccuracy: accuracy,
          mediaUrls: [] as string[],
          audioUrl: null as string | null,
          transcricaoAudio: null as string | null,
          resumoIa: null as string | null,
          proximaVisita: req.body.proximaVisita
            ? new Date(req.body.proximaVisita)
            : null,
          linkVisita: randomUUID().substring(0, 8),
          visitaAnteriorId: req.body.visitaAnteriorId || null,
        };

        if (files?.audio?.[0]) {
          const audioFile = files.audio[0];
          visitaData.audioUrl = `/uploads/${audioFile.filename}`;

          try {
            const transcription: any = await generateVisitSummary({
              notas: (visitaData.notas as string | null) ?? undefined,
              entidadeNome: "",
            } as any);
            visitaData.transcricaoAudio =
              typeof transcription === "string"
                ? transcription
                : transcription?.text ?? "";
          } catch {}
        }

        if (files?.media) {
          visitaData.mediaUrls = files.media.map(
            (f: any) => `/uploads/${f.filename}`
          );
        }

        const visita = await storage.createVisita(
          visitaData as any,
          empresaId
        );

        if (req.body.marcasIds) {
          try {
            const ids = Array.isArray(req.body.marcasIds)
              ? req.body.marcasIds
              : JSON.parse(req.body.marcasIds);
            await storage.addMarcasToVisita(visita.id, ids, empresaId);
          } catch {}
        }

        if (req.body.contactosIds) {
          try {
            const ids = Array.isArray(req.body.contactosIds)
              ? req.body.contactosIds
              : JSON.parse(req.body.contactosIds);
            await storage.addContactosToVisita(
              visita.id,
              ids,
              empresaId
            );
          } catch {}
        }

        try {
          const full = await storage.getVisita(
            visita.id,
            empresaId,
            userId,
            userRole
          );

          if (full) {
            const summary: any = await generateVisitSummary({
              notas: (visitaData.notas as string | null) ?? undefined,
              transcricaoAudio:
                (visitaData.transcricaoAudio as string | null) ?? undefined,
              marcasEntregues,
              entidadeNome: full.entidade?.nome ?? "",
              contactoNome: full.contacto?.nome ?? undefined,
            } as any);

            await storage.updateVisita(
              visita.id,
              {
                resumoIa:
                  typeof summary === "string"
                    ? summary
                    : summary?.text ?? "",
              } as any,
              empresaId,
              userId,
              userRole
            );

            const user = await storage.getUser(userId);
            if (user?.email) {
              await sendVisitEmail({
                toEmail: user.email,
                entidadeNome: full.entidade?.nome ?? "",
                contactoNome: full.contacto?.nome ?? undefined,
                dataVisita: visitaData.dataVisita,
                notas:
                  (visitaData.notas as string | null) ?? undefined,
                marcasEntregues,
                resumoIa:
                  typeof summary === "string"
                    ? summary
                    : summary?.text ?? undefined,
                linkVisita: `${req.protocol}://${req.hostname}/visitas/${visita.id}`,
              } as any);
            }
          }
        } catch (e) {
          console.error("AI summary or email error:", e);
        }

        res.json(visita);
      } catch (error) {
        console.error("Error creating visita:", error);
        res.status(500).json({ message: "Failed to create visita" });
      }
    }
  );

  // =====================================================
  // PATCH /api/visitas/:id — Atualizar visita
  // =====================================================
  app.patch("/api/visitas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      const updates: any = {};

      if (req.body.dataVisita !== undefined) {
        updates.dataVisita = new Date(req.body.dataVisita);
      }
      if (req.body.proximaVisita !== undefined) {
        updates.proximaVisita = req.body.proximaVisita
          ? new Date(req.body.proximaVisita)
          : null;
      }
      if (req.body.proximaVisitaStatus !== undefined) {
        updates.proximaVisitaStatus = req.body.proximaVisitaStatus;
      }
      if (req.body.proximaVisitaStatusData !== undefined) {
        updates.proximaVisitaStatusData = req.body.proximaVisitaStatusData
          ? new Date(req.body.proximaVisitaStatusData)
          : null;
      }
      if (req.body.entidadeId !== undefined) {
        updates.entidadeId = req.body.entidadeId;
      }
      if (req.body.contactoId !== undefined) {
        updates.contactoId = req.body.contactoId || null;
      }
      if (req.body.visitaAnteriorId !== undefined) {
        updates.visitaAnteriorId = req.body.visitaAnteriorId || null;
      }
      if (req.body.notas !== undefined) {
        updates.notas = req.body.notas || null;
      }
      if (req.body.marcasEntregues !== undefined) {
        updates.marcasEntregues = req.body.marcasEntregues || [];
      }
      if (req.body.tarefasSugeridasIA !== undefined) {
        updates.tarefasSugeridasIA = req.body.tarefasSugeridasIA;
      }

      const updated = await storage.updateVisita(
        req.params.id,
        updates,
        empresaId,
        userId,
        userRole
      );

      if (!updated) {
        return res.status(404).json({ message: "Visita not found" });
      }

      // Atualizar contactos da visita
      if (req.body.contactosIds !== undefined) {
        let ids: string[] = [];
        try {
          ids = Array.isArray(req.body.contactosIds)
            ? req.body.contactosIds
            : JSON.parse(req.body.contactosIds);
        } catch {}
        await storage.addContactosToVisita(req.params.id, ids, empresaId);
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating visita:", error);
      res.status(500).json({ message: "Failed to update visita" });
    }
  });

  // =====================================================
  // DELETE /api/visitas/:id — Apagar
  // =====================================================
  app.delete("/api/visitas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      await storage.deleteVisita(
        req.params.id,
        empresaId,
        userId,
        userRole
      );

      res.json({ message: "Visita deleted" });
    } catch (error) {
      console.error("Error deleting visita:", error);
      res.status(500).json({ message: "Failed to delete visita" });
    }
  });

  // =====================================================
  // CRM SEARCH — /api/crm/visitas/search
  // =====================================================
  app.get(
    "/api/crm/visitas/search",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { empresaId, userId, userRole } = await getUserContext(req);

        const q = ((req.query.q as string) || "").toLowerCase();
        const entidadeId = req.query.entidadeId as string | undefined;

        let visitas = await storage.getVisitas(
          empresaId,
          userId,
          userRole
        );

        if (entidadeId) {
          visitas = visitas.filter(
            (v: any) => v.entidadeId === entidadeId
          );
        }

        const results = visitas
          .filter(
            (v: any) =>
              (v.notas || "").toLowerCase().includes(q) ||
              (v.entidade?.nome || "").toLowerCase().includes(q)
          )
          .slice(0, 20)
          .map((v: any) => ({
            id: v.id,
            label: `${format(new Date(v.dataVisita), "yyyy-MM-dd", {
              locale: pt,
            })} – ${v.entidade?.nome}`,
            extraInfo: v.entidade?.nome,
            data: { entidadeNome: v.entidade?.nome, date: v.dataVisita },
          }));

        res.json(results);
      } catch (error) {
        console.error("Error searching visitas:", error);
        res.status(500).json({ message: "Failed to search visitas" });
      }
    }
  );

  // =====================================================
  // Visitas por proximidade GPS
  // =====================================================
  app.post(
    "/api/visitas/proximidade",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { empresaId } = await getUserContext(req);

        const { lat, lng } = req.body;
        if (typeof lat !== "number" || typeof lng !== "number") {
          return res.status(400).json({ message: "Invalid coordinates" });
        }

        const sugestao = await storage.getNearbyVisitSuggestions(
          empresaId,
          lat,
          lng,
          200
        );

        res.json({ sugestao });
      } catch (error) {
        console.error("Error getting nearby suggestions:", error);
        res.status(500).json({ message: "Failed to get nearby suggestions" });
      }
    }
  );
}
