// server/routes/authRoutes.ts
import express, { type Request, type Response } from "express";

export function authRoutes(app: express.Express) {
  /**
   * Handler comum para devolver utilizador autenticado
   */
  const handleGetUser = (req: Request & { session?: any }, res: Response) => {
    const sessionUser = req.session?.user;

    if (!sessionUser) {
      return res.status(401).json({ user: null });
    }

    return res.json({
      user: sessionUser,
    });
  };

  /**
   * GET /api/auth/me
   * Devolve o utilizador autenticado a partir da sessão.
   */
  app.get("/api/auth/me", handleGetUser);

  /**
   * GET /api/auth/user
   * Alias de /api/auth/me para compatibilidade com frontend.
   */
  app.get("/api/auth/user", handleGetUser);

  /**
   * POST /api/auth/logout
   * Termina a sessão do utilizador.
   */
  app.post(
    "/api/auth/logout",
    (req: Request & { session?: any }, res: Response) => {
      if (req.session?.destroy) {
        req.session.destroy(() => {
          res.json({ success: true });
        });
      } else {
        res.json({ success: true });
      }
    },
  );
}
