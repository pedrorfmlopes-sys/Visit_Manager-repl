// server/routes/crm/marcasRoutes.ts
import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../../replitAuth";
import { getUserContext } from "../../authContext";
import { storage } from "../../storage";

export function marcasCrmRoutes(app: Express) {
  /**
   * GET /api/marcas
   *
   * - Acessível a qualquer utilizador autenticado (admin ou agent)
   * - Filtra por empresaId do contexto
   * - Suporta ?onlyAtivas=true para mostrar só marcas ativas
   */
  app.get(
    "/api/marcas",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { empresaId } = await getUserContext(req as any);

        if (!empresaId) {
          return res
            .status(400)
            .json({ message: "Contexto de empresa em falta" });
        }

        const onlyAtivas =
          String(req.query.onlyAtivas ?? "").toLowerCase() === "true";

        // Reutiliza exatamente a mesma função que o backoffice admin usa
        const marcas = await storage.getMarcasByEmpresa(empresaId);

        const filtradas = onlyAtivas
          ? (marcas || []).filter((m: any) => m.ativa === true)
          : marcas || [];

        // Ordenar por nome (opcional, mas ajuda no UX)
        filtradas.sort((a: any, b: any) =>
          (a.nome || "").localeCompare(b.nome || ""),
        );

        return res.json(filtradas);
      } catch (error) {
        console.error("[marcasCrmRoutes] Erro em GET /api/marcas:", error);
        return res
          .status(500)
          .json({ message: "Erro ao carregar marcas" });
      }
    },
  );
}
