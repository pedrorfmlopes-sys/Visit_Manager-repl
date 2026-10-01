// server/routes/ai/aiRoutes.ts
import express from "express";
import { getUserContext } from "../../authContext";
import {
  generateVisitSummary,
  generateAISummaryAndTasks,
  generateDashboardInsights,
} from "../../openai";
import { storage } from "../../storage";
import {
  assertEmpresaModuleEnabled,
  buildModuleDisabledResponse,
  isModuleDisabledError,
} from "../../modules";

const router = express.Router();

/**
 * POST /api/ai/visit-summary
 * Gera resumo da visita com IA
 */
router.post("/visit-summary", async (req: any, res) => {
  try {
    const { empresaId, userId, userRole } = await getUserContext(req);
    const { visitaId } = req.body;

    if (!empresaId) {
      return res
        .status(400)
        .json({ message: "User has no company assigned" });
    }
    await assertEmpresaModuleEnabled(empresaId, "ai");
    if (!visitaId) {
      return res.status(400).json({ message: "visitaId is required" });
    }

    const visita = await storage.getVisita(
      visitaId,
      empresaId,
      userId,
      userRole
    );

    if (!visita) {
      return res.status(404).json({ message: "Visita not found" });
    }

    const summary = await generateVisitSummary({
      notas: visita.notas || undefined,
      transcricaoAudio: (visita as any).transcricaoAudio || undefined,
      marcasEntregues: (visita as any).marcasEntregues || [],
      entidadeNome: visita.entidade?.nome || "",
      contactoNome: visita.contacto?.nome,
    });

    res.json({ success: true, resumo: summary });
  } catch (error) {
    if (isModuleDisabledError(error)) {
      return res.status(403).json(buildModuleDisabledResponse(error));
    }
    console.error("[AI] Error generating visit summary:", error);
    res.status(500).json({ message: "Failed to generate visit summary" });
  }
});

/**
 * POST /api/ai/visit-tasks
 * Gera resumo + tarefas sugeridas para uma visita
 */
router.post("/visit-tasks", async (req: any, res) => {
  try {
    const { empresaId, userId, userRole } = await getUserContext(req);
    const { visitaId } = req.body;

    if (!empresaId) {
      return res
        .status(400)
        .json({ message: "User has no company assigned" });
    }
    await assertEmpresaModuleEnabled(empresaId, "ai");
    if (!visitaId) {
      return res.status(400).json({ message: "visitaId is required" });
    }

    const visita = await storage.getVisita(
      visitaId,
      empresaId,
      userId,
      userRole
    );

    if (!visita) {
      return res.status(404).json({ message: "Visita not found" });
    }

    // No tipo VisitaWithRelations não há 'audios', por isso usamos só a transcrição principal
    const audioTranscricoes: string[] = [];
    const transcricao = (visita as any).transcricaoAudio;
    if (transcricao) {
      audioTranscricoes.push(String(transcricao));
    }

    const aiResult = await generateAISummaryAndTasks({
      entidadeNome: visita.entidade?.nome || "",
      contactoNome: visita.contacto?.nome,
      notas: visita.notas || undefined,
      audioTranscricoes,
      dataVisita: new Date(visita.dataVisita),
    });

    res.json({ success: true, ...aiResult });
  } catch (error) {
    if (isModuleDisabledError(error)) {
      return res.status(403).json(buildModuleDisabledResponse(error));
    }
    console.error("[AI] Error generating tasks:", error);
    res.status(500).json({ message: "Failed to generate tasks" });
  }
});

/**
 * POST /api/ai/dashboard-insights
 * Gera insights para o dashboard
 */
router.post("/dashboard-insights", async (req: any, res) => {
  try {
    const { empresaId } = await getUserContext(req);

    if (!empresaId) {
      return res
        .status(400)
        .json({ message: "User has no company assigned" });
    }
    await assertEmpresaModuleEnabled(empresaId, "ai");

    const { scope, metrics } = req.body;

    if (!metrics) {
      return res.status(400).json({ message: "metrics is required" });
    }

    const userName =
      req.session?.user?.firstName ||
      req.session?.user?.email ||
      "Utilizador";

    const insights = await generateDashboardInsights({
      // aqui mapeamos "empresa" para "admin" para bater certo com o tipo
      scope: scope === "empresa" ? "admin" : "agent",
      userName,
      metrics,
    });

    res.json({ success: true, insights });
  } catch (error) {
    if (isModuleDisabledError(error)) {
      return res.status(403).json(buildModuleDisabledResponse(error));
    }
    console.error("[AI] Error generating insights:", error);
    res
      .status(500)
      .json({ message: "Failed to generate dashboard insights" });
  }
});

export default router;
