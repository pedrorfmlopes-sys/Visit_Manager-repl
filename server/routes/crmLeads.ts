import express from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../storage";
import { leads, insertLeadSchema } from "../../shared/schema";
import { isAuthenticated } from "../replitAuth";
import { getUserContext } from "../authContext";
import { assertLeadsEnabled } from "../integrations/crmLeads";

export function registerCrmLeadsRoutes(app: express.Express) {
  const router = express.Router();

  // GET /api/crm/leads - List all leads for empresa
  router.get("/", isAuthenticated, async (req, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      await assertLeadsEnabled(empresaId);

      const rows = await db.query.leads.findMany({
        where: eq(leads.empresaId, empresaId),
        orderBy: (l, { desc }) => desc(l.createdAt),
      });

      return res.json({ leads: rows });
    } catch (error: any) {
      if (error?.code === "LEADS_NOT_ENABLED") {
        return res.status(200).json({
          success: false,
          notEnabled: true,
          message: "Módulo de Leads não está ativo para esta empresa.",
        });
      }

      console.error("[CRM Leads] GET / error:", error);
      return res.status(500).json({ success: false, message: "Erro ao listar leads." });
    }
  });

  // GET /api/crm/leads/:id - Get specific lead
  router.get("/:id", isAuthenticated, async (req, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      await assertLeadsEnabled(empresaId);

      const id = req.params.id;

      const lead = await db.query.leads.findFirst({
        where: and(eq(leads.id, id), eq(leads.empresaId, empresaId)),
      });

      if (!lead) {
        return res.status(404).json({ success: false, message: "Lead não encontrado." });
      }

      return res.json({ lead });
    } catch (error: any) {
      if (error?.code === "LEADS_NOT_ENABLED") {
        return res.status(200).json({
          success: false,
          notEnabled: true,
          message: "Módulo de Leads não está ativo para esta empresa.",
        });
      }

      console.error("[CRM Leads] GET /:id error:", error);
      return res.status(500).json({ success: false, message: "Erro ao obter lead." });
    }
  });

  // POST /api/crm/leads - Create new lead
  router.post("/", isAuthenticated, async (req, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      await assertLeadsEnabled(empresaId);

      const {
        entidadeId,
        contactoId,
        visitaId,
        titulo,
        descricao,
        marca,
        estado,
        valorPrevisto,
        moeda,
        responsavelUserId,
      } = req.body;

      // Validate required fields
      if (!entidadeId || !contactoId || !titulo) {
        return res.status(400).json({
          success: false,
          message: "entidadeId, contactoId e titulo são obrigatórios.",
        });
      }

      // Validate with schema
      const validation = insertLeadSchema.safeParse({
        entidadeId,
        contactoId,
        visitaId: visitaId ?? null,
        titulo,
        descricao: descricao ?? null,
        marca: marca ?? null,
        estado: estado ?? "novo",
        valorPrevisto: valorPrevisto ?? null,
        moeda: moeda ?? "EUR",
        responsavelUserId: responsavelUserId ?? null,
      });

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Validação falhou",
          errors: validation.error.flatten(),
        });
      }

      const [created] = await db
        .insert(leads)
        .values({
          empresaId,
          entidadeId,
          contactoId,
          visitaId: visitaId ?? null,
          titulo,
          descricao: descricao ?? null,
          marca: marca ?? null,
          estado: estado ?? "novo",
          valorPrevisto: valorPrevisto ?? null,
          moeda: moeda ?? "EUR",
          responsavelUserId: responsavelUserId ?? null,
        })
        .returning();

      return res.status(201).json({ success: true, lead: created });
    } catch (error: any) {
      if (error?.code === "LEADS_NOT_ENABLED") {
        return res.status(200).json({
          success: false,
          notEnabled: true,
          message: "Módulo de Leads não está ativo para esta empresa.",
        });
      }

      console.error("[CRM Leads] POST / error:", error);
      return res.status(500).json({ success: false, message: "Erro ao criar lead." });
    }
  });

  // PATCH /api/crm/leads/:id - Update lead
  router.patch("/:id", isAuthenticated, async (req, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      await assertLeadsEnabled(empresaId);

      const id = req.params.id;
      const {
        titulo,
        descricao,
        marca,
        estado,
        valorPrevisto,
        moeda,
        responsavelUserId,
        odooLeadId,
      } = req.body;

      const updateData: any = {};

      if (typeof titulo === "string") updateData.titulo = titulo;
      if (typeof descricao === "string") updateData.descricao = descricao;
      if (typeof marca === "string") updateData.marca = marca;
      if (typeof estado === "string") updateData.estado = estado;
      if (valorPrevisto !== undefined) updateData.valorPrevisto = valorPrevisto;
      if (typeof moeda === "string") updateData.moeda = moeda;
      if (typeof responsavelUserId === "string") updateData.responsavelUserId = responsavelUserId;
      if (typeof odooLeadId === "string" || odooLeadId === null) {
        updateData.odooLeadId = odooLeadId;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, message: "Nenhum campo para atualizar." });
      }

      const [updated] = await db
        .update(leads)
        .set(updateData)
        .where(and(eq(leads.id, id), eq(leads.empresaId, empresaId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ success: false, message: "Lead não encontrado." });
      }

      return res.json({ success: true, lead: updated });
    } catch (error: any) {
      if (error?.code === "LEADS_NOT_ENABLED") {
        return res.status(200).json({
          success: false,
          notEnabled: true,
          message: "Módulo de Leads não está ativo para esta empresa.",
        });
      }

      console.error("[CRM Leads] PATCH /:id error:", error);
      return res.status(500).json({ success: false, message: "Erro ao atualizar lead." });
    }
  });

  app.use("/api/crm/leads", router);
}
