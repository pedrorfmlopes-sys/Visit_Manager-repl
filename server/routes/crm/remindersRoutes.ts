import type { Express, Request, Response } from "express";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { isAuthenticated } from "../../replitAuth";
import { getUserContext } from "../../authContext";
import { db } from "../../db";
import { lembretes } from "@shared/schema";
import { generateAllReminders, resolveReminder, snoozeReminder } from "../../reminders";
import { storage } from "../../storage";

export function remindersRoutes(app: Express) {
  app.get("/api/lembretes", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { userId, empresaId } = await getUserContext(req as any);

      if (!userId || !empresaId) {
        return res.status(400).json({ message: "Contexto de utilizador/empresa em falta" });
      }

      const user = await storage.getUser(userId);
      if (user) {
        await generateAllReminders(user);
      }

      const items = await db.query.lembretes.findMany({
        where: and(
          eq(lembretes.userId, userId),
          eq(lembretes.empresaId, empresaId),
          eq(lembretes.resolved, false),
          or(
            sql`${lembretes.snoozedUntil} IS NULL`,
            sql`${lembretes.snoozedUntil} <= NOW()`,
          ),
        ),
        with: {
          entidade: true,
          visita: true,
          tarefa: true,
        },
        orderBy: [asc(lembretes.dataVencimento), asc(lembretes.dataCriacao)],
      });

      res.json(items);
    } catch (error) {
      console.error("[remindersRoutes] Erro ao carregar lembretes:", error);
      res.status(500).json({ message: "Erro ao carregar lembretes" });
    }
  });

  app.post("/api/lembretes/snooze", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { userId, empresaId } = await getUserContext(req as any);
      const { reminderId, duration } = (req as any).body ?? {};

      if (!userId || !empresaId || !reminderId || !duration) {
        return res.status(400).json({ message: "Parâmetros em falta" });
      }

      const [item] = await db
        .select()
        .from(lembretes)
        .where(
          and(
            eq(lembretes.id, reminderId),
            eq(lembretes.userId, userId),
            eq(lembretes.empresaId, empresaId),
          ),
        )
        .limit(1);

      if (!item) {
        return res.status(404).json({ message: "Lembrete não encontrado" });
      }

      await snoozeReminder(reminderId, duration);
      res.json({ success: true });
    } catch (error) {
      console.error("[remindersRoutes] Erro ao adiar lembrete:", error);
      res.status(500).json({ message: "Erro ao adiar lembrete" });
    }
  });

  app.post("/api/lembretes/resolve", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { userId, empresaId } = await getUserContext(req as any);
      const { reminderId } = (req as any).body ?? {};

      if (!userId || !empresaId || !reminderId) {
        return res.status(400).json({ message: "Parâmetros em falta" });
      }

      const [item] = await db
        .select()
        .from(lembretes)
        .where(
          and(
            eq(lembretes.id, reminderId),
            eq(lembretes.userId, userId),
            eq(lembretes.empresaId, empresaId),
          ),
        )
        .limit(1);

      if (!item) {
        return res.status(404).json({ message: "Lembrete não encontrado" });
      }

      await resolveReminder(reminderId);
      res.json({ success: true });
    } catch (error) {
      console.error("[remindersRoutes] Erro ao concluir lembrete:", error);
      res.status(500).json({ message: "Erro ao concluir lembrete" });
    }
  });
}
