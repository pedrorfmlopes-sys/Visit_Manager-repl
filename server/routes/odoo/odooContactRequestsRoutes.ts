// server/routes/odoo/odooContactRequestsRoutes.ts
import { Router } from "express";
import { getUserContext } from "../../authContext";
import { storage } from "../../storage";
import { db } from "../../db";
import { and, eq, desc, isNull } from "drizzle-orm";
import { odooContactRequests } from "../../../shared/schema";
import {
  assertEmpresaModuleEnabled,
  buildModuleDisabledResponse,
  isModuleDisabledError,
} from "../../modules";


const router = Router();

/**
 * Middleware simples de autenticação
 */
const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.session?.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  next();
};

/**
 * Middleware apenas para admin
 */
const requireAdmin = (req: any, res: any, next: any) => {
  const user = req.session?.user;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin only" });
  }
  next();
};

async function assertOdooContactsEnabled(req: any) {
  const { empresaId } = await getUserContext(req);
  await assertEmpresaModuleEnabled(empresaId, "odoo_contacts");
}

/**
 * ===========================================================
 *                ODOO CONTACT REQUESTS ROUTES
 * ===========================================================
 */

/**
 * POST /api/odoo/contact-requests
 * Qualquer utilizador autenticado pode criar pedidos
 */
router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const { empresaId, userId } = await getUserContext(req);

    if (!empresaId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Utilizador sem empresa ou utilizador associado.",
      });
    }

    await assertEmpresaModuleEnabled(empresaId, "odoo_contacts");

    const empresa = await storage.getEmpresa(empresaId);
    if (!empresa) {
      return res.status(404).json({
        success: false,
        message: "Empresa não encontrada.",
      });
    }

    const { contactoId, entidadeId, tipo, mensagem } = req.body || {};

    if (!tipo || typeof tipo !== "string") {
      return res.status(422).json({
        success: false,
        message: "Campo 'tipo' é obrigatório.",
      });
    }
    if (contactoId && typeof contactoId !== "string") {
      return res
        .status(422)
        .json({ success: false, message: "Campo 'contactoId' inválido." });
    }
    if (entidadeId && typeof entidadeId !== "string") {
      return res
        .status(422)
        .json({ success: false, message: "Campo 'entidadeId' inválido." });
    }
    if (mensagem && typeof mensagem !== "string") {
      return res
        .status(422)
        .json({ success: false, message: "Campo 'mensagem' inválido." });
    }

    const created = await storage.createOdooContactRequest({
      empresaId,
      userId,
      contactoId: contactoId || null,
      entidadeId: entidadeId || null,
      tipo,
      mensagem: mensagem || null,
    });

    return res.json({ success: true, data: created });
  } catch (error: any) {
    if (isModuleDisabledError(error)) {
      return res.status(403).json(buildModuleDisabledResponse(error));
    }
    console.error("[OdooContactRequests] Erro ao criar pedido:", error);
    return res.status(500).json({
      success: false,
      message: error?.message ?? "Erro ao criar pedido de contacto Odoo.",
    });
  }
});

/**
 * GET /api/odoo/contact-requests/my
 * Histórico dos pedidos do utilizador atual
 */
router.get("/my", isAuthenticated, async (req: any, res) => {
  try {
    const { empresaId, userId } = await getUserContext(req);

    if (!empresaId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Utilizador sem empresa ou utilizador associado.",
      });
    }

    await assertEmpresaModuleEnabled(empresaId, "odoo_contacts");

    const empresaIdStr = empresaId as string;

    const pedidos = await db
      .select()
      .from(odooContactRequests)
      .where(
        and(
          eq(odooContactRequests.empresaId, empresaIdStr),
          eq(odooContactRequests.userId, userId)
        )
      )
      .orderBy(desc(odooContactRequests.createdAt));

    return res.json({ success: true, data: pedidos });
  } catch (error) {
    if (isModuleDisabledError(error)) {
      return res.status(403).json(buildModuleDisabledResponse(error));
    }
    console.error(
      "[OdooContactRequests] Erro ao carregar histórico pessoal:",
      error
    );
    return res.status(500).json({
      success: false,
      message: "Erro ao carregar os teus pedidos.",
    });
  }
});

/**
 * GET /api/odoo/contact-requests
 * ADMIN — Lista completa de pedidos
 */
router.get("/", isAuthenticated, requireAdmin, async (req: any, res) => {
  try {
    const { empresaId } = await getUserContext(req);

    if (!empresaId) {
      return res.status(400).json({
        success: false,
        message: "Utilizador sem empresa associado.",
      });
    }

    await assertEmpresaModuleEnabled(empresaId, "odoo_contacts");

    const requests = await storage.listOdooContactRequestsByEmpresa(
      empresaId as string
    );
    return res.json({ success: true, data: requests });
  } catch (error: any) {
    if (isModuleDisabledError(error)) {
      return res.status(403).json(buildModuleDisabledResponse(error));
    }
    console.error("[OdooContactRequests] Erro ao listar pedidos:", error);
    return res.status(500).json({
      success: false,
      message: error?.message ?? "Erro ao listar pedidos de contacto Odoo.",
    });
  }
});

/**
 * PATCH /api/odoo/contact-requests/:id
 * ADMIN — Alterar estado (pendente, em_progresso, concluido)
 */
router.patch("/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
  try {
    const { empresaId } = await getUserContext(req);
    const { id } = req.params;
    const { estado } = req.body as {
      estado?: "pendente" | "em_progresso" | "concluido";
    };

    if (!empresaId) {
      return res.status(400).json({
        success: false,
        message: "Utilizador sem empresa associado.",
      });
    }

    await assertEmpresaModuleEnabled(empresaId, "odoo_contacts");

    const empresaIdStr = empresaId as string;

    if (!id) {
      return res.status(400).json({ success: false, message: "ID não definido." });
    }

    if (!estado || !["pendente", "em_progresso", "concluido"].includes(estado)) {
      return res.status(400).json({
        success: false,
        message:
          "Estado inválido. Use 'pendente', 'em_progresso' ou 'concluido'.",
      });
    }

    const now = new Date();

    const [updated] = await db
      .update(odooContactRequests)
      .set({ estado, updatedAt: now })
      .where(
        and(
          eq(odooContactRequests.id, id),
          eq(odooContactRequests.empresaId, empresaIdStr)
        )
      )
      .returning();

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Pedido não encontrado." });
    }

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    if (isModuleDisabledError(error)) {
      return res.status(403).json(buildModuleDisabledResponse(error));
    }
    console.error("[OdooContactRequests] Erro ao atualizar estado:", error);
    return res.status(500).json({
      success: false,
      message: error?.message ?? "Erro ao atualizar estado.",
    });
  }
});

/**
 * DELETE /api/odoo/contact-requests/:id
 * ADMIN — Apagar pedido
 */
router.delete("/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
  try {
    await assertOdooContactsEnabled(req);
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "ID é obrigatório." });
    }

    await db.delete(odooContactRequests).where(eq(odooContactRequests.id, id));

    return res.json({
      success: true,
      message: "Pedido eliminado com sucesso.",
    });
  } catch (error: any) {
    if (isModuleDisabledError(error)) {
      return res.status(403).json(buildModuleDisabledResponse(error));
    }
    console.error("[OdooContactRequests] Erro ao eliminar pedido:", error);
    return res.status(500).json({
      success: false,
      message: error?.message ?? "Erro ao eliminar pedido.",
    });
  }
});

/**
 * PATCH /api/odoo/contact-requests/my/mark-seen
 * Utilizador marca pedidos concluídos como vistos
 */
router.patch("/my/mark-seen", isAuthenticated, async (req: any, res) => {
  try {
    const { empresaId, userId } = await getUserContext(req);

    if (!empresaId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Utilizador sem empresa ou utilizador associado.",
      });
    }

    await assertEmpresaModuleEnabled(empresaId, "odoo_contacts");

    const empresaIdStr = empresaId as string;
    const now = new Date();

    const updated = await db
      .update(odooContactRequests)
      .set({ userSeenAt: now })
      .where(
        and(
          eq(odooContactRequests.empresaId, empresaIdStr),
          eq(odooContactRequests.userId, userId),
          eq(odooContactRequests.estado, "concluido"),
          isNull(odooContactRequests.userSeenAt)
        )
      )
      .returning({ id: odooContactRequests.id });

    return res.json({ success: true, updatedCount: updated.length });
  } catch (error) {
    if (isModuleDisabledError(error)) {
      return res.status(403).json(buildModuleDisabledResponse(error));
    }
    console.error("[OdooContactRequests] mark-seen erro:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao marcar pedidos como vistos.",
    });
  }
});

/**
 * DELETE /api/odoo/contact-requests/my/:id
 * Utilizador apaga o seu próprio pedido — apenas se estiver concluído
 */
router.delete("/my/:id", isAuthenticated, async (req: any, res) => {
  try {
    const { empresaId, userId } = await getUserContext(req);
    const { id } = req.params;

    if (!empresaId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Utilizador sem empresa ou utilizador associado.",
      });
    }

    await assertEmpresaModuleEnabled(empresaId, "odoo_contacts");

    const empresaIdStr = empresaId as string;

    const [pedido] = await db
      .select()
      .from(odooContactRequests)
      .where(
        and(
          eq(odooContactRequests.id, id),
          eq(odooContactRequests.empresaId, empresaIdStr),
          eq(odooContactRequests.userId, userId)
        )
      )
      .limit(1);

    if (!pedido) {
      return res
        .status(404)
        .json({ success: false, message: "Pedido não encontrado." });
    }

    if (pedido.estado !== "concluido") {
      return res.status(400).json({
        success: false,
        message: "Só pode apagar pedidos concluídos.",
      });
    }

    await db.delete(odooContactRequests).where(eq(odooContactRequests.id, id));

    return res.json({
      success: true,
      message: "Pedido eliminado com sucesso.",
    });
  } catch (error) {
    if (isModuleDisabledError(error)) {
      return res.status(403).json(buildModuleDisabledResponse(error));
    }
    console.error("[OdooContactRequests] Erro ao apagar pedido:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao eliminar pedido.",
    });
  }
});

export default router;
