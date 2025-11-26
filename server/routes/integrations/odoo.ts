import type { Router } from "express";
import { isAuthenticated } from "../../replitAuth";
import { getUserContext } from "../../authContext";
import { odooConnectionsStorage } from "../../storage/odooConnections";
import { insertOdooConnectionSchema } from "@shared/schema";
import { testOdooConnection, searchOdooPartners, getOdooPartnerById } from "../../integrations/odooClient";
import express from "express";

export function setupOdooRoutes(app: any): void {
  const router = express.Router();

  // GET /api/integrations/odoo/status
  // Testa a ligação com Odoo e devolve o status
  router.get("/status", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) {
        return res.status(400).json({
          connected: false,
          reason: "no_company",
          message: "User has no company assigned",
        });
      }

      const result = await testOdooConnection(empresaId);

      return res.json({
        connected: true,
        ...result,
      });
    } catch (error: any) {
      if (error.message === "ODOO_NOT_CONFIGURED") {
        return res.json({
          connected: false,
          reason: "not_configured",
        });
      }

      console.error("[Odoo] Status error:", error);
      return res.status(500).json({
        connected: false,
        reason: "error",
        message: error.message ?? "Unknown error",
      });
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

      console.error("[Odoo] search-partner error:", error);
      res.status(500).json({
        error: "Odoo search error",
        message: error.message ?? "Unknown error",
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

  app.use("/api/integrations/odoo", router);
}
