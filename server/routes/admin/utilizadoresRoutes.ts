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
// GET /api/admin/utilizadores — List all users in company
// ========================================================
router.get("/", requireAdmin, async (req: any, res) => {
  try {
    const { empresaId } = await getUserContext(req);

    if (!empresaId)
      return res.status(400).json({ message: "User has no company assigned" });

    const utilizadores = await storage.getUtilizadoresByEmpresa(empresaId);
    res.json(utilizadores);
  } catch (error) {
    console.error("[UtilizadoresRoutes] Error fetching utilizadores:", error);
    res.status(500).json({ message: "Failed to fetch utilizadores" });
  }
});

// ========================================================
// POST /api/admin/utilizadores — Create new user
// ========================================================
router.post("/", requireAdmin, async (req: any, res) => {
  try {
    const { empresaId } = await getUserContext(req);

    if (!empresaId)
      return res.status(400).json({ message: "User has no company assigned" });

    const { email, firstName, lastName, role } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const newUser = await storage.createUtilizador({
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      role: role || "agent",
      empresaId,
      ativo: true,
    });

    res.json(newUser);
  } catch (error: any) {
    console.error("[UtilizadoresRoutes] Error creating utilizador:", error);
    res.status(400).json({
      message: "Failed to create utilizador",
      error: error?.message,
    });
  }
});

// ========================================================
// PATCH /api/admin/utilizadores/:id — Update user
// ========================================================
router.patch("/:id", requireAdmin, async (req: any, res) => {
  try {
    const { empresaId } = await getUserContext(req);

    if (!empresaId)
      return res.status(400).json({ message: "User has no company assigned" });

    const { role, ativo } = req.body;

    const updateData: any = {};
    if (role !== undefined && ["admin", "agent"].includes(role)) {
      updateData.role = role;
    }
    if (ativo !== undefined) {
      updateData.ativo = ativo;
    }

    const updated = await storage.updateUtilizador(
      req.params.id,
      updateData,
      empresaId
    );

    if (!updated) {
      return res
        .status(404)
        .json({ message: "Utilizador not found or unauthorized" });
    }

    res.json(updated);
  } catch (error) {
    console.error("[UtilizadoresRoutes] Error updating utilizador:", error);
    res.status(500).json({ message: "Failed to update utilizador" });
  }
});

export default router;
