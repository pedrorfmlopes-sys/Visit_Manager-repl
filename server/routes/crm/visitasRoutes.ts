// server/routes/crm/visitasRoutes.ts
import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { randomUUID } from "crypto";
import { storage } from "../../storage";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { generateVisitSummary, transcribeAudio } from "../../openai";
import { sendVisitEmail } from "../../email";
import {
  isSupportedUploadedFile,
  removeUploadByUrl,
  removeUploadsByUrl,
  uploadsDir,
} from "../../uploads";
import { assertTenantReferences } from "../../tenantValidation";

// ----------------------
// Multer setup
// ----------------------
const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 11,
  },
});

function getRequestUploadFiles(req: any): Express.Multer.File[] {
  if (req.file) return [req.file];
  if (!req.files || Array.isArray(req.files)) return req.files ?? [];
  return Object.values(req.files).flat() as Express.Multer.File[];
}

async function cleanupRequestUploads(req: any): Promise<void> {
  await Promise.all(
    getRequestUploadFiles(req).map((file) =>
      fs.promises.unlink(file.path).catch((error: any) => {
        if (error?.code !== "ENOENT") {
          console.error("Failed to clean uploaded file:", error);
        }
      }),
    ),
  );
}

async function hasInvalidVisitUpload(
  files: Express.Multer.File[],
): Promise<boolean> {
  const validity = await Promise.all(files.map(async (file) => {
    if (file.fieldname === "audio") {
      return (
        file.mimetype.startsWith("audio/") &&
        (await isSupportedUploadedFile(file.path, "audio"))
      );
    }
    if (file.fieldname === "media") {
      return (
        (file.mimetype.startsWith("image/") ||
          file.mimetype.startsWith("video/")) &&
        (await isSupportedUploadedFile(file.path, "media"))
      );
    }
    return false;
  }));
  return validity.some((isValid) => !isValid);
}

function parseIdArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

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
  // GET /api/visitas/:id — Detalhe JSON
  // =====================================================
  app.get("/api/visitas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      if (!empresaId || !userId || !userRole) {
        return res
          .status(400)
          .json({ message: "Contexto de utilizador/empresa em falta" });
      }

      const visita = await storage.getVisita(
        req.params.id,
        empresaId,
        userId,
        userRole,
      );

      if (!visita) {
        return res.status(404).json({ message: "Visita not found" });
      }

      return res.json(visita);
    } catch (error) {
      console.error("Error fetching visita detail:", error);
      return res
        .status(500)
        .json({ message: "Failed to fetch visita detail" });
    }
  });

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
        userRole,
      );
      if (!visita)
        return res.status(404).json({ message: "Visita not found" });

      const tarefas = await storage.getTarefas(empresaId, userId, userRole);
      const visitaTarefas = tarefas.filter(
        (t: any) => t.visitaId === req.params.id,
      );

      const { generateVisitaPDF } = await import("../../pdfGenerator");
      const pdfBuffer = await generateVisitaPDF(visita, visitaTarefas);

      const entidadeNome = visita.entidade?.nome || "visita";
      const dataVisita = new Date(visita.dataVisita)
        .toISOString()
        .split("T")[0];
      const fileName = `Visita-${entidadeNome.replace(
        /\s/g,
        "-",
      )}-${dataVisita}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
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
        userRole,
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
        `attachment; filename="${fileName}"`,
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
          userRole,
        );
        if (!visita) {
          await cleanupRequestUploads(req);
          return res.status(404).json({ message: "Visita not found" });
        }

        if (!req.file)
          return res.status(400).json({ message: "No audio file" });
        if (
          !req.file.mimetype.startsWith("audio/") ||
          !(await isSupportedUploadedFile(req.file.path, "audio"))
        ) {
          await cleanupRequestUploads(req);
          return res.status(400).json({ message: "Invalid audio file type" });
        }

        const fileUrl = `/uploads/${req.file.filename}`;

        const audioRecord = await storage.addAudioToVisita(
          req.params.id,
          fileUrl,
          empresaId,
        );

        res.json(audioRecord);
      } catch (error) {
        console.error("Error uploading audio:", error);
        await cleanupRequestUploads(req);
        res.status(500).json({ message: "Failed to upload audio" });
      }
    },
  );

  // Listar audios
  app.get("/api/visitas/:id/audio", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);
      const visita = await storage.getVisita(
        req.params.id,
        empresaId,
        userId,
        userRole,
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
          userRole,
        );
        if (!visita)
          return res.status(404).json({ message: "Visita not found" });

        const audioRecord = (
          await storage.getVisitasAudio(req.params.id, empresaId)
        ).find((audio) => audio.id === req.params.audioId);
        if (!audioRecord) {
          return res.status(404).json({ message: "Audio not found" });
        }

        await storage.deleteVisitasAudio(req.params.audioId, empresaId);
        await removeUploadByUrl(audioRecord.fileUrl).catch((error) => {
          console.error("Failed to remove deleted audio file:", error);
        });

        res.json({ message: "Audio deleted" });
      } catch (error) {
        console.error("Error deleting audio:", error);
        res.status(500).json({ message: "Failed to delete audio" });
      }
    },
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
          userRole,
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
          (a: any) => a.id === req.params.audioId,
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
          (transcription as any).text ?? String(transcription ?? ""),
        );

        res.json(updated);
      } catch (error) {
        console.error("Error transcribing audio:", error);
        res.status(500).json({ message: "Failed to transcribe audio" });
      }
    },
  );

  // =====================================================
  // GET /api/visitas — Listar visitas com filtros
  // =====================================================
  app.get("/api/visitas", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      if (!empresaId || !userId || !userRole) {
        return res
          .status(400)
          .json({ message: "Contexto de utilizador/empresa em falta" });
      }

      const scope = userRole === "admin" ? "admin" : "agent";

      const {
        entidadeId,
        contactoId,
        dataInicio,
        dataFim,
        from,
        to,
        status,
      } = req.query as {
        entidadeId?: string;
        contactoId?: string;
        dataInicio?: string;
        dataFim?: string;
        from?: string;
        to?: string;
        status?: string;
      };

      // Carregar visitas do storage (já com relações e respeitando scope)
      let visitas =
        ((await storage.getVisitas(
          empresaId,
          userId,
          scope,
        )) as any[]) || [];

      // Filtro por entidade
      if (entidadeId) {
        visitas = visitas.filter(
          (v: any) => v.entidadeId && v.entidadeId === entidadeId,
        );
      }

      // Filtro por contacto
      if (contactoId) {
        visitas = visitas.filter(
          (v: any) => v.contactoId && v.contactoId === contactoId,
        );
      }

      // Filtro por data (from/to + dataInicio/dataFim)
      const fromParam = from || dataInicio;
      const toParam = to || dataFim;

      if (fromParam || toParam) {
        const fromDate = fromParam ? new Date(fromParam) : undefined;
        const toDate = toParam ? new Date(toParam) : undefined;

        visitas = visitas.filter((v: any) => {
          const rawDate =
            v.dataVisita ??
            v.data ??
            v.dataVisitaInicio ??
            v.createdAt ??
            v.updatedAt;

          if (!rawDate) return false;
          const d = new Date(rawDate);
          if (Number.isNaN(d.getTime())) return false;
          if (fromDate && d < fromDate) return false;
          if (toDate && d > toDate) return false;
          return true;
        });
      }

      // Filtro por status (se usado no futuro)
      if (status) {
        visitas = visitas.filter(
          (v: any) => v.status && v.status === status,
        );
      }

      return res.json(visitas);
    } catch (error) {
      console.error("Error in GET /api/visitas:", error);
      return res.status(500).json({ message: "Failed to list visitas" });
    }
  });

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
        const uploadedFiles = getRequestUploadFiles(req);
        if (await hasInvalidVisitUpload(uploadedFiles)) {
          await cleanupRequestUploads(req);
          return res.status(400).json({ message: "Invalid upload file type" });
        }

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
        const marcasIds = parseIdArray(req.body.marcasIds);
        const contactosIds = parseIdArray(req.body.contactosIds);
        await assertTenantReferences(empresaId, {
          entidadeId: req.body.entidadeId,
          contactoId: req.body.contactoId,
          visitaAnteriorId: req.body.visitaAnteriorId,
          contactosIds,
          marcasIds,
        });

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
          proximityAlertsEnabled:
            req.body.proximityAlertsEnabled === "true" ||
            req.body.proximityAlertsEnabled === true,
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
            const transcription = await transcribeAudio(audioFile.path);
            visitaData.transcricaoAudio = transcription.text || null;
          } catch (error) {
            console.error("Error transcribing uploaded visit audio:", error);
          }
        }

        if (files?.media) {
          visitaData.mediaUrls = files.media.map(
            (f: any) => `/uploads/${f.filename}`,
          );
        }

        const visita = await storage.createVisita(
          visitaData as any,
          empresaId,
        );

        if (req.body.marcasIds) {
          await storage.addMarcasToVisita(visita.id, marcasIds, empresaId);
        }

        if (req.body.contactosIds) {
          await storage.addContactosToVisita(
            visita.id,
            contactosIds,
            empresaId,
          );
        }

        try {
          const full = await storage.getVisita(
            visita.id,
            empresaId,
            userId,
            userRole,
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
              userRole,
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
      } catch (error: any) {
        console.error("Error creating visita:", error);
        await cleanupRequestUploads(req);
        res
          .status(error?.status ?? 500)
          .json({ message: error?.message ?? "Failed to create visita" });
      }
    },
  );

  // =====================================================
  // PATCH /api/visitas/:id — Atualizar visita
  // =====================================================
  app.patch("/api/visitas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);
      const contactosIds = parseIdArray(req.body.contactosIds);
      const marcasIds = parseIdArray(req.body.marcasIds);
      await assertTenantReferences(empresaId, {
        entidadeId: req.body.entidadeId,
        contactoId: req.body.contactoId,
        visitaAnteriorId: req.body.visitaAnteriorId,
        contactosIds,
        marcasIds,
      });

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
      if (req.body.proximityAlertsEnabled !== undefined) {
        updates.proximityAlertsEnabled =
          req.body.proximityAlertsEnabled === true ||
          req.body.proximityAlertsEnabled === "true";
      }

      const updated = await storage.updateVisita(
        req.params.id,
        updates,
        empresaId,
        userId,
        userRole,
      );

      if (!updated) {
        return res.status(404).json({ message: "Visita not found" });
      }

      // Atualizar contactos da visita
      if (req.body.contactosIds !== undefined) {
        await storage.addContactosToVisita(
          req.params.id,
          contactosIds,
          empresaId,
        );
      }

      // Atualizar marcas associadas a visita
      if (req.body.marcasIds !== undefined) {
        await storage.addMarcasToVisita(
          req.params.id,
          marcasIds,
          empresaId,
        );
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating visita:", error);
      res
        .status(error?.status ?? 500)
        .json({ message: error?.message ?? "Failed to update visita" });
    }
  });

  // =====================================================
  // DELETE /api/visitas/:id — Apagar
  // =====================================================
  app.delete("/api/visitas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);
      const visita = await storage.getVisita(
        req.params.id,
        empresaId,
        userId,
        userRole,
      );
      if (!visita) {
        return res.status(404).json({ message: "Visita not found" });
      }
      const audioRecords = await storage.getVisitasAudio(
        req.params.id,
        empresaId,
      );

      await storage.deleteVisita(
        req.params.id,
        empresaId,
        userId,
        userRole,
      );
      await removeUploadsByUrl([
        visita.audioUrl,
        ...(visita.mediaUrls ?? []),
        ...audioRecords.map((audio) => audio.fileUrl),
      ]).catch((error) => {
        console.error("Failed to remove deleted visit files:", error);
      });

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

        let visitas = await storage.getVisitas(empresaId, userId, userRole);

        if (entidadeId) {
          visitas = visitas.filter((v: any) => v.entidadeId === entidadeId);
        }

        const results = visitas
          .filter(
            (v: any) =>
              (v.notas || "").toLowerCase().includes(q) ||
              (v.entidade?.nome || "").toLowerCase().includes(q),
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
    },
  );

  // =====================================================
  // Visitas por proximidade GPS
  // =====================================================
  app.post(
    "/api/visitas/proximidade",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { empresaId, userId, userRole } = await getUserContext(req);

        const { lat, lng } = req.body;
        if (typeof lat !== "number" || typeof lng !== "number") {
          return res.status(400).json({ message: "Invalid coordinates" });
        }

        const empresa = await storage.getEmpresa(empresaId);
        const gpsSettings = ((empresa as any)?.uiSettings?.gpsProximity ?? {}) as {
          inactivityDays?: number;
        };
        const result = await storage.getNearbyVisitSuggestions(
          empresaId,
          lat,
          lng,
          {
            userId,
            userRole,
            inactivityDays: Number(gpsSettings.inactivityDays) || 60,
          },
        );

        res.json({
          ...result,
          sugestao: result.suggestions[0] ?? null,
        });
      } catch (error) {
        console.error("Error getting nearby suggestions:", error);
        res.status(500).json({ message: "Failed to get nearby suggestions" });
      }
    },
  );
}
