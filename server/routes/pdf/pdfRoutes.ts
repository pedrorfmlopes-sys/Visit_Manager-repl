// server/routes/pdf/pdfRoutes.ts
import { Router } from "express";
import { getUserContext } from "../../authContext";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subDays,
} from "date-fns";
import { pt } from "date-fns/locale";
import { storage } from "../../storage";
import { listContactosForUser } from "../../auth/rbac";

const router = Router();

// Middleware simples de autenticação por sessão
const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.session?.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

/* ============================================================
   PDF SIMPLES — VISITA
   GET /api/pdf/visitas/:id
   (montado em /api/pdf no index.ts → aqui usamos /visitas/:id)
============================================================ */
router.get("/visitas/:id", isAuthenticated, async (req: any, res) => {
  try {
    const { userId, userRole, empresaId } = (await getUserContext(req)) as {
      userId: string;
      userRole: "admin" | "agent";
      empresaId: string;
    };

    const visita = await storage.getVisita(
      req.params.id,
      empresaId,
      userId,
      userRole
    );

    if (!visita) return res.status(404).json({ message: "Visita not found" });

    const tarefas = await storage.getTarefasByVisitaId(
      req.params.id,
      empresaId,
      userId,
      userRole
    );

    const { generateVisitaPDF } = await import("../../pdfGenerator");
    const pdfBuffer = await generateVisitaPDF(visita, tarefas);

    const nome = visita.entidade?.nome?.replace(/\s+/g, "-") || "visita";
    const date = new Date(visita.dataVisita).toISOString().split("T")[0];

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Visita-${nome}-${date}.pdf"`
    );
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error("[PDF] Error generating visita PDF:", error);
    res.status(500).json({ message: "Failed to generate PDF" });
  }
});

/* ============================================================
   EXPORT ICS — VISITA
   GET /api/pdf/visitas/:id/ics
============================================================ */
router.get("/visitas/:id/ics", isAuthenticated, async (req: any, res) => {
  try {
    const { userId, userRole, empresaId } = (await getUserContext(req)) as {
      userId: string;
      userRole: "admin" | "agent";
      empresaId: string;
    };

    const visita = await storage.getVisita(
      req.params.id,
      empresaId,
      userId,
      userRole
    );

    if (!visita) return res.status(404).json({ message: "Visita not found" });

    const { generateVisitaICS, generateVisitaICSFilename } = await import(
      "../../icsExport"
    );

    const icsContent = generateVisitaICS(visita);
    const filename = generateVisitaICSFilename(visita);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(icsContent);
  } catch (error) {
    console.error("[ICS] Error:", error);
    res.status(500).json({ message: "Failed to generate ICS file" });
  }
});

/* ============================================================
   PDF PRO — VISITA
   GET /api/pdf/visita/:id/pro
============================================================ */
router.get("/visita/:id/pro", isAuthenticated, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { userId, userRole, empresaId } = (await getUserContext(req)) as {
      userId: string;
      userRole: "admin" | "agent";
      empresaId: string;
    };

    const visita = await storage.getVisita(id, empresaId, userId, userRole);
    if (!visita)
      return res.status(404).json({ message: "Visita não encontrada" });

    const entidade = visita.entidadeId
      ? await storage.getEntidade(
          visita.entidadeId,
          empresaId,
          userId,
          userRole
        )
      : null;

    const contacto = visita.contactoId
      ? await storage.getContacto(
          visita.contactoId,
          empresaId,
          userId,
          userRole
        )
      : null;

    const tarefas = await storage.getTarefasByVisitaId(
      id,
      empresaId,
      userId,
      userRole
    );
    const visitasEntidade = entidade
      ? await storage.getVisitasByEntidade(
          entidade.id,
          empresaId,
          userId,
          userRole
        )
      : [];

    const { generateVisitaPDFPro } = await import("../../pdfPro");
    const { getOpenAIClient } = await import("../../openai");

    const options = {
      includePhotos: req.query.includePhotos !== "false",
      includeTasks: req.query.includeTasks !== "false",
      includeIA: req.query.includeIA !== "false",
      includeCharts: req.query.includeCharts !== "false",
      type: (req.query.type === "cliente"
        ? "cliente"
        : "interno") as "cliente" | "interno",
    };

    const client = getOpenAIClient();
    const buffer = await generateVisitaPDFPro(
      visita,
      entidade,
      contacto,
      tarefas,
      visitasEntidade,
      options,
      client
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="visita-pro-${id}.pdf"`
    );
    res.send(buffer);
  } catch (error) {
    console.error("[PDF PRO] Error:", error);
    res
      .status(500)
      .json({ message: "Erro ao gerar PDF PRO da visita" });
  }
});

/* ============================================================
   PDF PRO — ENTIDADE
   GET /api/pdf/entidade/:id/pro
============================================================ */
router.get("/entidade/:id/pro", isAuthenticated, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { userId, userRole, empresaId } = (await getUserContext(req)) as {
      userId: string;
      userRole: "admin" | "agent";
      empresaId: string;
    };

    const entidade = await storage.getEntidade(
      id,
      empresaId,
      userId,
      userRole
    );
    if (!entidade)
      return res.status(404).json({ message: "Entidade não encontrada" });

    const contactos = await listContactosForUser({
      empresaId,
      userId,
      userRole,
      entidadeId: id,
    });

    const visitas = await storage.getVisitasByEntidade(
      id,
      empresaId,
      userId,
      userRole
    );
    const tarefas = await storage.getTarefasByEntidadeId(
      id,
      empresaId,
      userId,
      userRole
    );

    const { generateEntidadePDFPro } = await import("../../pdfPro");
    const { getOpenAIClient } = await import("../../openai");

    const options = {
      includePhotos: req.query.includePhotos !== "false",
      includeTasks: req.query.includeTasks !== "false",
      includeIA: req.query.includeIA !== "false",
      includeCharts: req.query.includeCharts !== "false",
      type: (req.query.type === "cliente"
        ? "cliente"
        : "interno") as "cliente" | "interno",
    };

    const client = getOpenAIClient();
    const buffer = await generateEntidadePDFPro(
      entidade,
      contactos,
      visitas,
      tarefas,
      options,
      client
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="entidade-pro-${entidade.nome?.replace(
        /[^a-z0-9]/gi,
        "_"
      )}.pdf"`
    );
    res.send(buffer);
  } catch (error) {
    console.error("[PDF PRO] Error entidade:", error);
    res
      .status(500)
      .json({ message: "Erro ao gerar PDF PRO da entidade" });
  }
});

/* ============================================================
   RELATÓRIO MENSAL — AGENTE ATUAL
============================================================ */
router.get(
  "/reports/monthly/agent",
  isAuthenticated,
  async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = (await getUserContext(req)) as {
        userId: string;
        userRole: "admin" | "agent";
        empresaId: string;
      };

      const year = req.query.year
        ? parseInt(req.query.year as string)
        : new Date().getFullYear();
      const month = req.query.month
        ? parseInt(req.query.month as string) - 1
        : new Date().getMonth();

      const start = startOfMonth(new Date(year, month));
      const end = endOfMonth(new Date(year, month));

      const visitas = await storage.getVisitasInPeriod(
        start,
        end,
        empresaId,
        userId,
        userRole
      );
      const tarefas = await storage.getTarefasInPeriod(
        start,
        end,
        empresaId,
        userId,
        userRole
      );
      const entidades = await storage.getAllEntidades(
        empresaId,
        userId,
        userRole
      );

      const { generateMonthlyReportPDF } = await import("../../pdfPro");
      const { getOpenAIClient } = await import("../../openai");

      const client = getOpenAIClient();
      const buffer = await generateMonthlyReportPDF(
        { start, end },
        visitas,
        tarefas,
        entidades,
        userId,
        userRole,
        {
          includePhotos: true,
          includeTasks: true,
          includeIA: true,
          includeCharts: true,
          type: "interno",
        },
        client
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="relatorio-mensal-${month + 1}-${year}.pdf"`
      );
      res.send(buffer);
    } catch (error) {
      console.error("[PDF] Monthly agent error:", error);
      res
        .status(500)
        .json({ message: "Erro ao gerar relatório mensal" });
    }
  }
);

/* ============================================================
   RELATÓRIO SEMANAL — AGENTE ATUAL
============================================================ */
router.get(
  "/reports/weekly/agent",
  isAuthenticated,
  async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = (await getUserContext(req)) as {
        userId: string;
        userRole: "admin" | "agent";
        empresaId: string;
      };

      const date = req.query.date
        ? new Date(req.query.date as string)
        : new Date();

      const start = startOfWeek(date, { weekStartsOn: 1 });
      const end = endOfWeek(date, { weekStartsOn: 1 });

      const visitas = await storage.getVisitasInPeriod(
        start,
        end,
        empresaId,
        userId,
        userRole
      );
      const tarefas = await storage.getTarefasInPeriod(
        start,
        end,
        empresaId,
        userId,
        userRole
      );
      const entidades = await storage.getAllEntidades(
        empresaId,
        userId,
        userRole
      );

      const { generateMonthlyReportPDF } = await import("../../pdfPro");
      const { getOpenAIClient } = await import("../../openai");

      const client = getOpenAIClient();
      const buffer = await generateMonthlyReportPDF(
        { start, end },
        visitas,
        tarefas,
        entidades,
        userId,
        userRole,
        {
          includePhotos: true,
          includeTasks: true,
          includeIA: true,
          includeCharts: true,
          type: "interno",
        },
        client
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="relatorio-semanal-${format(start, "dd-MM-yyyy", {
          locale: pt,
        })}.pdf"`
      );
      res.send(buffer);
    } catch (error) {
      console.error("[PDF] Weekly agent error:", error);
      res
        .status(500)
        .json({ message: "Erro ao gerar relatório semanal" });
    }
  }
);

/* ============================================================
   PERFORMANCE PRO PDF
============================================================ */
router.get(
  "/performance-pro",
  isAuthenticated,
  async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = (await getUserContext(req)) as {
        userId: string;
        userRole: "admin" | "agent";
        empresaId: string;
      };

      const scopeParam = req.query.scope === "empresa" ? "empresa" : "agent";
      if (userRole === "agent" && scopeParam === "empresa") {
        return res.status(403).json({
          message:
            "Apenas administradores podem gerar relatório da empresa",
        });
      }

      const period = req.query.period === "week" ? "week" : "month";

      const to = new Date();
      const from =
        period === "week" ? subDays(to, 7) : subDays(to, 30);

      const visitas = await storage.getVisitasInPeriod(
        from,
        to,
        empresaId,
        userId,
        userRole
      );
      const tarefas = await storage.getTarefasInPeriod(
        from,
        to,
        empresaId,
        userId,
        userRole
      );
      const visitasProximas = await storage.getVisitasInPeriod(
        to,
        new Date(to.getTime() + 7 * 86400000),
        empresaId,
        userId,
        userRole
      );

      const brandStats: Record<string, number> = {};
      visitas.forEach((v: any) => {
        if (v.marcas) {
          v.marcas.forEach((m: any) => {
            const marca = m.nome || m;
            brandStats[marca] = (brandStats[marca] || 0) + 1;
          });
        }
      });

      const marcasMaisTrabalhadas = Object.entries(brandStats)
        .map(([marca, count]) => ({ marca, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const tarefasAtraso = tarefas.filter(
        (t: any) =>
          t.status === "pending" &&
          t.dueDate &&
          new Date(t.dueDate) < new Date()
      );

      const user = await storage.getUser(userId);
      const empresa = await storage.getEmpresa(empresaId);

      const clientes: Record<string, any> = {};
      visitas.forEach((v: any) => {
        const key = v.entidade?.id || "unknown";
        if (!clientes[key]) {
          clientes[key] = {
            nome: v.entidade?.nome || "Desconhecido",
            count: 0,
            ultimaVisita: new Date(v.dataVisita),
          };
        }
        clientes[key].count++;
        if (new Date(v.dataVisita) > clientes[key].ultimaVisita) {
          clientes[key].ultimaVisita = new Date(v.dataVisita);
        }
      });

      const clientesChave = Object.values(clientes)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10)
        .map((c: any) => ({
          nome: c.nome,
          visitCount: c.count,
          ultimaVisita: format(
            new Date(c.ultimaVisita),
            "d MMM",
            { locale: pt }
          ),
        }));

      const percentagemAtraso =
        tarefas.length > 0
          ? (tarefasAtraso.length / tarefas.length) * 100
          : 0;

      const scopeForInsights: "admin" | "agent" =
        scopeParam === "empresa" ? "admin" : "agent";

      const insights = await import("../../openai").then((m) =>
        m.generateDashboardInsights({
          scope: scopeForInsights,
          userName:
            scopeParam === "empresa"
              ? empresa?.nome || "Empresa"
              : user?.firstName || user?.email || "Agente",
          metrics: {
            visitasRealizadas: visitas.length,
            visitasAgendadas: visitasProximas.length,
            tarefasCriadas: tarefas.length,
            tarefasConcluidas: tarefas.filter(
              (t: any) => t.status === "done"
            ).length,
            tarefasEmAtraso: tarefasAtraso.length,
            clientesChave,
            marcasMaisTrabalhadas,
          },
        })
      );

      const { generatePerformanceProPDF } = await import(
        "../../pdfPerformancePro"
      );

      const buffer = await generatePerformanceProPDF({
        period: { from, to },
        metrics: {
          visitasRealizadas: visitas.length,
          visitasAgendadas: visitasProximas.length,
          tarefasCriadas: tarefas.length,
          tarefasConcluidas: tarefas.filter(
            (t: any) => t.status === "done"
          ).length,
          tarefasEmAtraso: tarefasAtraso.length,
          percentagemAtraso,
          clientesChave,
          tarefasEmAtrasoDetalhes: tarefasAtraso
            .slice(0, 10)
            .map((t: any) => ({
              titulo: t.descricao || "Sem título",
              diasAtraso: Math.floor(
                (Date.now() - new Date(t.dueDate).getTime()) /
                  86400000
              ),
            })),
          marcasMaisTrabalhadas,
        },
        insights,
        empresa: {
          nome: empresa?.nome || "Empresa",
          logoUrl: empresa?.logoUrl || undefined,
        },
        user: user
          ? {
              nome: user.firstName || user.email || "Agente",
              email: user.email || "",
            }
          : undefined,
        scope: scopeParam,
      });

      const filename = `performance-pro-${scopeParam}-${format(
        new Date(),
        "yyyyMMdd"
      )}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send(buffer);
    } catch (error) {
      console.error("[PDF Performance PRO] Error:", error);
      res
        .status(500)
        .json({ message: "Erro ao gerar relatório PRO" });
    }
  }
);

export default router;
