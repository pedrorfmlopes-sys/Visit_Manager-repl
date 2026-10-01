// server/routes/crm/dashboardRoutes.ts
import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../../replitAuth";
import { storage } from "../../storage";
import { getUserContext } from "../../authContext";
import { listContactosForUser } from "../../auth/rbac";
import { startOfMonth, endOfMonth, subDays } from "date-fns";
import type { VisitaWithRelations } from "@shared/schema";
import { generateDashboardInsights } from "../../openai";

export function dashboardRoutes(app: Express) {
  /**
   * GET /api/dashboard
   *
   * Devolve as estatísticas agregadas usadas pelo Dashboard (user e admin).
   *
   * interface DashboardStats {
   *   totalEntidades: number;
   *   totalContactos: number;
   *   totalVisitas: number;
   *   visitasEstesMes: number;
   *   marcasMaisEntregues: { marca: string; count: number }[];
   *   proximasVisitas: VisitaWithRelations[];
   * }
   */
  app.get(
    "/api/dashboard",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { empresaId, userId, userRole } = await getUserContext(
          req as any,
        );

        if (!empresaId || !userId || !userRole) {
          return res
            .status(400)
            .json({ message: "Contexto de utilizador/empresa em falta" });
        }

        const scope = userRole === "admin" ? "admin" : "agent";

        // Carregar dados base a partir do storage (como no /api/admin/debug)
        const [entidades, contactos, visitas] = await Promise.all([
          storage.getEntidades(empresaId, userId, scope),
          listContactosForUser({
            empresaId,
            userId,
            userRole: scope,
          }),
          storage.getVisitas(empresaId, userId, scope),
        ]);

        const agora = new Date();
        const inicioMes = startOfMonth(agora);
        const fimMes = endOfMonth(agora);

        const totalEntidades = (entidades ?? []).length;
        const totalContactos = (contactos ?? []).length;
        const totalVisitas = (visitas ?? []).length;

        // Visitas deste mês (pela data da visita; fallback createdAt)
        const visitasEstesMes = (visitas ?? []).filter((v: any) => {
          const rawDate =
            v.data ??
            v.dataVisita ??
            v.dataVisitaInicio ??
            v.createdAt ??
            v.updatedAt;
          if (!rawDate) return false;
          const d = new Date(rawDate);
          return d >= inicioMes && d <= fimMes;
        }).length;

        // Marcas mais trabalhadas (assumimos que cada visita pode ter uma marca associada)
        const marcasCount = new Map<string, number>();
        for (const v of (visitas ?? []) as any[]) {
          const marcaNome =
            (v.marcaNome as string | undefined) ??
            (v.marca as string | undefined) ??
            (v.marcaId as string | undefined);

          if (!marcaNome) continue;

          marcasCount.set(marcaNome, (marcasCount.get(marcaNome) ?? 0) + 1);
        }

        const marcasMaisEntregues = Array.from(marcasCount.entries())
          .map(([marca, count]) => ({ marca, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Próximas visitas (a partir de hoje, ordenadas por data asc)
        const proximasVisitas = (visitas as VisitaWithRelations[])
          .filter((v) => {
            const rawDate =
              (v as any).data ??
              (v as any).dataVisita ??
              (v as any).dataVisitaInicio ??
              (v as any).createdAt;
            if (!rawDate) return false;
            const d = new Date(rawDate);
            return d >= agora;
          })
          .sort((a, b) => {
            const da =
              new Date(
                ((a as any).data ??
                  (a as any).dataVisita ??
                  (a as any).dataVisitaInicio ??
                  (a as any).createdAt) as string,
              ).getTime() || 0;
            const db =
              new Date(
                ((b as any).data ??
                  (b as any).dataVisita ??
                  (b as any).dataVisitaInicio ??
                  (b as any).createdAt) as string,
              ).getTime() || 0;
            return da - db;
          })
          .slice(0, 5);

        const payload = {
          totalEntidades,
          totalContactos,
          totalVisitas,
          visitasEstesMes,
          marcasMaisEntregues,
          proximasVisitas,
        };

        return res.json(payload);
      } catch (error) {
        console.error("[dashboardRoutes] Erro ao gerar /api/dashboard:", error);
        return res
          .status(500)
          .json({ message: "Erro ao carregar estatísticas do dashboard" });
      }
    },
  );

  /**
   * GET /api/dashboard/insights
   *
   * Calcula métricas dos últimos 30 dias e gera texto de insights com IA.
   * Estrutura devolvida é a esperada pelo DashboardInsightsCard.
   */
  app.get(
    "/api/dashboard/insights",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { empresaId, userId, userRole } = await getUserContext(
          req as any,
        );

        if (!empresaId || !userId || !userRole) {
          return res
            .status(400)
            .json({ message: "Contexto de utilizador/empresa em falta" });
        }

        const scope: "admin" | "agent" =
          userRole === "admin" ? "admin" : "agent";

        const agora = new Date();
        const from = subDays(agora, 30);
        const to = agora;

        // Reutilizamos direct storage como no /api/admin/debug
        const [visitas, tarefas, entidades] = await Promise.all([
          storage.getVisitas(empresaId, userId, scope),
          storage.getTarefas(empresaId, userId, scope),
          storage.getEntidades(empresaId, userId, scope),
        ]);

        const visitasList = (visitas ?? []) as any[];
        const tarefasList = (tarefas ?? []) as any[];
        const entidadesList = (entidades ?? []) as any[];

        const getDataVisita = (v: any): Date | null => {
          const raw =
            v.dataVisita ??
            v.data ??
            v.dataVisitaInicio ??
            v.createdAt ??
            v.updatedAt;
          if (!raw) return null;
          const d = new Date(raw);
          return isNaN(d.getTime()) ? null : d;
        };

        const visitas30 = visitasList.filter((v) => {
          const d = getDataVisita(v);
          if (!d) return false;
          return d >= from && d <= to;
        });

        // Métricas base
        const visitasRealizadas = visitas30.filter((v) => {
          const d = getDataVisita(v);
          return d !== null && d <= agora;
        }).length;

        const visitasAgendadas = visitasList.filter((v) => {
          const raw =
            v.proximaVisita ??
            v.dataVisita ??
            v.dataVisitaInicio ??
            v.createdAt ??
            v.updatedAt;
          if (!raw) return false;
          const d = new Date(raw);
          return !isNaN(d.getTime()) && d >= agora && d <= to;
        }).length;

        const tarefasCriadas = tarefasList.filter((t) => {
          const raw = t.createdAt ?? t.dataCriacao ?? t.data;
          if (!raw) return false;
          const d = new Date(raw);
          return !isNaN(d.getTime()) && d >= from && d <= to;
        }).length;

        const tarefasConcluidas = tarefasList.filter((t) => {
          const done =
            t.status === "done" ||
            t.status === "concluida" ||
            t.estado === "concluida";
          if (!done) return false;
          const raw = t.completedAt ?? t.updatedAt ?? t.dueDate;
          if (!raw) return true; // se não tivermos data, contamos na mesma
          const d = new Date(raw);
          return !isNaN(d.getTime()) && d >= from && d <= to;
        }).length;

        const tarefasEmAtraso = tarefasList.filter((t) => {
          const done =
            t.status === "done" ||
            t.status === "concluida" ||
            t.estado === "concluida";
          if (done) return false;
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          return !isNaN(d.getTime()) && d < agora;
        }).length;

        // Clientes chave (mais visitas nos últimos 30 dias)
        const clientesChaveMap = new Map<
          string,
          { nome: string; count: number }
        >();

        for (const v of visitas30) {
          const entidadeId = (v as any).entidadeId ?? (v as any).gabineteId;
          const entidadeNome =
            (v as any).entidade?.nome ??
            (v as any).gabinete?.nome ??
            entidadesList.find((e: any) => e.id === entidadeId)?.nome;

          if (!entidadeId || !entidadeNome) continue;

          const current =
            clientesChaveMap.get(entidadeId) || { nome: entidadeNome, count: 0 };
          current.count += 1;
          clientesChaveMap.set(entidadeId, current);
        }

        const clientesChave = Array.from(clientesChaveMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map(({ nome, count }) => ({ nome, visitCount: count }));

        // Marcas mais trabalhadas nos últimos 30 dias
        const marcasCount = new Map<string, number>();
        for (const v of visitas30) {
          const marcaNome =
            (v as any).marcaNome ??
            (v as any).marca ??
            (v as any).marcaId;
          if (!marcaNome) continue;
          marcasCount.set(marcaNome, (marcasCount.get(marcaNome) ?? 0) + 1);
        }

        const marcasMaisTrabalhadas = Array.from(marcasCount.entries())
          .map(([marca, count]) => ({ marca, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        const metrics = {
          visitasRealizadas,
          visitasAgendadas,
          tarefasCriadas,
          tarefasConcluidas,
          tarefasEmAtraso,
          clientesChave,
          marcasMaisTrabalhadas,
        };

        const userName =
          (req as any).session?.user?.firstName ||
          (req as any).session?.user?.email ||
          "Utilizador";

        let insightsText = "";

        try {
          const insights = await generateDashboardInsights({
            scope,
            userName,
            metrics,
          });

          if (typeof insights === "string") {
            insightsText = insights;
          } else if (insights && typeof (insights as any).text === "string") {
            insightsText = (insights as any).text;
          } else {
            insightsText = String(insights ?? "");
          }
        } catch (error: any) {
          console.error("[dashboardRoutes] Erro ao gerar insights IA:", error);
          const msg =
            error?.message && typeof error.message === "string"
              ? error.message
              : "";

          if (msg.toLowerCase().includes("openai") && msg.toLowerCase().includes("api key")) {
            insightsText =
              "Os insights automáticos estão desativados porque não há chave OpenAI configurada para esta empresa. Pede ao administrador para configurar em Admin > Empresa > IA.";
          } else {
            insightsText =
              "Não foi possível gerar insights automáticos neste momento. Tenta novamente mais tarde.";
          }
        }

        const payload = {
          scope,
          period: {
            from: from.toISOString(),
            to: to.toISOString(),
          },
          metrics,
          insightsText,
        };

        return res.json(payload);
      } catch (error) {
        console.error(
          "[dashboardRoutes] Erro ao gerar /api/dashboard/insights:",
          error,
        );
        return res.status(500).json({
          message: "Erro ao carregar insights do dashboard",
        });
      }
    },
  );

  app.get(
    "/api/analytics",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { empresaId, userId, userRole } = await getUserContext(req as any);

        if (!empresaId || !userId || !userRole) {
          return res
            .status(400)
            .json({ message: "Contexto de utilizador/empresa em falta" });
        }

        const period = Number.parseInt(String(req.query.period ?? "365"), 10);
        const agente =
          typeof req.query.agente === "string" && req.query.agente !== "all"
            ? req.query.agente
            : undefined;
        const tipoEntidade =
          typeof req.query.tipoEntidade === "string" &&
          req.query.tipoEntidade !== "all"
            ? req.query.tipoEntidade
            : undefined;

        const analytics = await storage.getAnalytics(empresaId, userId, userRole, {
          period: Number.isFinite(period) ? period : 365,
          agente,
          tipoEntidade,
        });

        return res.json(analytics);
      } catch (error) {
        console.error("[dashboardRoutes] Erro ao gerar /api/analytics:", error);
        return res.status(500).json({ message: "Erro ao carregar analytics" });
      }
    },
  );
}
