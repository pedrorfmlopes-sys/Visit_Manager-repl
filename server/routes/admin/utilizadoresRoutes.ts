import express from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getUserContext, requireAdmin } from "../../authContext";
import { db } from "../../db";
import { sendUserInvitationEmail } from "../../emailTransport";
import { createPasswordResetToken } from "../../passwordReset";
import { buildPasswordSetupUrl } from "../../publicAppUrl";
import { safeUser } from "../../safeUser";
import { storage } from "../../storage";
import { empresas, passwordResetTokens, users } from "@shared/schema";
import {
  getOdooPartnerById,
  searchOdooPartners,
} from "../../integrations/odooClient";

const router = express.Router();

const createUserSchema = z.object({
  email: z.string().trim().email().max(254),
  firstName: z.string().trim().max(120).optional().nullable(),
  lastName: z.string().trim().max(120).optional().nullable(),
  role: z.enum(["admin", "agent"]).default("agent"),
});

const updateUserSchema = z
  .object({
    role: z.enum(["admin", "agent"]).optional(),
    ativo: z.boolean().optional(),
    odooPartnerId: z
      .union([
        z.string().trim().regex(/^\d+$/),
        z.string().trim().email().max(254),
        z.null(),
      ])
      .optional(),
    odooLeadAccess: z.enum(["view", "propose", "publish"]).optional(),
    odooLeadCanCreate: z.boolean().optional(),
    odooLeadCanViewAttachments: z.boolean().optional(),
    odooLeadCanViewChatter: z.boolean().optional(),
    odooLeadCanPublishChatter: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

async function getAdminContext(req: any) {
  const context = await getUserContext(req);
  if (!context.empresaId) throw new Error("Utilizador sem empresa.");

  const [actor, company] = await Promise.all([
    storage.getUser(context.userId),
    storage.getEmpresa(context.empresaId),
  ]);
  if (!actor || !company) throw new Error("Conta empresarial inválida.");
  return { ...context, actor, company };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function prepareInvitation(req: any, user: typeof users.$inferSelect) {
  const reset = createPasswordResetToken();
  const invitationUrl = buildPasswordSetupUrl(req, reset.token);
  await db.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          sql`${passwordResetTokens.usedAt} is null`,
        ),
      );
    await tx.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: reset.tokenHash,
      expiresAt: reset.expiresAt,
    });
    await tx
      .update(users)
      .set({ invitedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));
  });
  return invitationUrl;
}

router.get("/", requireAdmin, async (req: any, res) => {
  try {
    const { empresaId } = await getAdminContext(req);
    const utilizadores = await storage.getUtilizadoresByEmpresa(empresaId!);
    res.json(utilizadores.map(safeUser));
  } catch (error) {
    console.error("[UtilizadoresRoutes] Error fetching users:", error);
    res.status(500).json({ message: "Não foi possível obter os utilizadores." });
  }
});

router.post("/", requireAdmin, async (req: any, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Confirme os dados do utilizador." });
  }

  try {
    const { empresaId, actor, company } = await getAdminContext(req);
    if (parsed.data.role === "admin" && !actor.isOwner) {
      return res.status(403).json({
        message: "Apenas o proprietário pode convidar administradores.",
      });
    }

    const [{ activeUsers }] = await db
      .select({ activeUsers: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.empresaId, empresaId!), eq(users.ativo, true)));
    if (
      company.licenseMaxUsers !== null &&
      activeUsers >= company.licenseMaxUsers
    ) {
      return res.status(409).json({
        message: `A licença permite no máximo ${company.licenseMaxUsers} utilizadores ativos.`,
      });
    }

    const email = normalizeEmail(parsed.data.email);
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

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        firstName: parsed.data.firstName || null,
        lastName: parsed.data.lastName || null,
        role: parsed.data.role,
        empresaId,
        ativo: true,
        isOwner: false,
        invitedAt: new Date(),
      })
      .returning();
    const invitationUrl = await prepareInvitation(req, newUser);

    void sendUserInvitationEmail({
      to: email,
      companyName: company.nome,
      inviteUrl: invitationUrl,
    }).catch((error) => {
      console.error("[auth] Failed to send user invitation:", error);
    });

    return res.status(201).json({
      user: safeUser(newUser),
      message: "Convite criado com sucesso.",
      ...(process.env.NODE_ENV !== "production"
        ? { developmentInvitationUrl: invitationUrl }
        : {}),
    });
  } catch (error: any) {
    console.error("[UtilizadoresRoutes] Error inviting user:", error);
    if (error?.code === "23505") {
      return res.status(409).json({
        message: "Já existe uma conta com este email.",
      });
    }
    return res.status(500).json({
      message: "Não foi possível criar o convite.",
    });
  }
});

router.post("/:id/invite", requireAdmin, async (req: any, res) => {
  try {
    const { empresaId, actor, company } = await getAdminContext(req);
    const [target] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, req.params.id), eq(users.empresaId, empresaId!)))
      .limit(1);
    if (!target || !target.email) {
      return res.status(404).json({ message: "Utilizador não encontrado." });
    }
    if (target.role === "admin" && !actor.isOwner) {
      return res.status(403).json({
        message: "Apenas o proprietário pode gerir administradores.",
      });
    }
    if (target.acceptedAt) {
      return res.status(409).json({ message: "O utilizador já aceitou o convite." });
    }

    const invitationUrl = await prepareInvitation(req, target);
    void sendUserInvitationEmail({
      to: target.email,
      companyName: company.nome,
      inviteUrl: invitationUrl,
    }).catch((error) => {
      console.error("[auth] Failed to resend user invitation:", error);
    });
    return res.json({
      message: "Convite reenviado.",
      ...(process.env.NODE_ENV !== "production"
        ? { developmentInvitationUrl: invitationUrl }
        : {}),
    });
  } catch (error) {
    console.error("[UtilizadoresRoutes] Error resending invitation:", error);
    return res.status(500).json({ message: "Não foi possível reenviar o convite." });
  }
});

router.patch("/:id", requireAdmin, async (req: any, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    const invalidOdooPartner = parsed.error.issues.some(
      (issue) => issue.path[0] === "odooPartnerId",
    );
    return res.status(400).json({
      message: invalidOdooPartner
        ? "Indique um email válido ou o ID numérico do contacto Odoo."
        : "Alteração inválida.",
    });
  }

  try {
    const { empresaId, actor, company, userId } = await getAdminContext(req);
    const [target] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, req.params.id), eq(users.empresaId, empresaId!)))
      .limit(1);
    if (!target) {
      return res.status(404).json({ message: "Utilizador não encontrado." });
    }
    if (target.isOwner) {
      return res.status(403).json({
        message: "O proprietário da empresa não pode ser desativado ou despromovido.",
      });
    }
    if (
      (target.role === "admin" || parsed.data.role === "admin") &&
      !actor.isOwner
    ) {
      return res.status(403).json({
        message: "Apenas o proprietário pode gerir administradores.",
      });
    }
    if (target.id === userId && parsed.data.ativo === false) {
      return res.status(403).json({
        message: "Não pode desativar a sua própria conta.",
      });
    }
    if (parsed.data.ativo === true && !target.ativo) {
      const [{ activeUsers }] = await db
        .select({ activeUsers: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.empresaId, empresaId!), eq(users.ativo, true)));
      if (
        company.licenseMaxUsers !== null &&
        activeUsers >= company.licenseMaxUsers
      ) {
        return res.status(409).json({
          message: `A licença permite no máximo ${company.licenseMaxUsers} utilizadores ativos.`,
        });
      }
    }

    const updates = { ...parsed.data };
    if (parsed.data.odooLeadCanPublishChatter === true) {
      updates.odooLeadCanViewChatter = true;
    }
    if (parsed.data.odooLeadCanViewChatter === false) {
      updates.odooLeadCanPublishChatter = false;
    }
    if (parsed.data.odooPartnerId) {
      const reference = parsed.data.odooPartnerId;
      let partner = /^\d+$/.test(reference)
        ? await getOdooPartnerById(empresaId!, Number(reference))
        : null;

      if (!partner) {
        const normalizedReference = reference.trim().toLowerCase();
        const exactMatches = (await searchOdooPartners(empresaId!, reference))
          .filter(
            (candidate) =>
              candidate.email?.trim().toLowerCase() === normalizedReference,
          );

        if (exactMatches.length > 1) {
          return res.status(409).json({
            message:
              "Existem vários contactos Odoo com este email. Indique o ID do contacto correto.",
          });
        }
        partner = exactMatches[0] ?? null;
      }

      if (!partner) {
        return res.status(400).json({
          message: "Não foi encontrado no Odoo um contacto com este email ou ID.",
        });
      }

      const resolvedPartnerId = String(partner.id);
      const [existingMapping] = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.empresaId, empresaId!),
            eq(users.odooPartnerId, resolvedPartnerId),
          ),
        )
        .limit(1);
      if (existingMapping && existingMapping.id !== target.id) {
        return res.status(409).json({
          message:
            "Este contacto Odoo já está associado a outro agente da empresa.",
        });
      }
      if (
        target.email &&
        partner.email &&
        target.email.trim().toLowerCase() !== partner.email.trim().toLowerCase()
      ) {
        return res.status(409).json({
          message:
            "O email do contacto Odoo não corresponde ao email do agente.",
        });
      }
      updates.odooPartnerId = resolvedPartnerId;
    }

    const updated = await storage.updateUtilizador(
      target.id,
      updates,
      empresaId!,
    );
    return res.json(safeUser(updated!));
  } catch (error: any) {
    console.error("[UtilizadoresRoutes] Error updating user:", error);
    if (error?.code === "23505") {
      return res.status(409).json({
        message:
          "Este contacto Odoo já está associado a outro agente da empresa.",
      });
    }
    return res.status(500).json({ message: "Não foi possível atualizar o utilizador." });
  }
});

export default router;
