// server/routes/admin/marcasRoutes.ts
import express from "express";
import { getUserContext } from "../../authContext";
import { storage } from "../../storage";

export function marcasRoutes(app: express.Express) {
  // Middleware admin only
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.session?.user || req.session.user.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }
    next();
  };

  // ========================================================
  // GET /api/admin/marcas — Listar todas as marcas
  // ========================================================
  app.get("/api/admin/marcas", requireAdmin, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      const marcas = await storage.getMarcasByEmpresa(empresaId);
      res.json(marcas);
    } catch (error) {
      console.error("[MarcasRoutes] Error fetching marcas:", error);
      res.status(500).json({ message: "Failed to fetch marcas" });
    }
  });

  // ========================================================
  // POST /api/admin/marcas — Criar marca
  // ========================================================
  app.post("/api/admin/marcas", requireAdmin, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      const { nome, codigo, descricao, logoUrl, ativa } = req.body;

      if (!nome) {
        return res.status(400).json({ message: "Brand name is required" });
      }

      const newMarca = await storage.createMarca({
        empresaId,
        nome,
        codigo: codigo || null,
        descricao: descricao || null,
        logoUrl: logoUrl || null,
        ativa: ativa !== false,
      });

      res.json(newMarca);
    } catch (error) {
      console.error("[MarcasRoutes] Error creating marca:", error);
      res.status(500).json({ message: "Failed to create marca" });
    }
  });

  // ========================================================
  // PATCH /api/admin/marcas/:id — Atualizar marca
  // ========================================================
  app.patch("/api/admin/marcas/:id", requireAdmin, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      const updated = await storage.updateMarca(
        req.params.id,
        req.body,
        empresaId
      );

      if (!updated) {
        return res
          .status(404)
          .json({ message: "Marca não encontrada" });
      }

      res.json(updated);
    } catch (error) {
      console.error("[MarcasRoutes] Error updating marca:", error);
      res.status(500).json({ message: "Failed to update marca" });
    }
  });
}
