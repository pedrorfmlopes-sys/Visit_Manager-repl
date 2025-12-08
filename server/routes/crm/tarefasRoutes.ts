// server/routes/crm/tarefasRoutes.ts
import express from "express";
import { storage } from "../../storage";
import { getUserContext } from "../../authContext";
import { generateAISummaryAndTasks } from "../../openai";

// Middleware simples – igual ao que usamos noutros routers CRM
const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.session?.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

export function tarefasRoutes(app: express.Express) {
  // ============================================================
  // GET /api/tarefas — Listar tarefas com filtros
  // ============================================================
  app.get("/api/tarefas", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      const filters = {
        status: req.query.status as string | undefined,
        assignedUserId: req.query.assignedUserId as string | undefined,
        entidadeId: req.query.entidadeId as string | undefined,
        visitaId: req.query.visitaId as string | undefined,
        overdue: req.query.overdue === "true",
      };

      let tarefas = await storage.getTarefas(
        empresaId!,
        userId!,
        userRole as "admin" | "agent",
        filters
      );

      // 🔎 Search simples em título / descrição / entidade
      const search = (req.query.search as string | undefined)?.toLowerCase();
      if (search) {
        tarefas = tarefas.filter((t: any) =>
          (t.titulo || "").toLowerCase().includes(search) ||
          (t.descricao || "").toLowerCase().includes(search) ||
          (t.entidade?.nome || "").toLowerCase().includes(search)
        );
      }

      res.json(tarefas);
    } catch (error) {
      console.error("Error fetching tarefas:", error);
      res.status(500).json({ message: "Failed to fetch tarefas" });
    }
  });

  // ============================================================
  // GET /api/tarefas/:id — Obter uma tarefa
  // ============================================================
  app.get("/api/tarefas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      const tarefa = await storage.getTarefa(
        req.params.id,
        empresaId!,
        userId!,
        userRole as "admin" | "agent"
      );

      if (!tarefa) {
        return res.status(404).json({ message: "Tarefa não encontrada" });
      }

      res.json(tarefa);
    } catch (error) {
      console.error("Error fetching tarefa:", error);
      res.status(500).json({ message: "Failed to fetch tarefa" });
    }
  });

  // ============================================================
  // POST /api/tarefas — Criar tarefa
  // ============================================================
  app.post("/api/tarefas", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, empresaId } = await getUserContext(req);
      const body = req.body || {};

      // Normalização básica dos campos (sem Zod, para não depender de ficheiros que não existem)
      const cleaned: any = {
        titulo: body.titulo,
        descricao: body.descricao ?? null,
        entidadeId: body.entidadeId || null,
        visitaId: body.visitaId || null,
        assignedUserId: body.assignedUserId || null,
        dueDate: body.dueDate || null,
        status: body.status ?? "pending",
        repeatInterval: body.repeatInterval ?? "none",
        createdByUserId: userId,
      };

      const tarefa = await storage.createTarefa(cleaned, empresaId!);
      res.json(tarefa);
    } catch (error) {
      console.error("Error creating tarefa:", error);
      res.status(400).json({ message: "Failed to create tarefa" });
    }
  });

  // ============================================================
  // PATCH /api/tarefas/:id — Atualizar tarefa
  // ============================================================
  app.patch("/api/tarefas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);
      const body = req.body || {};

      const cleaned: any = {
        ...body,
      };

      if ("entidadeId" in body) {
        cleaned.entidadeId = body.entidadeId || null;
      }
      if ("visitaId" in body) {
        cleaned.visitaId = body.visitaId || null;
      }
      if ("assignedUserId" in body) {
        cleaned.assignedUserId = body.assignedUserId || null;
      }
      if ("dueDate" in body) {
        cleaned.dueDate = body.dueDate || null;
      }

      const tarefa = await storage.updateTarefa(
        req.params.id,
        cleaned,
        empresaId!,
        userId!,
        userRole as "admin" | "agent"
      );

      if (!tarefa) {
        return res.status(404).json({ message: "Tarefa não encontrada" });
      }

      res.json(tarefa);
    } catch (error) {
      console.error("Error updating tarefa:", error);
      res.status(400).json({ message: "Failed to update tarefa" });
    }
  });

  // ============================================================
  // DELETE /api/tarefas/:id — Eliminar tarefa
  // ============================================================
  app.delete("/api/tarefas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      await storage.deleteTarefa(
        req.params.id,
        empresaId!,
        userId!,
        userRole as "admin" | "agent"
      );

      res.json({ message: "Tarefa eliminada" });
    } catch (error) {
      console.error("Error deleting tarefa:", error);
      res.status(500).json({ message: "Failed to delete tarefa" });
    }
  });

  // ============================================================
  // PLUS → IA SUGESTÕES (FASE 21)
  // ============================================================
  app.post(
    "/api/tarefas/ia/resumo",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { notas, entidadeNome, visitaNotas, transcricoes } = req.body;

        const {
          resumoIA,
          pontosChaveIA,
          tarefasSugeridasIA,
        } = await generateAISummaryAndTasks({
          entidadeNome: entidadeNome ?? "Sem entidade",
            notas: notas ?? visitaNotas ?? "",
            audioTranscricoes: transcricoes || [],
            dataVisita: new Date(),
        });

        res.json({
          resumoIA,
          pontosChaveIA,
          tarefasSugeridasIA,
        });
      } catch (error) {
        console.error("Error generating AI task summary:", error);
        res.status(500).json({ message: "Failed to generate AI summary" });
      }
    }
  );

  // ============================================================
  // MICROSOFT PLANNER / TO-DO (Opcional – mantido comentado)
  // ============================================================

  /*
  app.post("/api/microsoft/planner/export/:tarefaId", isAuthenticated, async (req, res) => {
    ...
  });

  app.post("/api/microsoft/todo/export/:tarefaId", isAuthenticated, async (req, res) => {
    ...
  });
  */
}
