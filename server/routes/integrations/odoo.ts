import type { Router } from "express";
import { isAuthenticated } from "../../replitAuth";
import { getUserContext } from "../../authContext";
import { odooConnectionsStorage } from "../../storage/odooConnections";
import { insertOdooConnectionSchema } from "@shared/schema";
import { testOdooConnection } from "../../integrations/odooClient";
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

  app.use("/api/integrations/odoo", router);
}
