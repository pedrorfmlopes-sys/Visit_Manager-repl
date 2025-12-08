import express from "express";
import { getUserContext } from "../../authContext";
import { storage } from "../../storage";

const router = express.Router();

// Middleware admin only
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.session?.user || req.session.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};

// ========================================================
// GET /api/admin/entidade-tipos — Listar tipos de entidade
// (montado em /api/admin/entidade-tipos no index.ts)
// ========================================================
router.get("/", requireAdmin, async (req: any, res) => {
  try {
    const { empresaId } = await getUserContext(req);

    if (!empresaId) {
      return res
        .status(400)
        .json({ message: "User has no company assigned" });
    }

    const tipos = await storage.getEntidadeTipos(empresaId);
    res.json(tipos);
  } catch (error) {
    console.error("[EntidadeTiposRoutes] Error fetching tipos:", error);
    res.status(500).json({ message: "Failed to fetch entidade tipos" });
  }
});

// ========================================================
// POST /api/admin/entidade-tipos — Criar tipo de entidade
// ========================================================
router.post("/", requireAdmin, async (req: any, res) => {
  try {
    const { empresaId } = await getUserContext(req);

    if (!empresaId) {
      return res
        .status(400)
        .json({ message: "User has no company assigned" });
    }

    const created = await storage.createEntidadeTipo(req.body, empresaId);
    res.json(created);
  } catch (error: any) {
    console.error("[EntidadeTiposRoutes] Error creating tipo:", error);
    res.status(400).json({
      message: "Failed to create entidade tipo",
      error: error?.message,
    });
  }
});

// ========================================================
// PATCH /api/admin/entidade-tipos/:id — Atualizar tipo
// ========================================================
router.patch("/:id", requireAdmin, async (req: any, res) => {
  try {
    const { empresaId } = await getUserContext(req);

    if (!empresaId) {
      return res
        .status(400)
        .json({ message: "User has no company assigned" });
    }

    const updated = await storage.updateEntidadeTipo(
      req.params.id,
      req.body,
      empresaId
    );

    if (!updated) {
      return res
        .status(404)
        .json({ message: "Entidade tipo not found or unauthorized" });
    }

    res.json(updated);
  } catch (error) {
    console.error("[EntidadeTiposRoutes] Error updating tipo:", error);
    res.status(500).json({ message: "Failed to update entidade tipo" });
  }
});

export default router;
