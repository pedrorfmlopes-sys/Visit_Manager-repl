import express from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { leads, insertLeadSchema } from "../../shared/schema";
import { isAuthenticated } from "../replitAuth";
import { getUserContext } from "../authContext";
import { assertLeadsEnabled } from "../integrations/crmLeads";
import { createLeadFromVmLead, updateLeadFromVmLead } from "../integrations/odooClient";

export function registerCrmLeadsRoutes(app: express.Express) {
  const router = express.Router();

  // GET /api/crm/leads - List all leads for empresa (with optional visitaId filter)
  router.get("/", isAuthenticated, async (req, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      await assertLeadsEnabled(empresaId);

      // FASE CRM-LEADS-VISITA-STEP1: Support visitaId query parameter for filtering
      // FASE CRM-LEADS-ENT-CONTACTO-STEP1: Add entidadeId and contactoId filters
      const entidadeId = typeof req.query.entidadeId === "string"
        ? req.query.entidadeId
        : undefined;
      const contactoId = typeof req.query.contactoId === "string"
        ? req.query.contactoId
        : undefined;
      const visitaId = typeof req.query.visitaId === "string"
        ? req.query.visitaId
        : undefined;

      let whereClause: any = eq(leads.empresaId, empresaId);

      if (entidadeId) {
        whereClause = and(whereClause, eq(leads.entidadeId, entidadeId));
      }
      if (contactoId) {
        whereClause = and(whereClause, eq(leads.contactoId, contactoId));
      }
      if (visitaId) {
        whereClause = and(whereClause, eq(leads.visitaId, visitaId));
      }

      const rows = await db.query.leads.findMany({
        where: whereClause,
        orderBy: (l, { desc }) => desc(l.createdAt),
      });

      console.log("[CRM Leads] GET /api/crm/leads", {
        empresaId,
        entidadeId,
        contactoId,
        visitaId,
        count: rows.length,
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

  // GET /api/crm/leads/:id - Get specific lead with context (entidade, contacto, visita)
  router.get("/:id", isAuthenticated, async (req, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      await assertLeadsEnabled(empresaId);

      const id = req.params.id;

      const lead = await db.query.leads.findFirst({
        where: and(eq(leads.id, id), eq(leads.empresaId, empresaId)),
        with: {
          entidade: true,
          contacto: true,
          visita: true,
        },
      });

      if (!lead) {
        return res.status(404).json({ success: false, message: "Lead não encontrado." });
      }

      return res.json({
        lead: {
          ...lead,
          entidadeNome: lead.entidade?.nome ?? null,
          contactoNome: lead.contacto?.nome ?? null,
          visitaData: lead.visita?.dataVisita ?? null,
        },
      });
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

      const body = req.body;

      console.log("[CRM Leads] POST body", body);

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
      } = body;

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
        console.log("[CRM Leads] POST validation errors:", validation.error.flatten());
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

      console.log("[CRM Leads] POST created lead", created);

      return res.status(201).json({ success: true, lead: created });
    } catch (error: any) {
      if (error?.code === "LEADS_NOT_ENABLED") {
        return res.status(200).json({
          success: false,
          notEnabled: true,
          message: "Módulo de Leads não está ativo para esta empresa.",
        });
      }

      console.error("[CRM Leads] POST /api/crm/leads error:", {
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
        stack: error?.stack,
      });

      return res.status(500).json({
        success: false,
        message: error?.message || "Erro inesperado ao criar lead.",
      });
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

  // POST /api/crm/leads/:id/odoo/sync - Sincronizar lead com Odoo
  router.post("/:id/odoo/sync", isAuthenticated, async (req, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      await assertLeadsEnabled(empresaId);

      const leadId = req.params.id;

      // Carregar lead com entidade e contacto
      const lead = await db.query.leads.findFirst({
        where: and(eq(leads.id, leadId), eq(leads.empresaId, empresaId)),
        with: {
          entidade: true,
          contacto: true,
        },
      });

      if (!lead) {
        return res.status(404).json({ success: false, message: "Lead não encontrado." });
      }

      // Validar que lead tem entidade e contacto
      if (!lead.entidade || !lead.contacto) {
        return res.status(400).json({
          success: false,
          message: "Este lead não tem entidade ou contacto associados suficientes para sincronizar com o Odoo.",
        });
      }

      // Validar que entidade tem odooPartnerId
      if (!lead.entidade.odooPartnerId) {
        return res.status(400).json({
          success: false,
          message: "Esta entidade não está ligada ao Odoo. Liga primeiro a entidade a um parceiro no Odoo.",
        });
      }

      let odooLeadId: number | undefined;
      let created = false;

      try {
        if (!lead.odooLeadId) {
          // Criar novo lead no Odoo
          odooLeadId = await createLeadFromVmLead({
            vmLead: lead,
            entidade: lead.entidade,
            contacto: lead.contacto,
            empresaId,
          });
          created = true;

          // Atualizar lead com odooLeadId
          await db
            .update(leads)
            .set({ odooLeadId: String(odooLeadId) })
            .where(eq(leads.id, leadId));

          console.log(`[CRM Leads] Lead ${leadId} criado no Odoo com ID ${odooLeadId}`);
        } else {
          // Atualizar lead existente no Odoo
          const odooId = Number(lead.odooLeadId);
          await updateLeadFromVmLead({
            odooLeadId: odooId,
            vmLead: lead,
            entidade: lead.entidade,
            contacto: lead.contacto,
            empresaId,
          });

          odooLeadId = odooId;
          console.log(`[CRM Leads] Lead ${leadId} actualizado no Odoo com ID ${odooId}`);
        }
      } catch (odooError: any) {
        console.error("[CRM Leads] Erro ao sincronizar com Odoo:", {
          leadId,
          message: odooError?.message,
        });

        return res.status(500).json({
          success: false,
          message: "Erro ao sincronizar com o Odoo. Tenta novamente ou verifica a configuração Odoo.",
          details: odooError?.message || "Unknown error",
        });
      }

      return res.json({
        success: true,
        created,
        odooLeadId: String(odooLeadId),
      });
    } catch (error: any) {
      if (error?.code === "LEADS_NOT_ENABLED") {
        return res.status(200).json({
          success: false,
          notEnabled: true,
          message: "Módulo de Leads não está ativo para esta empresa.",
        });
      }

      console.error("[CRM Leads] POST /:id/odoo/sync error:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao sincronizar lead com Odoo.",
      });
    }
  });

  app.use("/api/crm/leads", router);
}
