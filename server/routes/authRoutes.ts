// server/routes/authRoutes.ts
import type { Express, Request, Response } from "express";
import { db } from "../db";
import {
  users,
  empresas,
  externalIdentities,
  passwordResetTokens,
  sessions,
} from "shared/schema";
import {
  isEmpresaLicenseActive,
  resolveEmpresaModules,
  type EmpresaRole,
} from "shared/modules";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../passwordAuth";
import {
  createPasswordResetToken,
  hashResetToken,
  isResetTokenShapeValid,
} from "../passwordReset";
import { sendPasswordResetEmail } from "../emailTransport";
import { buildPasswordSetupUrl } from "../publicAppUrl";

interface SessionUser {
  id: string;
  role: "admin" | "agent";
  empresaId: string | null;
}

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(120),
  companyName: z.string().trim().min(2).max(255),
  password: z.string().min(10).max(128),
});

const completeSocialSchema = z.object({
  companyName: z.string().trim().min(2).max(255),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254),
});

const resetPasswordSchema = z.object({
  token: z.string().max(128),
  password: z.string().min(10).max(128),
});

const authAttempts = new Map<string, { count: number; resetAt: number }>();
const dummyPasswordHash = hashPassword("invalid-account-password");

function allowAuthAttempt(ip: string) {
  const now = Date.now();
  const attempt = authAttempts.get(ip);
  if (!attempt || attempt.resetAt <= now) {
    authAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  attempt.count += 1;
  return attempt.count <= 20;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function splitName(name: string) {
  const [firstName, ...lastNameParts] = name.trim().split(/\s+/);
  return {
    firstName,
    lastName: lastNameParts.join(" ") || null,
  };
}

function establishSession(req: Request, user: SessionUser) {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        reject(regenerateError);
        return;
      }
      req.session.user = user;
      req.session.save((saveError) => {
        if (saveError) reject(saveError);
        else resolve();
      });
    });
  });
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
          odooContactsNoPermissionMessage:
            empresaRow.odooContactsNoPermissionMessage ?? null,
          licensePlan: empresaRow.licensePlan ?? "enterprise",
          licenseStatus: empresaRow.licenseStatus ?? "active",
          licenseExpiresAt: empresaRow.licenseExpiresAt ?? null,
          licenseMaxUsers: empresaRow.licenseMaxUsers ?? null,
          modules: resolveEmpresaModules(
            empresaRow,
            (userRow.role as EmpresaRole) ?? "agent",
          ),
        }
      : undefined;

  return {
    id: userRow.id,
    email: userRow.email,
    role: userRow.role,
    isOwner: !!userRow.isOwner,
    invitedAt: userRow.invitedAt ?? null,
    acceptedAt: userRow.acceptedAt ?? null,
    firstName: userRow.firstName,
    lastName: userRow.lastName,
    empresaId: userRow.empresaId,
    odooPartnerId: userRow.odooPartnerId ?? null,
    odooLeadAccess: userRow.odooLeadAccess ?? "view",
    odooLeadCanCreate: !!userRow.odooLeadCanCreate,
    odooLeadCanViewAttachments: !!userRow.odooLeadCanViewAttachments,
    odooLeadCanViewChatter: !!userRow.odooLeadCanViewChatter,
    odooLeadCanPublishChatter: !!userRow.odooLeadCanPublishChatter,
    nome,
    empresa,
  };
}

export function authRoutes(app: Express) {
  app.post("/api/auth/password/forgot", async (req: Request, res: Response) => {
    const startedAt = Date.now();
    if (!allowAuthAttempt(req.ip || req.socket.remoteAddress || "unknown")) {
      return res.status(429).json({
        message: "Demasiadas tentativas. Aguarde alguns minutos.",
      });
    }

    const parsed = forgotPasswordSchema.safeParse(req.body);
    let developmentResetUrl: string | undefined;

    try {
      if (parsed.success) {
        const email = normalizeEmail(parsed.data.email);
        const [user] = await db
          .select({ id: users.id, email: users.email, ativo: users.ativo })
          .from(users)
          .where(sql`lower(${users.email}) = ${email}`)
          .limit(1);

        if (user?.ativo && user.email) {
          const reset = createPasswordResetToken();
          await db.transaction(async (tx) => {
            await tx
              .update(passwordResetTokens)
              .set({ usedAt: new Date() })
              .where(
                and(
                  eq(passwordResetTokens.userId, user.id),
                  isNull(passwordResetTokens.usedAt),
                ),
              );
            await tx.insert(passwordResetTokens).values({
              userId: user.id,
              tokenHash: reset.tokenHash,
              expiresAt: reset.expiresAt,
            });
          });

          const resetUrl = buildPasswordSetupUrl(req, reset.token);
          void sendPasswordResetEmail({
            to: user.email,
            resetUrl,
          }).catch((error) => {
            console.error("[auth] Failed to send password reset email:", error);
          });

          if (process.env.NODE_ENV !== "production") {
            developmentResetUrl = resetUrl;
          }
        }
      }
    } catch (error) {
      console.error("[auth] Failed to prepare password reset:", error);
    }

    const minimumResponseTime = 350;
    const remaining = minimumResponseTime - (Date.now() - startedAt);
    if (remaining > 0) await delay(remaining);

    return res.json({
      message:
        "Se existir uma conta com este email, receberá um link de recuperação.",
      ...(developmentResetUrl ? { developmentResetUrl } : {}),
    });
  });

  app.get("/api/auth/password/reset/validate", async (req, res) => {
    const token = String(req.query.token || "");
    if (!isResetTokenShapeValid(token)) {
      return res.json({ valid: false });
    }

    const [record] = await db
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .innerJoin(users, eq(users.id, passwordResetTokens.userId))
      .where(
        and(
          eq(passwordResetTokens.tokenHash, hashResetToken(token)),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
          eq(users.ativo, true),
        ),
      )
      .limit(1);
    return res.json({ valid: Boolean(record) });
  });

  app.post("/api/auth/password/reset", async (req: Request, res: Response) => {
    if (!allowAuthAttempt(req.ip || req.socket.remoteAddress || "unknown")) {
      return res.status(429).json({
        message: "Demasiadas tentativas. Aguarde alguns minutos.",
      });
    }

    const parsed = resetPasswordSchema.safeParse(req.body);
    if (
      !parsed.success ||
      !isResetTokenShapeValid(parsed.data.token)
    ) {
      return res.status(400).json({
        message: "O link é inválido ou expirou.",
      });
    }

    const tokenHash = hashResetToken(parsed.data.token);
    const [record] = await db
      .select({
        id: passwordResetTokens.id,
        userId: passwordResetTokens.userId,
      })
      .from(passwordResetTokens)
      .innerJoin(users, eq(users.id, passwordResetTokens.userId))
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
          eq(users.ativo, true),
        ),
      )
      .limit(1);
    if (!record) {
      return res.status(400).json({
        message: "O link é inválido ou expirou.",
      });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const now = new Date();
    const updated = await db.transaction(async (tx) => {
      const consumed = await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetTokens.id, record.id),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, now),
          ),
        )
        .returning({ id: passwordResetTokens.id });
      if (!consumed.length) return false;

      await tx
        .update(users)
        .set({ passwordHash, acceptedAt: now, updatedAt: now })
        .where(eq(users.id, record.userId));
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetTokens.userId, record.userId),
            isNull(passwordResetTokens.usedAt),
          ),
        );
      await tx
        .delete(sessions)
        .where(
          sql`${sessions.sess} -> 'user' ->> 'id' = ${record.userId}`,
        );
      return true;
    });

    if (!updated) {
      return res.status(400).json({
        message: "O link é inválido ou expirou.",
      });
    }
    return res.json({
      ok: true,
      message: "Palavra-passe alterada. Já pode iniciar sessão.",
    });
  });

  app.get("/api/auth/social/pending", (req: Request, res: Response) => {
    const pending = req.session.pendingSocial;
    if (!pending) return res.json({ pending: null });
    return res.json({
      pending: {
        provider: pending.provider,
        email: pending.email,
        firstName: pending.firstName,
        lastName: pending.lastName,
        profileImageUrl: pending.profileImageUrl,
      },
    });
  });

  app.delete("/api/auth/social/pending", async (req: Request, res: Response) => {
    delete req.session.pendingSocial;
    await new Promise<void>((resolve) => req.session.save(() => resolve()));
    return res.json({ ok: true });
  });

  app.post("/api/auth/social/complete", async (req: Request, res: Response) => {
    if (!allowAuthAttempt(req.ip || req.socket.remoteAddress || "unknown")) {
      return res.status(429).json({
        message: "Demasiadas tentativas. Aguarde alguns minutos.",
      });
    }

    const parsed = completeSocialSchema.safeParse(req.body);
    const pending = req.session.pendingSocial;
    if (!parsed.success || !pending) {
      return res.status(400).json({
        message: "A autenticação expirou. Volte a entrar com o fornecedor.",
      });
    }

    try {
      const existingEmail = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${pending.email}`)
        .limit(1);
      if (existingEmail.length) {
        return res.status(409).json({
          message: "Já existe uma conta com este email.",
        });
      }

      const newUser = await db.transaction(async (tx) => {
        const [company] = await tx
          .insert(empresas)
          .values({
            nome: parsed.data.companyName,
            email: pending.email,
            odooCrmEnabled: false,
            crmLeadsEnabled: false,
            odooContactsFeatureEnabled: false,
            crmVisitsOdooSyncEnabled: false,
            licensePlan: "enterprise",
            licenseStatus: "active",
          })
          .returning({ id: empresas.id });

        const [user] = await tx
          .insert(users)
          .values({
            email: pending.email,
            firstName: pending.firstName,
            lastName: pending.lastName,
            profileImageUrl: pending.profileImageUrl,
            role: "admin",
            empresaId: company.id,
            ativo: true,
            isOwner: true,
            acceptedAt: new Date(),
          })
          .returning({
            id: users.id,
            role: users.role,
            empresaId: users.empresaId,
          });

        await tx.insert(externalIdentities).values({
          userId: user.id,
          provider: pending.provider,
          subject: pending.subject,
          email: pending.email,
        });
        return user;
      });

      await establishSession(req, newUser);
      return res.status(201).json({ ok: true });
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({
          message: "Esta conta já está registada.",
        });
      }
      console.error("[auth] Error completing social registration:", error);
      return res.status(500).json({ message: "Não foi possível criar a conta." });
    }
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    if (!allowAuthAttempt(req.ip || req.socket.remoteAddress || "unknown")) {
      return res.status(429).json({
        message: "Demasiadas tentativas. Aguarde alguns minutos.",
      });
    }

    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Confirme os dados. A palavra-passe deve ter pelo menos 10 caracteres.",
      });
    }

    const email = normalizeEmail(parsed.data.email);
    const { firstName, lastName } = splitName(parsed.data.name);

    try {
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
      if (existing.length) {
        return res.status(409).json({
          message: "Já existe uma conta com este email.",
        });
      }

      const passwordHash = await hashPassword(parsed.data.password);
      const newUser = await db.transaction(async (tx) => {
        const [company] = await tx
          .insert(empresas)
          .values({
            nome: parsed.data.companyName,
            email,
            odooCrmEnabled: false,
            crmLeadsEnabled: false,
            odooContactsFeatureEnabled: false,
            crmVisitsOdooSyncEnabled: false,
            licensePlan: "enterprise",
            licenseStatus: "active",
          })
          .returning({ id: empresas.id });

        const [user] = await tx
          .insert(users)
          .values({
            email,
            passwordHash,
            firstName,
            lastName,
            role: "admin",
            empresaId: company.id,
            ativo: true,
            isOwner: true,
            acceptedAt: new Date(),
          })
          .returning({
            id: users.id,
            role: users.role,
            empresaId: users.empresaId,
          });
        return user;
      });

      await establishSession(req, newUser);
      return res.status(201).json({ ok: true });
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({
          message: "Já existe uma conta com este email.",
        });
      }
      console.error("[auth] Error registering email account:", error);
      return res.status(500).json({ message: "Não foi possível criar a conta." });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    if (!allowAuthAttempt(req.ip || req.socket.remoteAddress || "unknown")) {
      return res.status(429).json({
        message: "Demasiadas tentativas. Aguarde alguns minutos.",
      });
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(401).json({ message: "Email ou palavra-passe inválidos." });
    }

    const email = normalizeEmail(parsed.data.email);
    try {
      const [record] = await db
        .select({
          user: {
            id: users.id,
            role: users.role,
            empresaId: users.empresaId,
            ativo: users.ativo,
            passwordHash: users.passwordHash,
          },
          company: empresas,
        })
        .from(users)
        .leftJoin(empresas, eq(empresas.id, users.empresaId))
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);

      const user = record?.user;
      const storedHash = user?.passwordHash ?? (await dummyPasswordHash);
      const validPassword = await verifyPassword(parsed.data.password, storedHash);
      if (!user || !validPassword || !user.ativo) {
        return res.status(401).json({ message: "Email ou palavra-passe inválidos." });
      }
      if (!isEmpresaLicenseActive(record.company)) {
        return res.status(403).json({
          message: "A licença desta empresa não está ativa.",
        });
      }

      await establishSession(req, {
        id: user.id,
        role: user.role,
        empresaId: user.empresaId,
      });
      return res.json({ ok: true });
    } catch (error) {
      console.error("[auth] Error logging in with email:", error);
      return res.status(500).json({ message: "Não foi possível iniciar sessão." });
    }
  });

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
    if (!row.user.ativo || !isEmpresaLicenseActive(row.empresa)) {
      req.session.destroy(() => undefined);
      return res.status(row.user.ativo ? 403 : 401).json({
        user: null,
        message: row.user.ativo
          ? "A licença desta empresa não está ativa."
          : "Conta inativa.",
      });
    }

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
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ error: "Not found" });
    }

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
