import express, { type Request, type Response, type NextFunction } from "express";
import { storage } from "../../storage";

const router = express.Router();

// ==========================================================
// Middleware helpers (locais a este módulo)
// ==========================================================
const isAuthenticated = (req: any, res: Response, next: NextFunction) => {
  if (!req.session?.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

const requireAdmin = (req: any, res: Response, next: NextFunction) => {
  if (!req.session?.user || req.session.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};

async function getUserContext(req: any) {
  return {
    userId: req.session?.user?.id || null,
    userRole: req.session?.user?.role || null,
    empresaId: req.session?.user?.empresaId || null,
  };
}

// ==========================================================
// GET /api/entidades
// ==========================================================
router.get(
  "/api/entidades",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      const entidades = await storage.getEntidades(
        empresaId,
        userId,
        userRole,
      );

      res.json(entidades);
    } catch (error) {
      console.error("Error fetching entidades:", error);
      res.status(500).json({ message: "Failed to fetch entidades" });
    }
  },
);

// ==========================================================
// GET /api/entidades/:id
// ==========================================================
router.get(
  "/api/entidades/:id",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);
      const { id } = req.params;

      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      const entidade = await storage.getEntidade(
        id,
        empresaId,
        userId,
        userRole,
      );

      if (!entidade) {
        return res.status(404).json({ message: "Entidade not found" });
      }

      res.json(entidade);
    } catch (error) {
      console.error("Error fetching entidade:", error);
      res.status(500).json({ message: "Failed to fetch entidade" });
    }
  },
);

// ==========================================================
// POST /api/entidades
// ==========================================================
router.post(
  "/api/entidades",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId } = await getUserContext(req);

      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      const entidadeData = { ...req.body };

      const newEntidade = await storage.createEntidade(entidadeData, empresaId);

      res.json(newEntidade);
    } catch (error) {
      console.error("Error creating entidade:", error);
      res.status(400).json({ message: "Failed to create entidade" });
    }
  },
);

// ==========================================================
// PATCH /api/entidades/:id
// ==========================================================
router.patch(
  "/api/entidades/:id",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);
      const { id } = req.params;

      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      const updated = await storage.updateEntidade(
        id,
        req.body,
        empresaId,
        userId,
        userRole,
      );

      if (!updated) {
        return res
          .status(404)
          .json({ message: "Entidade not found or unauthorized" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating entidade:", error);
      res.status(400).json({ message: "Failed to update entidade" });
    }
  },
);

// ==========================================================
// DELETE /api/entidades/:id
// ==========================================================
router.delete(
  "/api/entidades/:id",
  isAuthenticated,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { empresaId } = await getUserContext(req);
      const { id } = req.params;

      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      await storage.deleteEntidade(id, empresaId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting entidade:", error);
      res.status(500).json({ message: "Failed to delete entidade" });
    }
  },
);

// ==========================================================
// GET /api/entidade-tipos (Ativos)
// ==========================================================
router.get(
  "/api/entidade-tipos",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId } = await getUserContext(req);

      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      const tipos = await storage.getEntidadeTiposAtivos(empresaId);

      res.json(tipos);
    } catch (error) {
      console.error("Error fetching entidade tipos:", error);
      res.status(500).json({ message: "Failed to fetch entidade tipos" });
    }
  },
);

// ==========================================================
// GET /api/crm/entidades/search
// (usado pelos componentes SearchSelects no frontend)
// ==========================================================
router.get(
  "/api/crm/entidades/search",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      const q = ((req.query.q as string) || "").toLowerCase();

      const entidades = await storage.getEntidades(
        empresaId,
        userId,
        userRole,
      );

      const results = (entidades || [])
        .filter((e: any) => (e.nome || "").toLowerCase().includes(q))
        .sort((a: any, b: any) => (a.nome || "").localeCompare(b.nome || ""))
        .slice(0, 20)
        .map((e: any) => ({
          id: e.id,
          label: e.nome,
          extraInfo: e.cidade || e.nif || undefined,
          data: {
            cidade: e.cidade,
            nif: e.nif,
          },
        }));

      res.json(results);
    } catch (error) {
      console.error("Error searching entidades:", error);
      res.status(500).json({ message: "Failed to search entidades" });
    }
  },
);


// ==========================================================
// Export para o agregador de rotas
// ==========================================================

// Compatível com o padrão antigo: registerEntidadesRoutes(app)
export function registerEntidadesRoutes(app: express.Express) {
  app.use(router);
}

// Default export do router (se em algum lado estiverem a fazer app.use(entidadesRoutes))
export default router;
