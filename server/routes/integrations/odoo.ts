import { isAuthenticated } from "../../replitAuth";
import { getUserContext, requireAdmin } from "../../authContext";
import { odooConnectionsStorage } from "../../storage/odooConnections";
import { storage } from "../../storage";
import { db } from "../../db";
import { contactos, entidades, leads } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { insertOdooConnectionSchema } from "@shared/schema";
import {
  searchOdooPartners,
  getOdooPartnerById,
  createOdooLead,
  createOdooPartner,
  updateOdooPartner,
  assertOdooEnabled,
  verifyOdooModelField,
  postOdooLeadAuditNote,
  subscribeOdooLeadFollowers,
} from "../../integrations/odooClient";
import { createLeadForVisita } from "../../integrations/odooLeadsFromVisitas";
import { assertLeadsEnabled } from "../../integrations/crmLeads";
import express from "express";
import { assertEmpresaModuleEnabled } from "../../modules";
import { isEmpresaModuleEnabled } from "@shared/modules";
import {
  contactDuplicateMessage,
  createContactoIfUnique,
  findDuplicateContacto,
} from "../../contactDeduplication";
import {
  createOrReplaceLeadApprovalRequest,
  getLeadActorPermissions,
  type LeadActorContext,
} from "../../leadAccess";
import { addLocalLeadFollower } from "../../leadFollowers";

async function createVisitLeadApproval(
  context: LeadActorContext,
  visit: any,
  odooPartnerId?: string | null,
) {
  let lead = await db.query.leads.findFirst({
    where: and(
      eq(leads.empresaId, context.empresaId),
      eq(leads.visitaId, visit.id),
    ),
  });
  if (!lead) {
    [lead] = await db
      .insert(leads)
      .values({
        empresaId: context.empresaId,
        visitaId: visit.id,
        entidadeId: visit.entidadeId,
        contactoId: visit.contactoId ?? null,
        titulo: `Visita - ${visit.entidade?.nome ?? "Lead"}`,
        descricao: visit.notas ?? null,
        estado: "novo",
        responsavelUserId: context.userId,
      })
      .returning();
  }
  await addLocalLeadFollower({
    empresaId: context.empresaId,
    leadId: lead.id,
    userId: context.userId,
    odooPartnerId,
    source: "app",
  });
  const request = await createOrReplaceLeadApprovalRequest({
    empresaId: context.empresaId,
    leadId: lead.id,
    requestedByUserId: context.userId,
    requestType: "create",
    proposedChanges: {},
  });
  return { lead, request };
}

function isRecoverableOdooConnectionError(error: any): boolean {
  const message = String(error?.message ?? "");
  return (
    message.includes("authenticate") ||
    message.includes("No user ID returned") ||
    message.includes("Odoo Server Error") ||
    message.includes("HTTP 401") ||
    message.includes("HTTP 403")
  );
}

function normalizeNumericId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function assertOdooContactsAccess(context: {
  empresaId?: string;
  userRole: "admin" | "agent";
}) {
  if (!context.empresaId) {
    const error: any = new Error("User has no company assigned");
    error.status = 400;
    throw error;
  }
  const company = await storage.getEmpresa(context.empresaId);
  if (!isEmpresaModuleEnabled(company, "odoo_contacts", context.userRole)) {
    const error: any = new Error("Sem permissão para sincronizar entidades com o Odoo.");
    error.status = 403;
    throw error;
  }
}

function getEntityPartnerPayload(entidade: any) {
  return {
    name: entidade.nome,
    email: entidade.email ?? null,
    phone: entidade.telefone ?? null,
    vat: entidade.nif ?? null,
    city: entidade.cidade ?? null,
    street: entidade.morada ?? null,
    zip: entidade.codigoPostal ?? null,
    website: entidade.website ?? null,
    comment: entidade.notas ?? entidade.descricao ?? null,
    isCompany: true,
  };
}

function getContactPartnerPayload(contacto: any, parentId?: number | null) {
  return {
    name: contacto.nome,
    email: contacto.email ?? null,
    phone: contacto.telemovel ?? null,
    mobile: contacto.telemovel ?? null,
    comment: contacto.observacoes ?? null,
    isCompany: false,
    parentId: parentId ?? null,
  };
}

async function markEntidadeSyncState(entidadeId: string, empresaId: string, patch: Record<string, unknown>) {
  await db
    .update(entidades)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(entidades.id, entidadeId), eq(entidades.empresaId, empresaId)));
}

async function markContactoSyncState(contactoId: string, empresaId: string, patch: Record<string, unknown>) {
  await db
    .update(contactos)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(contactos.id, contactoId), eq(contactos.empresaId, empresaId)));
}

export function setupOdooRoutes(app: any): void {
  const router = express.Router();

  // GET /api/integrations/odoo/status
  // Apenas verifica se a integração está configurada para a empresa atual
  router.get("/status", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) {
        return res.status(400).json({
          configured: false,
          message: "User has no company assigned",
        });
      }

      const connection =
        await odooConnectionsStorage.getOdooConnectionByEmpresaId(empresaId);

      if (!connection) {
        return res.json({ configured: false });
      }

      return res.json({
        configured: true,
        baseUrl: connection.baseUrl,
        dbName: connection.dbName,
        username: connection.username,
        environment: connection.environment,
        isActive: connection.isActive,
      });
    } catch (error) {
      console.error("Error fetching Odoo connection status:", error);
      return res
        .status(500)
        .json({ configured: false, message: "Failed to fetch Odoo status" });
    }
  });

  // POST /api/integrations/odoo/save
  // Guarda/atualiza a configuração do Odoo para a empresa atual
  router.post("/save", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) {
        return res.status(400).json({ message: "User has no company assigned" });
      }

      const empresaIdStr: string = empresaId;

      const parseResult = insertOdooConnectionSchema.safeParse({
        ...req.body,
        empresaId: empresaIdStr,
      });

      if (!parseResult.success) {
        console.error(
          "Invalid Odoo connection payload:",
          parseResult.error.flatten()
        );
        return res.status(400).json({ message: "Invalid Odoo connection data" });
      }

      const input = parseResult.data;

      await odooConnectionsStorage.upsertOdooConnection(input);

      return res.json({ message: "Odoo connection saved successfully" });
    } catch (error) {
      console.error("Error saving Odoo connection:", error);
      return res.status(500).json({ message: "Failed to save Odoo connection" });
    }
  });

  router.post("/verify-lead-type-field", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const rawFieldName = String(req.body?.fieldName ?? "").trim();
      if (!rawFieldName) {
        return res.status(400).json({ verified: false, message: "Missing fieldName" });
      }

      if (!/^x_[a-zA-Z0-9_]+$/.test(rawFieldName)) {
        return res.status(400).json({
          verified: false,
          message: "O campo tem de começar por x_ e conter apenas letras, números ou underscore.",
        });
      }

      const { empresaId } = await getUserContext(req);
      if (!empresaId) {
        return res.status(400).json({ verified: false, message: "User has no company assigned" });
      }

      await assertOdooEnabled(empresaId);

      const result = await verifyOdooModelField({
        empresaId,
        model: "crm.lead",
        fieldName: rawFieldName,
      });

      if (!result.exists) {
        return res.status(404).json({
          verified: false,
          fieldName: rawFieldName,
          message: "O campo não existe no modelo crm.lead do Odoo.",
        });
      }

      return res.json({
        verified: true,
        fieldName: result.fieldName,
        type: result.type,
        label: result.label,
        selectionOptions: result.selectionOptions,
      });
    } catch (error: any) {
      console.error("[Odoo] verify lead type field error:", error);
      return res.status(500).json({
        verified: false,
        message: error?.message ?? "Erro ao validar campo do Odoo.",
      });
    }
  });

  // GET /api/integrations/odoo/search-partner
  // Pesquisa parceiros no Odoo
  router.get("/search-partner", isAuthenticated, async (req: any, res) => {
    try {
      const q = String(req.query.q ?? "").trim();

      const context = await getUserContext(req);
      const { empresaId } = context;
      if (!empresaId) {
        return res.status(400).json({ error: "User has no company assigned" });
      }

      const empresaIdStr: string = empresaId;

      await assertOdooContactsAccess(context);
      await assertOdooEnabled(empresaIdStr);

      const partners = await searchOdooPartners(empresaIdStr, q);

      res.json({
        results: partners,
      });
    } catch (error: any) {
      if (error.message === "ODOO_NOT_CONFIGURED") {
        return res.status(200).json({
          results: [],
          notConfigured: true,
        });
      }

      if (isRecoverableOdooConnectionError(error)) {
        return res.status(200).json({
          results: [],
          connectionError: true,
          message: "Falha ao autenticar no Odoo. Verifique as credenciais configuradas.",
        });
      }

      console.error("[Odoo] search-partner error:", {
        message: error?.message,
        stack: error?.stack,
      });

      return res.status(error?.status ?? 500).json({
        success: false,
        error: "Odoo search partner error",
        message: error?.message ?? "Erro ao pesquisar parceiros no Odoo.",
      });
    }
  });

  // GET /api/integrations/odoo/partner/:id
  // Busca um parceiro específico por ID no Odoo
  router.get("/partner/:id", isAuthenticated, async (req: any, res) => {
    try {
      const rawId = req.params.id;
      const partnerId = Number(rawId);

      if (!rawId || Number.isNaN(partnerId)) {
        return res.status(400).json({ error: "Invalid partner id" });
      }

      const context = await getUserContext(req);
      const { empresaId } = context;
      if (!empresaId) {
        return res.status(400).json({ error: "User has no company assigned" });
      }

      const empresaIdStr: string = empresaId;

      await assertOdooContactsAccess(context);
      await assertOdooEnabled(empresaIdStr);

      const partner = await getOdooPartnerById(empresaIdStr, partnerId);

      if (!partner) {
        return res.status(404).json({ error: "Partner not found" });
      }

      return res.json({ partner });
    } catch (error: any) {
      if (error?.message === "ODOO_NOT_ENABLED" || error?.code === "ODOO_NOT_ENABLED") {
        return res.status(200).json({
          notConfigured: true,
          notEnabled: true,
          partner: null,
          message: "Integração Odoo não está ativa para esta empresa.",
        });
      }

      if (error?.message === "ODOO_NOT_CONFIGURED") {
        return res.status(200).json({
          notConfigured: true,
          partner: null,
        });
      }

      console.error("[Odoo] get partner error:", error);
      return res.status(error?.status ?? 500).json({
        error: "Odoo partner fetch error",
        message: error?.message ?? "Unknown error",
      });
    }
  });

  router.post("/sync/entidades/:id/push", isAuthenticated, async (req: any, res) => {
    try {
      const ctx = await getUserContext(req);
      if (!ctx.empresaId) {
        return res.status(400).json({ message: "User has no company assigned" });
      }

      await assertOdooContactsAccess(ctx);
      await assertOdooEnabled(ctx.empresaId);

      const entidade = await storage.getEntidade(
        String(req.params.id),
        ctx.empresaId,
        ctx.userId,
        ctx.userRole,
      );

      if (!entidade) {
        return res.status(404).json({ message: "Entidade not found" });
      }

      const partnerId = normalizeNumericId(entidade.odooPartnerId ?? entidade.odooEntityId);
      const payload = getEntityPartnerPayload(entidade);
      const result = partnerId
        ? await updateOdooPartner(ctx.empresaId, partnerId, payload)
        : await createOdooPartner(ctx.empresaId, payload);

      await markEntidadeSyncState(entidade.id, ctx.empresaId, {
        odooPartnerId: String(result.id),
        odooEntityId: result.id,
        needsSync: false,
        syncStatus: "synced",
        syncError: null,
        lastSyncAt: new Date(),
      });

      return res.json({
        success: true,
        direction: partnerId ? "push-update" : "push-create",
        partner: result.partner,
        localId: entidade.id,
      });
    } catch (error: any) {
      try {
        const ctx = await getUserContext(req);
        if (ctx.empresaId) {
          await markEntidadeSyncState(String(req.params.id), ctx.empresaId, {
            needsSync: true,
            syncStatus: "error",
            syncError: error?.message ?? "Odoo sync failed",
          });
        }
      } catch {}

      console.error("[Odoo] push entidade error:", error);
      return res.status(error?.status ?? 500).json({
        success: false,
        message: error?.message ?? "Erro ao sincronizar entidade com Odoo.",
      });
    }
  });

  router.post("/sync/contactos/:id/push", isAuthenticated, async (req: any, res) => {
    try {
      const ctx = await getUserContext(req);
      if (!ctx.empresaId) {
        return res.status(400).json({ message: "User has no company assigned" });
      }

      await assertOdooContactsAccess(ctx);
      await assertOdooEnabled(ctx.empresaId);

      const contacto = await storage.getContacto(
        String(req.params.id),
        ctx.empresaId,
        ctx.userId,
        ctx.userRole,
      );

      if (!contacto) {
        return res.status(404).json({ message: "Contacto not found" });
      }

      const parentId = normalizeNumericId(contacto.entidade?.odooPartnerId ?? contacto.entidade?.odooEntityId);
      const partnerId = normalizeNumericId(contacto.odooPartnerId ?? contacto.odooContactId);
      const payload = getContactPartnerPayload(contacto, parentId);
      const result = partnerId
        ? await updateOdooPartner(ctx.empresaId, partnerId, payload)
        : await createOdooPartner(ctx.empresaId, payload);

      await markContactoSyncState(contacto.id, ctx.empresaId, {
        odooPartnerId: String(result.id),
        odooContactId: result.id,
        needsSync: false,
        syncStatus: "synced",
        syncError: null,
        lastSyncAt: new Date(),
      });

      return res.json({
        success: true,
        direction: partnerId ? "push-update" : "push-create",
        partner: result.partner,
        localId: contacto.id,
      });
    } catch (error: any) {
      try {
        const ctx = await getUserContext(req);
        if (ctx.empresaId) {
          await markContactoSyncState(String(req.params.id), ctx.empresaId, {
            needsSync: true,
            syncStatus: "error",
            syncError: error?.message ?? "Odoo sync failed",
          });
        }
      } catch {}

      console.error("[Odoo] push contacto error:", error);
      return res.status(error?.status ?? 500).json({
        success: false,
        message: error?.message ?? "Erro ao sincronizar contacto com Odoo.",
      });
    }
  });

  router.post("/sync/partners/:id/import-entity", isAuthenticated, async (req: any, res) => {
    try {
      const ctx = await getUserContext(req);
      if (!ctx.empresaId) {
        return res.status(400).json({ message: "User has no company assigned" });
      }

      await assertOdooContactsAccess(ctx);
      await assertOdooEnabled(ctx.empresaId);

      const partnerId = Number(req.params.id);
      if (Number.isNaN(partnerId)) {
        return res.status(400).json({ message: "Invalid partner id" });
      }

      const partner = await getOdooPartnerById(ctx.empresaId, partnerId);
      if (!partner) {
        return res.status(404).json({ message: "Partner not found" });
      }

      const targetEntidadeId = typeof req.body?.entidadeId === "string" ? req.body.entidadeId : null;

      if (targetEntidadeId) {
        const existing = await storage.getEntidade(
          targetEntidadeId,
          ctx.empresaId,
          ctx.userId,
          ctx.userRole,
        );

        if (!existing) {
          return res.status(404).json({ message: "Entidade target not found" });
        }

        const updated = await storage.updateEntidade(
          existing.id,
          {
            nome: partner.name,
            email: partner.email ?? undefined,
            telefone: partner.phone ?? undefined,
            nif: partner.vat ?? undefined,
            cidade: partner.city ?? undefined,
            morada: partner.street ?? undefined,
            codigoPostal: partner.zip ?? undefined,
            website: partner.website ?? undefined,
          } as any,
          ctx.empresaId,
          ctx.userId,
          ctx.userRole,
        );

        await markEntidadeSyncState(existing.id, ctx.empresaId, {
          odooPartnerId: String(partner.id),
          odooEntityId: partner.id,
          needsSync: false,
          syncStatus: "synced",
          syncError: null,
          lastSyncAt: new Date(),
        });

        const refreshed = await storage.getEntidade(
          existing.id,
          ctx.empresaId,
          ctx.userId,
          ctx.userRole,
        );

        return res.json({ success: true, direction: "pull-update", partner, entidade: refreshed ?? updated });
      }

      const created = await storage.createEntidade(
        {
          nome: partner.name,
          email: partner.email ?? undefined,
          telefone: partner.phone ?? undefined,
          nif: partner.vat ?? undefined,
          cidade: partner.city ?? undefined,
          morada: partner.street ?? undefined,
          codigoPostal: partner.zip ?? undefined,
          website: partner.website ?? undefined,
        } as any,
        ctx.empresaId,
      );

      await markEntidadeSyncState(created.id, ctx.empresaId, {
        odooPartnerId: String(partner.id),
        odooEntityId: partner.id,
        needsSync: false,
        syncStatus: "synced",
        syncError: null,
        lastSyncAt: new Date(),
      });

      const refreshedCreated = await storage.getEntidade(
        created.id,
        ctx.empresaId,
        ctx.userId,
        ctx.userRole,
      );

      return res.json({ success: true, direction: "pull-create", partner, entidade: refreshedCreated ?? created });
    } catch (error: any) {
      console.error("[Odoo] import entity error:", error);
      return res.status(error?.status ?? 500).json({
        success: false,
        message: error?.message ?? "Erro ao importar parceiro Odoo para entidade.",
      });
    }
  });

  router.post("/sync/partners/:id/import-contact", isAuthenticated, async (req: any, res) => {
    try {
      const ctx = await getUserContext(req);
      if (!ctx.empresaId) {
        return res.status(400).json({ message: "User has no company assigned" });
      }

      await assertOdooContactsAccess(ctx);
      await assertOdooEnabled(ctx.empresaId);

      const partnerId = Number(req.params.id);
      if (Number.isNaN(partnerId)) {
        return res.status(400).json({ message: "Invalid partner id" });
      }

      const partner = await getOdooPartnerById(ctx.empresaId, partnerId);
      if (!partner) {
        return res.status(404).json({ message: "Partner not found" });
      }

      let entidadeId: string | null =
        typeof req.body?.entidadeId === "string" ? req.body.entidadeId : null;

      if (!entidadeId && partner.parentId) {
        const existingEntity = await db.query.entidades.findFirst({
          where: and(
            eq(entidades.empresaId, ctx.empresaId),
            eq(entidades.odooPartnerId, String(partner.parentId)),
          ),
        });
        entidadeId = existingEntity?.id ?? null;
      }

      let targetContactoId =
        typeof req.body?.contactoId === "string" ? req.body.contactoId : null;
      const duplicate = await findDuplicateContacto({
        empresaId: ctx.empresaId,
        email: partner.email,
        telemovel: partner.phone,
        odooPartnerId: partner.id,
        excludeId: targetContactoId ?? undefined,
      });

      if (targetContactoId && duplicate) {
        return res.status(409).json({
          success: false,
          code: "CONTACT_DUPLICATE",
          message: contactDuplicateMessage(duplicate),
          matchedBy: duplicate.matchedBy,
          existingContact: {
            id: duplicate.contacto.id,
            nome: duplicate.contacto.nome,
          },
        });
      }
      if (!targetContactoId && duplicate) {
        targetContactoId = duplicate.contacto.id;
      }

      if (targetContactoId) {
        const conflictingDuplicate = await findDuplicateContacto({
          empresaId: ctx.empresaId,
          email: partner.email,
          telemovel: partner.phone,
          odooPartnerId: partner.id,
          excludeId: targetContactoId,
        });
        if (conflictingDuplicate) {
          return res.status(409).json({
            success: false,
            code: "CONTACT_DUPLICATE_CONFLICT",
            message:
              "Os dados do Odoo correspondem a mais do que um contacto existente. Nenhum contacto foi alterado.",
            matchedBy: conflictingDuplicate.matchedBy,
            existingContact: {
              id: conflictingDuplicate.contacto.id,
              nome: conflictingDuplicate.contacto.nome,
            },
          });
        }

        const existing = await storage.getContacto(
          targetContactoId,
          ctx.empresaId,
          ctx.userId,
          ctx.userRole,
        );

        if (!existing) {
          return res.status(404).json({ message: "Contacto target not found" });
        }

        const updated = await storage.updateContacto(
          existing.id,
          {
            nome: partner.name,
            email: partner.email ?? undefined,
            telemovel: partner.phone ?? undefined,
            entidadeId: entidadeId ?? undefined,
          } as any,
          ctx.empresaId,
          ctx.userId,
          ctx.userRole,
        );

        await markContactoSyncState(existing.id, ctx.empresaId, {
          odooPartnerId: String(partner.id),
          odooContactId: partner.id,
          needsSync: false,
          syncStatus: "synced",
          syncError: null,
          lastSyncAt: new Date(),
        });

        const refreshed = await storage.getContacto(
          existing.id,
          ctx.empresaId,
          ctx.userId,
          ctx.userRole,
        );

        return res.json({
          success: true,
          direction: duplicate ? "pull-update-existing" : "pull-update",
          deduplicated: Boolean(duplicate),
          matchedBy: duplicate?.matchedBy,
          partner,
          contacto: refreshed ?? updated,
        });
      }

      const creation = await createContactoIfUnique(
        {
          nome: partner.name,
          email: partner.email ?? undefined,
          telemovel: partner.phone ?? undefined,
          entidadeId: entidadeId ?? undefined,
          createdByUserId: ctx.userId,
          odooPartnerId: String(partner.id),
          odooContactId: partner.id,
          needsSync: false,
          syncStatus: "synced",
          syncError: null,
          lastSyncAt: new Date(),
        },
        ctx.empresaId,
      );
      const created = creation.contacto;

      if (!creation.created) {
        await storage.updateContacto(
          created.id,
          {
            nome: partner.name,
            email: partner.email ?? undefined,
            telemovel: partner.phone ?? undefined,
            entidadeId: entidadeId ?? undefined,
          } as any,
          ctx.empresaId,
          ctx.userId,
          ctx.userRole,
        );
        await markContactoSyncState(created.id, ctx.empresaId, {
          odooPartnerId: String(partner.id),
          odooContactId: partner.id,
          needsSync: false,
          syncStatus: "synced",
          syncError: null,
          lastSyncAt: new Date(),
        });
      }

      const refreshedCreated = await storage.getContacto(
        created.id,
        ctx.empresaId,
        ctx.userId,
        ctx.userRole,
      );

      return res.json({
        success: true,
        direction: creation.created ? "pull-create" : "pull-update-existing",
        deduplicated: !creation.created,
        matchedBy: creation.created ? undefined : creation.matchedBy,
        partner,
        contacto: refreshedCreated ?? created,
      });
    } catch (error: any) {
      console.error("[Odoo] import contact error:", error);
      return res.status(error?.status ?? 500).json({
        success: false,
        message: error?.message ?? "Erro ao importar parceiro Odoo para contacto.",
      });
    }
  });

  app.post("/api/entidades/:id/odoo-link", isAuthenticated, async (req: any, res: any) => {
    try {
      const ctx = await getUserContext(req);
      if (!ctx.empresaId) {
        return res.status(400).json({ success: false, message: "User has no company assigned" });
      }

      await assertOdooContactsAccess(ctx);

      const entidade = await storage.getEntidade(
        String(req.params.id),
        ctx.empresaId,
        ctx.userId,
        ctx.userRole,
      );

      if (!entidade) {
        return res.status(404).json({ success: false, message: "Entidade not found" });
      }

      const requestedPartnerId = req.body?.odooPartnerId;

      if (requestedPartnerId === null || requestedPartnerId === undefined || requestedPartnerId === "") {
        await markEntidadeSyncState(entidade.id, ctx.empresaId, {
          odooPartnerId: null,
          odooEntityId: null,
          needsSync: false,
          syncStatus: "never",
          syncError: null,
          lastSyncAt: null,
        });

        const updated = await storage.getEntidade(
          entidade.id,
          ctx.empresaId,
          ctx.userId,
          ctx.userRole,
        );

        return res.json({ success: true, entidade: updated });
      }

      await assertOdooEnabled(ctx.empresaId);
      const partnerId = Number(requestedPartnerId);
      if (Number.isNaN(partnerId)) {
        return res.status(400).json({ success: false, message: "Invalid Odoo partner id" });
      }

      const partner = await getOdooPartnerById(ctx.empresaId, partnerId);
      if (!partner) {
        return res.status(404).json({ success: false, message: "Partner not found in Odoo" });
      }

      await markEntidadeSyncState(entidade.id, ctx.empresaId, {
        odooPartnerId: String(partnerId),
        odooEntityId: partnerId,
        needsSync: false,
        syncStatus: "synced",
        syncError: null,
        lastSyncAt: new Date(),
      });

      const refreshed = await storage.getEntidade(
        entidade.id,
        ctx.empresaId,
        ctx.userId,
        ctx.userRole,
      );

      return res.json({ success: true, entidade: refreshed, partner });
    } catch (error: any) {
      console.error("[Odoo] entidade odoo-link error:", error);
      return res.status(error?.status ?? 500).json({
        success: false,
        message: error?.message ?? "Erro ao ligar entidade ao parceiro Odoo.",
      });
    }
  });

  app.post("/api/contactos/:id/odoo-link", isAuthenticated, async (req: any, res: any) => {
    try {
      const ctx = await getUserContext(req);
      if (!ctx.empresaId) {
        return res.status(400).json({ success: false, message: "User has no company assigned" });
      }

      await assertOdooContactsAccess(ctx);

      const contacto = await storage.getContacto(
        String(req.params.id),
        ctx.empresaId,
        ctx.userId,
        ctx.userRole,
      );

      if (!contacto) {
        return res.status(404).json({ success: false, message: "Contacto not found" });
      }

      const requestedPartnerId = req.body?.odooPartnerId;

      if (requestedPartnerId === null || requestedPartnerId === undefined || requestedPartnerId === "") {
        await markContactoSyncState(contacto.id, ctx.empresaId, {
          odooPartnerId: null,
          odooContactId: null,
          needsSync: false,
          syncStatus: "never",
          syncError: null,
          lastSyncAt: null,
        });

        const updated = await storage.getContacto(
          contacto.id,
          ctx.empresaId,
          ctx.userId,
          ctx.userRole,
        );

        return res.json({ success: true, contacto: updated });
      }

      await assertOdooEnabled(ctx.empresaId);
      const partnerId = Number(requestedPartnerId);
      if (Number.isNaN(partnerId)) {
        return res.status(400).json({ success: false, message: "Invalid Odoo partner id" });
      }

      const partner = await getOdooPartnerById(ctx.empresaId, partnerId);
      if (!partner) {
        return res.status(404).json({ success: false, message: "Partner not found in Odoo" });
      }

      const duplicate = await findDuplicateContacto({
        empresaId: ctx.empresaId,
        email: partner.email,
        telemovel: partner.phone,
        odooPartnerId: partnerId,
        excludeId: contacto.id,
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          code: "CONTACT_DUPLICATE",
          message: contactDuplicateMessage(duplicate),
          matchedBy: duplicate.matchedBy,
          existingContact: {
            id: duplicate.contacto.id,
            nome: duplicate.contacto.nome,
          },
        });
      }

      await markContactoSyncState(contacto.id, ctx.empresaId, {
        odooPartnerId: String(partnerId),
        odooContactId: partnerId,
        needsSync: false,
        syncStatus: "synced",
        syncError: null,
        lastSyncAt: new Date(),
      });

      const refreshed = await storage.getContacto(
        contacto.id,
        ctx.empresaId,
        ctx.userId,
        ctx.userRole,
      );

      return res.json({ success: true, contacto: refreshed, partner });
    } catch (error: any) {
      console.error("[Odoo] contacto odoo-link error:", error);
      return res.status(error?.status ?? 500).json({
        success: false,
        message: error?.message ?? "Erro ao ligar contacto ao parceiro Odoo.",
      });
    }
  });

  // POST /api/integrations/odoo/visitas/:id/create-lead
  // Cria uma lead no Odoo a partir de uma visita
  router.post(
    "/visitas/:id/create-lead",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const context = await getUserContext(req);
        const { empresaId } = context;
        if (!empresaId) {
          return res.status(400).json({ error: "User has no company assigned" });
        }

        const empresaIdStr: string = empresaId;

        await assertLeadsEnabled(empresaIdStr);
        await assertOdooEnabled(empresaIdStr);

        const visitaId = String(req.params.id);
        const visit = await storage.getVisita(
          visitaId,
          empresaIdStr,
          context.userId,
          context.userRole,
        );
        if (!visit) {
          return res.status(404).json({
            success: false,
            message: "Visita não encontrada.",
          });
        }
        const permissions = await getLeadActorPermissions({
          ...context,
          empresaId: empresaIdStr,
        } as LeadActorContext);
        if (
          context.userRole === "agent" &&
          (permissions.mode !== "publish" || !permissions.canCreate)
        ) {
          const pending = await createVisitLeadApproval(
            { ...context, empresaId: empresaIdStr } as LeadActorContext,
            visit,
            permissions.odooPartnerId,
          );
          return res.status(202).json({
            success: true,
            approvalRequired: true,
            localLeadId: pending.lead.id,
            request: pending.request,
            message: "Pedido de criação enviado ao administrador.",
          });
        }

        const result = await createLeadForVisita(empresaIdStr, visitaId);
        if (context.userRole === "agent" && permissions.odooPartnerId) {
          await subscribeOdooLeadFollowers({
            empresaId: empresaIdStr,
            odooLeadId: result.leadId,
            partnerIds: [Number(permissions.odooPartnerId)],
          });
          await postOdooLeadAuditNote({
            empresaId: empresaIdStr,
            odooLeadId: result.leadId,
            body: `Lead criado através do Visit Manager por ${
              visit.user?.email ?? context.userId
            }.`,
          }).catch(() => undefined);
        }

        return res.json({
          success: true,
          visitaId: result.visitaId,
          leadId: result.leadId,
        });
      } catch (error: any) {
        if (
          error?.message === "ODOO_NOT_ENABLED" ||
          error?.code === "ODOO_NOT_ENABLED"
        ) {
          return res.status(200).json({
            success: false,
            notEnabled: true,
            message:
              "Integração Odoo não está ativa para esta empresa.",
          });
        }

        if (error?.message === "VISITA_NOT_FOUND") {
          return res.status(404).json({
            success: false,
            error: "Visita not found",
          });
        }

        if (error?.message === "ODOO_NOT_CONFIGURED") {
          return res.status(200).json({
            success: false,
            notConfigured: true,
          });
        }

        console.error("[Odoo] create-lead-from-visita error:", error);
        return res.status(500).json({
          success: false,
          error: "Odoo create lead from visita error",
          message: error?.message ?? "Unknown error",
        });
      }
    }
  );

  // POST /api/integrations/odoo/test-create-lead
  // Cria uma lead de teste no Odoo
  router.post("/test-create-lead", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const context = await getUserContext(req);
      const { empresaId } = context;
      if (!empresaId) {
        return res.status(400).json({ error: "User has no company assigned" });
      }

      const empresaIdStr: string = empresaId;

      const {
        name,
        contactName,
        email,
        phone,
        description,
      } = (req.body ?? {}) as {
        name?: string;
        contactName?: string;
        email?: string;
        phone?: string;
        description?: string;
      };

      const leadName =
        name?.trim() || "Visit Manager – Lead de teste";

      const leadDescription =
        description?.trim() ||
        "Lead de teste enviada pela aplicação Visit Manager (endpoint /test-create-lead).";

      const result = await createOdooLead(empresaIdStr, {
        name: leadName,
        contactName: contactName?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        description: leadDescription,
      });

      return res.json({
        success: true,
        leadId: result.id,
      });
    } catch (error: any) {
      if (error?.message === "ODOO_NOT_CONFIGURED") {
        return res.status(200).json({
          success: false,
          notConfigured: true,
        });
      }

      console.error("[Odoo] test-create-lead error:", error);
      return res.status(500).json({
        success: false,
        error: "Odoo lead creation error",
        message: error?.message ?? "Unknown error",
      });
    }
  });

  // POST /api/integrations/odoo/visitas/:id/sync
  // PROMPT 9A: Endpoint de sync de visita com Odoo
  // Sincroniza uma visita com Odoo criando/atualizando uma lead (se crmVisitsOdooSyncEnabled = true)
  router.post("/visitas/:id/sync", isAuthenticated, async (req: any, res) => {
    try {
      const context = await getUserContext(req);
      const { empresaId } = context;
      const visitaId = req.params.id;

      if (!empresaId) {
        return res.status(400).json({
          success: false,
          message: "Utilizador sem empresa associada.",
        });
      }

      const empresaIdStr: string = empresaId;
      const visit = await storage.getVisita(
        visitaId,
        empresaIdStr,
        context.userId,
        context.userRole,
      );
      if (!visit) {
        return res.status(404).json({
          success: false,
          message: "Visita não encontrada.",
        });
      }

      // Verifica se a integração Odoo está ativa para a empresa
      await assertOdooEnabled(empresaIdStr);

      try {
        await assertEmpresaModuleEnabled(empresaIdStr, "odoo_visits_sync");
      } catch (error: any) {
        if (error?.notEnabled) {
          return res.status(200).json({
            success: false,
            notEnabled: true,
            message:
              "Sincronização de visitas com o Odoo está desativada para esta empresa.",
          });
        }
        throw error;
      }

      // Usa a função existente para criar/atualizar lead Odoo a partir da visita
      const permissions = await getLeadActorPermissions({
        ...context,
        empresaId: empresaIdStr,
      } as LeadActorContext);
      if (
        context.userRole === "agent" &&
        (permissions.mode !== "publish" || !permissions.canCreate)
      ) {
        const pending = await createVisitLeadApproval(
          { ...context, empresaId: empresaIdStr } as LeadActorContext,
          visit,
          permissions.odooPartnerId,
        );
        return res.status(202).json({
          success: true,
          approvalRequired: true,
          localLeadId: pending.lead.id,
          request: pending.request,
          message: "Pedido de sincronização enviado ao administrador.",
        });
      }

      const result = await createLeadForVisita(empresaIdStr, visitaId);
      if (context.userRole === "agent" && permissions.odooPartnerId) {
        await subscribeOdooLeadFollowers({
          empresaId: empresaIdStr,
          odooLeadId: result.leadId,
          partnerIds: [Number(permissions.odooPartnerId)],
        });
      }

      return res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      if (error?.message === "ODOO_NOT_CONFIGURED") {
        return res.status(200).json({
          success: false,
          notConfigured: true,
        });
      }

      console.error(
        "[Odoo] Erro ao sincronizar visita com Odoo:",
        error
      );
      return res.status(500).json({
        success: false,
        message:
          error?.message ??
          "Erro ao sincronizar visita com Odoo.",
      });
    }
  });

  app.use("/api/integrations/odoo", router);
}
