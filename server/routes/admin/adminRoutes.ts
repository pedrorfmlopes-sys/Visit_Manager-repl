import express from "express";
import { subDays } from "date-fns";
import { getUserContext, requireAdmin } from "../../authContext";
import { storage } from "../../storage";

export function adminRoutes(app: express.Express) {
  app.get("/api/admin/entidades", requireAdmin, async (req: any, res) => {
    const { empresaId, userId } = await getUserContext(req);
    if (!empresaId) {
      return res.status(400).json({ message: "Utilizador sem empresa." });
    }
    const entidades = await storage.getEntidades(empresaId, userId, "admin");
    return res.json(entidades);
  });

  app.post(
    "/api/admin/entidades/migrar-tipos",
    requireAdmin,
    async (_req: any, res) => {
      const result = await storage.migrateEntidadeTipos();
      return res.json({ message: "Migração concluída", ...result });
    },
  );

  if (process.env.NODE_ENV !== "production") app.get("/api/admin/debug", requireAdmin, async (req: any, res) => {
    const { empresaId, userId } = await getUserContext(req);
    if (!empresaId) {
      return res.status(400).json({ message: "Utilizador sem empresa." });
    }

    const [users, entidades, contactos, visitas, tarefas] = await Promise.all([
      storage.getUtilizadoresByEmpresa(empresaId),
      storage.getEntidades(empresaId, userId, "admin"),
      storage.getContactos({ empresaId }),
      storage.getVisitas(empresaId, userId, "admin"),
      storage.getTarefas(empresaId, userId, "admin"),
    ]);
    const visitasLast30 = visitas.filter(
      (visit: any) => new Date(visit.dataVisita) >= subDays(new Date(), 30),
    ).length;
    const tarefasAtraso = tarefas.filter(
      (task: any) =>
        task.status === "pending" &&
        task.dueDate &&
        new Date(task.dueDate) < new Date(),
    ).length;

    return res.json({
      timestamp: new Date().toISOString(),
      stats: {
        users: users.length,
        entidades: entidades.length,
        contactos: contactos.length,
        visitas: visitas.length,
        visitasLast30,
        tarefas: tarefas.length,
        tarefasAtraso,
      },
    });
  });
}
