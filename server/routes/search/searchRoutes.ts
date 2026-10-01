// server/routes/search/searchRoutes.ts
import { Router } from "express";
import { getUserContext } from "../../authContext";
import { listContactosForUser } from "../../auth/rbac";
import { storage } from "../../storage";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

const router = Router();

// Middleware simples de autenticação por sessão
const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.session?.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

// Tipos locais para os resultados de pesquisa
interface EntidadeSearchResult {
  id: string;
  label: string;
  extraInfo?: string;
  data: {
    cidade?: string | null;
    nif?: string | null;
  };
}

interface ContactoSearchResult {
  id: string;
  label: string;
  extraInfo?: string;
  data: {
    entidadeNome?: string | null;
    email?: string | null;
  };
}

interface VisitaSearchResult {
  id: string;
  label: string;
  extraInfo?: string;
  data: {
    entidadeNome?: string | null;
    date: string | Date;
  };
}

/** ------------------------------------------
 *  GET /api/search/entidades/search?q=...
 * ----------------------------------------- */
router.get("/entidades/search", isAuthenticated, async (req: any, res) => {
  try {
    const { userId, userRole, empresaId } = await getUserContext(req);
    if (!empresaId) {
      return res
        .status(400)
        .json({ message: "User has no company assigned" });
    }

    const q = ((req.query.q as string) || "").toLowerCase();

    const entidades = await storage.getEntidades(empresaId, userId, userRole);

    const results: EntidadeSearchResult[] = entidades
      .filter((e: any) => (e.nome || "").toLowerCase().includes(q))
      .sort((a: any, b: any) => (a.nome || "").localeCompare(b.nome || ""))
      .slice(0, 20)
      .map((e: any) => ({
        id: e.id,
        label: e.nome,
        extraInfo: e.cidade || e.nif || undefined,
        data: { cidade: e.cidade, nif: e.nif },
      }));

    res.json(results);
  } catch (error) {
    console.error("Error searching entidades:", error);
    res.status(500).json({ message: "Failed to search entidades" });
  }
});

/** ------------------------------------------
 *  GET /api/search/contactos/search?q=...&entidadeId=...
 *  RBAC automático via listContactosForUser
 * ----------------------------------------- */
router.get("/contactos/search", isAuthenticated, async (req: any, res) => {
  try {
    const { userId, userRole, empresaId } = await getUserContext(req);
    if (!empresaId) {
      return res
        .status(400)
        .json({ message: "User has no company assigned" });
    }

    const q = ((req.query.q as string) || "").toLowerCase();
    const entidadeId = req.query.entidadeId as string | undefined;

    const contactos = await listContactosForUser({
      empresaId,
      userId,
      userRole,
      entidadeId,
    });

    const results: ContactoSearchResult[] = contactos
      .filter((c: any) => (c.nome || "").toLowerCase().includes(q))
      .sort((a: any, b: any) => (a.nome || "").localeCompare(b.nome || ""))
      .slice(0, 20)
      .map((c: any) => ({
        id: c.id,
        label: c.nome,
        extraInfo: c.entidade?.nome || c.email || undefined,
        data: { entidadeNome: c.entidade?.nome, email: c.email },
      }));

    res.json(results);
  } catch (error) {
    console.error("Error searching contactos:", error);
    res.status(500).json({ message: "Failed to search contactos" });
  }
});

/** ------------------------------------------
 *  GET /api/search/visitas/search?q=...&entidadeId=...
 * ----------------------------------------- */
router.get("/visitas/search", isAuthenticated, async (req: any, res) => {
  try {
    const { userId, userRole, empresaId } = await getUserContext(req);
    if (!empresaId) {
      return res
        .status(400)
        .json({ message: "User has no company assigned" });
    }

    const q = ((req.query.q as string) || "").toLowerCase();
    const entidadeId = req.query.entidadeId as string | undefined;

    let visitas = await storage.getVisitas(empresaId, userId, userRole);

    if (entidadeId) {
      visitas = visitas.filter((v: any) => v.entidadeId === entidadeId);
    }

    const results: VisitaSearchResult[] = visitas
      .filter((v: any) => {
        const notas = (v.notas || "").toLowerCase();
        const entidadeNome = (v.entidade?.nome || "").toLowerCase();
        return notas.includes(q) || entidadeNome.includes(q);
      })
      .sort(
        (a: any, b: any) =>
          new Date(b.dataVisita).getTime() -
          new Date(a.dataVisita).getTime()
      )
      .slice(0, 20)
      .map((v: any) => ({
        id: v.id,
        label: `${format(
          new Date(v.dataVisita),
          "yyyy-MM-dd",
          { locale: pt }
        )} – ${v.entidade?.nome || "N/A"}`,
        extraInfo: v.entidade?.nome,
        data: {
          entidadeNome: v.entidade?.nome,
          date: v.dataVisita,
        },
      }));

    res.json(results);
  } catch (error) {
    console.error("Error searching visitas:", error);
    res.status(500).json({ message: "Failed to search visitas" });
  }
});

export default router;
