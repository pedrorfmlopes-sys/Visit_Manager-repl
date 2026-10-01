// server/routes/crm/tarefasRoutes.ts
import express from "express";
import { storage } from "../../storage";
import { getUserContext } from "../../authContext";
import { generateAISummaryAndTasks } from "../../openai";
import { db } from "../../db";
import { tarefas, empresas } from "../../../shared/schema";
import { and, eq } from "drizzle-orm";
import { assertTenantReferences } from "../../tenantValidation";
import {
  createTaskFromVmTask,
  getOdooTaskById,
  getOdooConnectionForEmpresa,
  updateTaskFromVmTask,
} from "../../integrations/odooClient";

// Middleware simples – igual ao que usamos noutros routers CRM
const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.session?.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

export function tarefasRoutes(app: express.Express) {
  const normalizeDueDate = (value: unknown) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  };

  const parseOdooWriteDate = (value?: string | null) => {
    if (!value) return null;
    const normalized = value.includes("T") ? value : value.replace(" ", "T") + "Z";
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const isMissingOdooTaskError = (message?: string | null) => {
    const text = (message || "").toLowerCase();
    return (
      text.includes("missingerror") ||
      text.includes("does not exist") ||
      text.includes("has been deleted") ||
      text.includes("record not found") ||
      text.includes("not found")
    );
  };

  const buildTaskUpdateFromOdoo = (odooTask: {
    name: string;
    descriptionHtml: string | null;
    dueDate: string | null;
  }) => {
    const dueDate = odooTask.dueDate ? new Date(`${odooTask.dueDate}T00:00:00`) : null;
    return {
      titulo: odooTask.name,
      descricao: odooTask.descriptionHtml ?? null,
      dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null,
      updatedAt: new Date(),
      lastSyncAt: new Date(),
      syncStatus: "synced" as const,
      syncError: null,
    };
  };

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
      await assertTenantReferences(empresaId!, {
        entidadeId: body.entidadeId,
        visitaId: body.visitaId,
        assignedUserId: body.assignedUserId,
      });

      // Normalização básica dos campos (sem Zod, para não depender de ficheiros que não existem)
      const cleaned: any = {
        titulo: body.titulo,
        descricao: body.descricao ?? null,
        entidadeId: body.entidadeId || null,
        visitaId: body.visitaId || null,
        assignedUserId: body.assignedUserId || null,
        dueDate: normalizeDueDate(body.dueDate),
        status: body.status ?? "pending",
        repeatInterval: body.repeatInterval ?? "none",
        createdByUserId: userId,
      };

      const tarefa = await storage.createTarefa(cleaned, empresaId!, userId!);
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
      await assertTenantReferences(empresaId!, {
        entidadeId: body.entidadeId,
        visitaId: body.visitaId,
        assignedUserId: body.assignedUserId,
      });

      const cleaned: any = {
        ...body,
      };
      delete cleaned.id;
      delete cleaned.empresaId;
      delete cleaned.createdByUserId;

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
        cleaned.dueDate = normalizeDueDate(body.dueDate);
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

  app.post("/api/tarefas/:id/odoo/sync", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      const tarefa = await storage.getTarefa(
        req.params.id,
        empresaId!,
        userId!,
        userRole as "admin" | "agent"
      );

      if (!tarefa) {
        return res.status(404).json({ success: false, message: "Tarefa não encontrada." });
      }

      await getOdooConnectionForEmpresa(empresaId!);

      const empresa = await db.query.empresas.findFirst({
        where: eq(empresas.id, empresaId!),
        columns: { id: true, nome: true },
      });

      const syncMetadata = {
        appRecordId: tarefa.id,
        appRecordRef: tarefa.id,
        appTaskRef: tarefa.id,
        appOrigin: "app" as const,
        createdByUserId: tarefa.createdByUserId,
        createdByUserName:
          [tarefa.createdByUser?.firstName, tarefa.createdByUser?.lastName].filter(Boolean).join(" ").trim() ||
          tarefa.createdByUser?.email ||
          null,
        assignedUserId: tarefa.assignedUserId ?? null,
        assignedUserName:
          [tarefa.assignedUser?.firstName, tarefa.assignedUser?.lastName].filter(Boolean).join(" ").trim() ||
          tarefa.assignedUser?.email ||
          null,
        companyId: empresa?.id ?? empresaId!,
        companyName: empresa?.nome ?? null,
        lastSyncAt: new Date(),
        internalNotes: tarefa.descricao ?? null,
      };

      let created = false;
      let pulled = false;
      let odooTaskId = tarefa.odooTaskId ? Number(tarefa.odooTaskId) : null;

      try {
        if (!odooTaskId) {
          odooTaskId = await createTaskFromVmTask({
            vmTask: tarefa,
            empresaId: empresaId!,
            appSync: syncMetadata,
          });
          created = true;

          await db
            .update(tarefas)
            .set({
              odooTaskId,
              lastSyncAt: new Date(),
              syncStatus: "synced",
              syncError: null,
            })
            .where(and(eq(tarefas.id, tarefa.id), eq(tarefas.empresaId, empresaId!)));
        } else {
          const odooTask = await getOdooTaskById(empresaId!, odooTaskId);

          if (odooTask) {
            const odooWriteDate = parseOdooWriteDate(odooTask.writeDate);
            const localUpdatedAt = tarefa.updatedAt ? new Date(tarefa.updatedAt) : null;

            if (
              odooWriteDate &&
              localUpdatedAt &&
              odooWriteDate.getTime() > localUpdatedAt.getTime() + 1000
            ) {
              await db
                .update(tarefas)
                .set(buildTaskUpdateFromOdoo(odooTask))
                .where(and(eq(tarefas.id, tarefa.id), eq(tarefas.empresaId, empresaId!)));

              pulled = true;

              return res.json({
                success: true,
                created: false,
                pulled: true,
                odooTaskId: String(odooTaskId),
              });
            }
          }

          try {
            await updateTaskFromVmTask({
              odooTaskId,
              vmTask: tarefa,
              empresaId: empresaId!,
              appSync: syncMetadata,
            });
          } catch (updateError: any) {
            if (!isMissingOdooTaskError(updateError?.message)) {
              throw updateError;
            }

            odooTaskId = await createTaskFromVmTask({
              vmTask: tarefa,
              empresaId: empresaId!,
              appSync: syncMetadata,
            });
            created = true;

            await db
              .update(tarefas)
              .set({
                odooTaskId,
                lastSyncAt: new Date(),
                syncStatus: "synced",
                syncError: null,
              })
              .where(and(eq(tarefas.id, tarefa.id), eq(tarefas.empresaId, empresaId!)));
          }
        }

        if (odooTaskId) {
          const refreshedOdooTask = await getOdooTaskById(empresaId!, odooTaskId);
          if (refreshedOdooTask) {
            await db
              .update(tarefas)
              .set({
                ...buildTaskUpdateFromOdoo(refreshedOdooTask),
                odooTaskId,
              })
              .where(and(eq(tarefas.id, tarefa.id), eq(tarefas.empresaId, empresaId!)));
          }
        }
      } catch (odooError: any) {
        await db
          .update(tarefas)
          .set({
            syncStatus: "error",
            syncError: odooError?.message ?? "Unknown Odoo sync error",
          })
          .where(and(eq(tarefas.id, tarefa.id), eq(tarefas.empresaId, empresaId!)));

        return res.status(500).json({
          success: false,
          message: "Erro ao sincronizar tarefa com o Odoo.",
          details: odooError?.message || "Unknown error",
        });
      }

      return res.json({
        success: true,
        created,
        pulled,
        odooTaskId: String(odooTaskId),
      });
    } catch (error: any) {
      console.error("Error syncing tarefa with Odoo:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync tarefa with Odoo",
        details: error?.message || "Unknown error",
      });
    }
  });

  app.post("/api/tarefas/:id/odoo/pull", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      const tarefa = await storage.getTarefa(
        req.params.id,
        empresaId!,
        userId!,
        userRole as "admin" | "agent"
      );

      if (!tarefa) {
        return res.status(404).json({ success: false, message: "Tarefa não encontrada." });
      }

      if (!tarefa.odooTaskId) {
        return res.status(400).json({
          success: false,
          message: "Esta tarefa ainda não está sincronizada com o Odoo.",
        });
      }

      const odooTask = await getOdooTaskById(empresaId!, Number(tarefa.odooTaskId));
      if (!odooTask) {
        return res.status(404).json({
          success: false,
          message: "Tarefa não encontrada no Odoo.",
        });
      }

      await db
        .update(tarefas)
        .set({
          ...buildTaskUpdateFromOdoo(odooTask),
          odooTaskId: Number(tarefa.odooTaskId),
        })
        .where(and(eq(tarefas.id, tarefa.id), eq(tarefas.empresaId, empresaId!)));

      return res.json({
        success: true,
        pulled: true,
        odooTaskId: String(tarefa.odooTaskId),
      });
    } catch (error: any) {
      console.error("Error pulling tarefa from Odoo:", error);
      res.status(500).json({
        success: false,
        message: "Failed to pull tarefa from Odoo",
        details: error?.message || "Unknown error",
      });
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
