import express from "express";
import { z } from "zod";
import { getUserContext } from "../../authContext";
import { isAuthenticated } from "../../replitAuth";
import { safeUser } from "../../safeUser";
import { storage } from "../../storage";
import { assertTenantReferences } from "../../tenantValidation";

const updatePlanningItemSchema = z.object({
  scheduledAt: z.string().datetime().nullable(),
  assignedUserId: z.string().trim().min(1).nullable().optional(),
});

const planningItemKindSchema = z.enum(["tarefa", "visita"]);

function parseDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function planningRoutes(app: express.Express) {
  app.get("/api/planeamento/context", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);
      if (!empresaId || !userId) {
        return res.status(401).json({ message: "Sessão inválida." });
      }

      const [unplannedTasks, companyUsers] = await Promise.all([
        storage.getUnplannedTarefas(empresaId, userId, userRole),
        userRole === "admin"
          ? storage.getUtilizadoresByEmpresa(empresaId)
          : storage.getUser(userId).then((user) => (user ? [user] : [])),
      ]);

      return res.json({
        role: userRole,
        currentUserId: userId,
        users: companyUsers.filter((user) => user.ativo).map(safeUser),
        unplannedTasks,
      });
    } catch (error) {
      console.error("[PlanningRoutes] Failed to load planning context:", error);
      return res.status(500).json({
        message: "Não foi possível carregar o contexto do planeamento.",
      });
    }
  });

  app.get("/api/planeamento", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);
      const from = parseDate(req.query.from);
      const to = parseDate(req.query.to);

      if (!empresaId || !userId || !from || !to || from > to) {
        return res.status(400).json({ message: "Período de planeamento inválido." });
      }

      const includeContext = req.query.includeContext !== "false";
      const [scheduledTasks, visits] = await Promise.all([
        storage.getTarefasInPeriod(from, to, empresaId, userId, userRole),
        storage.getVisitasInPeriod(from, to, empresaId, userId, userRole),
      ]);

      if (!includeContext) {
        return res.json({
          from: from.toISOString(),
          to: to.toISOString(),
          tasks: scheduledTasks,
          visits,
        });
      }

      const [unplannedTasks, companyUsers] = await Promise.all([
        storage.getUnplannedTarefas(empresaId, userId, userRole),
        userRole === "admin"
          ? storage.getUtilizadoresByEmpresa(empresaId)
          : storage.getUser(userId).then((user) => (user ? [user] : [])),
      ]);

      return res.json({
        from: from.toISOString(),
        to: to.toISOString(),
        role: userRole,
        currentUserId: userId,
        users: companyUsers.filter((user) => user.ativo).map(safeUser),
        tasks: [...scheduledTasks, ...unplannedTasks],
        visits,
      });
    } catch (error) {
      console.error("[PlanningRoutes] Failed to load planning:", error);
      return res.status(500).json({ message: "Não foi possível carregar o planeamento." });
    }
  });

  app.patch(
    "/api/planeamento/:kind/:id",
    isAuthenticated,
    async (req: any, res) => {
      const kind = planningItemKindSchema.safeParse(req.params.kind);
      if (!kind.success) {
        return res.status(400).json({ message: "Tipo de item inválido." });
      }

      const parsed = updatePlanningItemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dados de planeamento inválidos." });
      }

      try {
        const { empresaId, userId, userRole } = await getUserContext(req);
        if (!empresaId || !userId) {
          return res.status(401).json({ message: "Sessão inválida." });
        }

        if (
          userRole !== "admin" &&
          Object.prototype.hasOwnProperty.call(parsed.data, "assignedUserId")
        ) {
          return res.status(403).json({
            message: "Apenas o administrador pode alterar o responsável.",
          });
        }

        if (userRole === "admin" && parsed.data.assignedUserId) {
          await assertTenantReferences(empresaId, {
            assignedUserId: parsed.data.assignedUserId,
          }, {userId,userRole});
        }

        const scheduledAt = parsed.data.scheduledAt
          ? new Date(parsed.data.scheduledAt)
          : null;

        if (kind.data === "visita" && !scheduledAt) {
          return res.status(400).json({
            message: "Uma visita tem de manter uma data agendada.",
          });
        }

        if (kind.data === "tarefa") {
          const existing = await storage.getTarefa(
            req.params.id,
            empresaId,
            userId,
            userRole,
          );
          if (!existing) {
            return res.status(404).json({ message: "Tarefa não encontrada." });
          }

          const updated = await storage.updateTarefa(
            req.params.id,
            {
              dueDate: scheduledAt,
              ...(userRole === "admin" &&
              Object.prototype.hasOwnProperty.call(parsed.data, "assignedUserId")
                ? { assignedUserId: parsed.data.assignedUserId }
                : {}),
            },
            empresaId,
            userId,
            userRole,
          );

          return res.json(updated);
        }

        const existing = await storage.getVisita(
          req.params.id,
          empresaId,
          userId,
          userRole,
        );
        if (!existing) {
          return res.status(404).json({ message: "Visita não encontrada." });
        }

        const updated = await storage.updateVisita(
          req.params.id,
          {
            dataVisita: scheduledAt!,
            ...(userRole === "admin" &&
            Object.prototype.hasOwnProperty.call(parsed.data, "assignedUserId")
              ? { assignedUserId: parsed.data.assignedUserId }
              : {}),
            updatedAt: new Date(),
          },
          empresaId,
          userId,
          userRole,
        );

        return res.json(updated);
      } catch (error) {
        console.error("[PlanningRoutes] Failed to update planning item:", error);
        return res.status(400).json({
          message: "Não foi possível atualizar o planeamento.",
        });
      }
    },
  );
}
