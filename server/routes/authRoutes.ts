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

    // ⚠ Mantemos exatamente o comportamento antigo:
    // devolve diretamente o user, não embrulhado em { user: ... }
    return res.json(userPayload);
  };

  app.get("/api/auth/me", handleGetUser);
  app.get("/api/auth/user", handleGetUser);

  // ---------- GET /api/users — listar utilizadores da mesma empresa ----------
  app.get("/api/users", async (req: Request, res: Response) => {
    const sessUser = req.session.user;

    if (!sessUser?.id) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    if (!sessUser.empresaId) {
      return res
        .status(400)
        .json({ message: "User has no company assigned" });
    }

    try {
      const rows = await db
        .select()
        .from(users)
        .where(eq(users.empresaId, sessUser.empresaId));

      const mapped = rows.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        firstName: u.firstName,
        lastName: u.lastName,
        empresaId: u.empresaId,
        nome:
          [u.firstName, u.lastName].filter(Boolean).join(" ") ||
          u.email,
      }));

      return res.json(mapped);
    } catch (error) {
      console.error("[authRoutes] Erro em GET /api/users:", error);
      return res
        .status(500)
        .json({ message: "Erro ao listar utilizadores" });
    }
  });

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

  // ---------- POST /api/dev/toggle-role ----------
  // Endpoint de desenvolvimento para alternar entre admin e agent
  app.post("/api/dev/toggle-role", async (req: Request, res: Response) => {
    const sessUser = req.session.user;
    if (!sessUser?.id) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    // Toggle role
    const newRole = sessUser.role === "admin" ? "agent" : "admin";

    try {
      // Atualizar na BD
      await db
        .update(users)
        .set({ role: newRole })
        .where(eq(users.id, sessUser.id));

      // Atualizar na sessão
      req.session.user = {
        ...sessUser,
        role: newRole,
      };

      // Guardar sessão
      req.session.save((err) => {
        if (err) {
          console.error("[auth] Erro ao gravar sessão:", err);
          return res
            .status(500)
            .json({ error: "Erro ao gravar sessão" });
        }
        return res.json({ success: true, newRole });
      });
    } catch (error) {
      console.error("[auth] Erro ao toggle role:", error);
      return res
        .status(500)
        .json({ error: "Erro ao alterar role" });
    }
  });
}
