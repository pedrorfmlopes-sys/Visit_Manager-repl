import type { Router } from "express";
import { isAuthenticated } from "../../replitAuth";
import { getUserContext } from "../../authContext";
import { odooConnectionsStorage } from "../../storage/odooConnections";
import { insertOdooConnectionSchema } from "@shared/schema";
import { testOdooConnection, searchOdooPartners, getOdooPartnerById, createOdooLead, assertOdooEnabled } from "../../integrations/odooClient";
import { createLeadForVisita } from "../../integrations/odooLeadsFromVisitas";
import express from "express";

export function setupOdooRoutes(app: any): void {
  const router = express.Router();

  // GET /api/integrations/odoo/status
  // Apenas verifica se a integração está configurada para a empresa atual
  router.get("/status", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) {
        return res.status(400).json({
          configured: false,
          message: "User has no company assigned",
        });
      }

      const connection =
        await odooConnectionsStorage.getOdooConnectionByEmpresaId(empresaId);

      if (!connection) {
        return res.json({ configured: false });
      }

      return res.json({
        configured: true,
        baseUrl: connection.baseUrl,
        dbName: connection.dbName,
        username: connection.username,
        environment: connection.environment,
        isActive: connection.isActive,
      });
    } catch (error) {
      console.error("Error fetching Odoo connection status:", error);
      return res
        .status(500)
        .json({ configured: false, message: "Failed to fetch Odoo status" });
    }
  });

  // POST /api/integrations/odoo/save
  // Guarda/atualiza a configuração do Odoo para a empresa atual
  router.post("/save", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) {
        return res.status(400).json({ message: "User has no company assigned" });
      }

      const parseResult = insertOdooConnectionSchema.safeParse({
        ...req.body,
        empresaId,
      });

      if (!parseResult.success) {
        console.error("Invalid Odoo connection payload:", parseResult.error.flatten());
        return res.status(400).json({ message: "Invalid Odoo connection data" });
      }

      const input = parseResult.data;

      await odooConnectionsStorage.upsertOdooConnection(input);

      return res.json({ message: "Odoo connection saved successfully" });
    } catch (error) {
      console.error("Error saving Odoo connection:", error);
      return res.status(500).json({ message: "Failed to save Odoo connection" });
    }
  });

  // GET /api/integrations/odoo/search-partner
  // Pesquisa parceiros no Odoo
  router.get("/search-partner", isAuthenticated, async (req: any, res) => {
    try {
      const q = String(req.query.q ?? "").trim();
      if (!q) {
        return res.status(400).json({ error: "Missing query parameter q" });
      }

      const { empresaId } = await getUserContext(req);
      if (!empresaId) {
        return res.status(400).json({ error: "User has no company assigned" });
      }

      await assertOdooEnabled(empresaId);

      const partners = await searchOdooPartners(empresaId, q);

      res.json({
        results: partners,
      });
    } catch (error: any) {
      if (error.message === "ODOO_NOT_CONFIGURED") {
        return res.status(200).json({
          results: [],
          notConfigured: true,
        });
      }

      console.error("[Odoo] search-partner error:", {
        message: error?.message,
        stack: error?.stack,
      });

      return res.status(500).json({
        success: false,
        error: "Odoo search partner error",
        message: error?.message ?? "Erro ao pesquisar parceiros no Odoo.",
      });
    }
  });

  // GET /api/integrations/odoo/partner/:id
  // Busca um parceiro específico por ID no Odoo
  router.get("/partner/:id", isAuthenticated, async (req: any, res) => {
    try {
      const rawId = req.params.id;
      const partnerId = Number(rawId);

      if (!rawId || Number.isNaN(partnerId)) {
        return res.status(400).json({ error: "Invalid partner id" });
      }

      const { empresaId } = await getUserContext(req);

      const partner = await getOdooPartnerById(empresaId, partnerId);

      if (!partner) {
        return res.status(404).json({ error: "Partner not found" });
      }

      return res.json({ partner });
    } catch (error: any) {
      if (error?.message === "ODOO_NOT_CONFIGURED") {
        return res.status(200).json({
          notConfigured: true,
          partner: null,
        });
      }

      console.error("[Odoo] get partner error:", error);
      return res.status(500).json({
        error: "Odoo partner fetch error",
        message: error?.message ?? "Unknown error",
      });
    }
  });

  // POST /api/integrations/odoo/visitas/:id/create-lead
  // Cria uma lead no Odoo a partir de uma visita
  router.post("/visitas/:id/create-lead", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) {
        return res.status(400).json({ error: "User has no company assigned" });
      }

      const visitaId = String(req.params.id);

      const result = await createLeadForVisita(empresaId, visitaId);

      return res.json({
        success: true,
        visitaId: result.visitaId,
        leadId: result.leadId,
      });
    } catch (error: any) {
      if (error?.message === "VISITA_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          error: "Visita not found",
        });
      }

      if (error?.message === "ODOO_NOT_CONFIGURED") {
        return res.status(200).json({
          success: false,
          notConfigured: true,
        });
      }

      console.error("[Odoo] create-lead-from-visita error:", error);
      return res.status(500).json({
        success: false,
        error: "Odoo create lead from visita error",
        message: error?.message ?? "Unknown error",
      });
    }
  });

  // POST /api/integrations/odoo/test-create-lead
  // Cria uma lead de teste no Odoo
  router.post("/test-create-lead", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) {
        return res.status(400).json({ error: "User has no company assigned" });
      }

      const {
        name,
        contactName,
        email,
        phone,
        description,
      } = (req.body ?? {}) as {
        name?: string;
        contactName?: string;
        email?: string;
        phone?: string;
        description?: string;
      };

      const leadName =
        name?.trim() ||
        "Visit Manager – Lead de teste";

      const leadDescription =
        description?.trim() ||
        "Lead de teste enviada pela aplicação Visit Manager (endpoint /test-create-lead).";

      const result = await createOdooLead(empresaId, {
        name: leadName,
        contactName: contactName?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        description: leadDescription,
      });

      return res.json({
        success: true,
        leadId: result.id,
      });
    } catch (error: any) {
      if (error?.message === "ODOO_NOT_CONFIGURED") {
        return res.status(200).json({
          success: false,
          notConfigured: true,
        });
      }

      console.error("[Odoo] test-create-lead error:", error);
      return res.status(500).json({
        success: false,
        error: "Odoo lead creation error",
        message: error?.message ?? "Unknown error",
      });
    }
  });

  app.use("/api/integrations/odoo", router);
}
