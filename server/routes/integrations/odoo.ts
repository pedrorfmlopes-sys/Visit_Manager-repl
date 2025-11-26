import type { Router } from "express";
import { isAuthenticated } from "../../replitAuth";
import { getUserContext } from "../../authContext";
import { odooConnectionsStorage } from "../../storage/odooConnections";
import { insertOdooConnectionSchema } from "@shared/schema";
import express from "express";

export function setupOdooRoutes(app: any): void {
  const router = express.Router();

  // GET /api/integrations/odoo/status
  // Devolve se a integração está configurada para a empresa atual
  router.get("/status", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) {
        return res.status(400).json({
          configured: false,
          message: "User has no company assigned",
        });
      }

      const connection = await odooConnectionsStorage.getOdooConnectionByEmpresaId(empresaId);

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
      return res.status(500).json({ message: "Failed to fetch Odoo status" });
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
