// server/routes/misc/proximityRoutes.ts
import { Router } from "express";
import { requireUserContext } from "../../auth/rbac";

export const proximityRouter = Router();

/**
 * FASE 26 — Sugestões de visitas próximas por GPS
 * POST /api/visitas/proximidade
 */
proximityRouter.post("/visitas/proximidade", async (req: any, res) => {
  try {
    const { empresaId } = await requireUserContext(req);

    if (!empresaId) {
      return res.status(400).json({ message: "User has no company assigned" });
    }

    const { lat, lng } = req.body;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ message: "Invalid coordinates" });
    }

    const sugestao = await req.storage.getNearbyVisitSuggestions(
      empresaId,
      lat,
      lng,
      200
    );

    return res.json({ sugestao });
  } catch (error) {
    console.error("Error getting nearby suggestions:", error);
    const status = (error as any)?.status ?? 500;
    res.status(status).json({ message: "Failed to get nearby suggestions" });
  }
});
