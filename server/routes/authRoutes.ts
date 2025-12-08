// server/routes/authRoutes.ts
import type { Express, Request, Response } from "express";
import { db } from "../db";
import {
  users,
  empresas,
  type User,
  type Empresa,
} from "shared/schema"; 
import { eq } from "drizzle-orm";

interface SessionUser {
  id: string;
  role: "admin" | "agent";
  empresaId: string | null;
}

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}

function buildAuthUserPayload(userRow: any, empresaRow?: any) {
  const nome =
    [userRow.firstName, userRow.lastName]
      .filter(Boolean)
      .join(" ") || userRow.email;

  const empresa =
    empresaRow && empresaRow.id
      ? {
          id: empresaRow.id,
          nome: empresaRow.nome,
          logoUrl: empresaRow.logoUrl ?? undefined,
          mostrarMarcasEmVisitas: !!empresaRow.mostrarMarcasEmVisitas,
          theme:
            (empresaRow.theme as "light-business" | "dark-pro") ??
            "light-business",
          uiSettings: empresaRow.uiSettings ?? undefined,
          crmLeadsEnabled: !!empresaRow.crmLeadsEnabled,
          odooCrmEnabled: !!empresaRow.odooCrmEnabled,
          odooContactsFeatureEnabled:
            !!empresaRow.odooContactsFeatureEnabled,
          odooContactsAdminEnabled:
            !!empresaRow.odooContactsAdminEnabled,
          odooContactsAgentsEnabled:
            !!empresaRow.odooContactsAgentsEnabled,
          crmVisitsOdooSyncEnabled:
            !!empresaRow.crmVisitsOdooSyncEnabled,
        }
      : undefined;

  return {
    id: userRow.id,
    email: userRow.email,
    role: userRow.role,
    firstName: userRow.firstName,
    lastName: userRow.lastName,
    empresaId: userRow.empresaId,
    nome,
    empresa,
  };
}

export function authRoutes(app: Express) {
  // ---------- GET /api/auth/me e /api/auth/user ----------
  const handleGetUser = async (req: Request, res: Response) => {
    const sessUser = req.session.user;
    if (!sessUser?.id) {
      return res.status(401).json({ user: null });
    }

    const rows = await db
      .select({
        user: users,
        empresa: empresas,
      })
      .from(users)
      .leftJoin(empresas, eq(empresas.id, users.empresaId))
      .where(eq(users.id, sessUser.id))
      .limit(1);

    if (!rows.length) {
      return res.status(401).json({ user: null });
    }

    const row = rows[0];
    const userPayload = buildAuthUserPayload(row.user, row.empresa);

    return res.json({ user: userPayload });
  };

  app.get("/api/auth/me", handleGetUser);
  app.get("/api/auth/user", handleGetUser);

  // ---------- POST /api/auth/logout ----------
  // Nota: O fluxo principal de logout usa /api/logout (via replitAuth.ts)
  // Este endpoint e' um fallback para chamadas diretas do frontend
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("[auth] Erro ao destruir sessão:", err);
      }
      res.json({ ok: true });
    });
  });

  // NOTA: /api/login e' definido em replitAuth.ts (OAuth Replit)
  // NAO duplicar aqui para evitar conflitos
}
