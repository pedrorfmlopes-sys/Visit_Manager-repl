import express from "express";
import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { db } from "../db";
import {
  leads,
  leadsContactos,
  insertLeadSchema,
  leadsMarcas,
  users,
  empresas,
  leadApprovalRequests,
  leadFollowers,
  entidades,
  contactos,
} from "../../shared/schema";
import { isAuthenticated } from "../replitAuth";
import { getUserContext } from "../authContext";
import { requireUserContext } from "../auth/rbac";
import { assertLeadsEnabled } from "../integrations/crmLeads";
import {
  createLeadFromVmLead,
  updateLeadFromVmLead,
  listLeadAttachments,
  listLeadChatter,
  listOdooLeadChatterRecipients,
  postOdooLeadChatterMessage,
  createLeadAttachment,
  downloadLeadAttachment,
  getOdooLeadById,
  getOdooPartnerById,
  postOdooLeadAuditNote,
  searchOdooLeads,
  subscribeOdooLeadFollowers,
} from "../integrations/odooClient";
import { transcribeAudio, getOpenAIClient } from "../openai";
import multer from "multer";
import { assertTenantReferences } from "../tenantValidation";
import {
  assertLeadAccess,
  changesRequireAdminApproval,
  createOrReplaceLeadApprovalRequest,
  getAccessibleLeadIds,
  getLeadActorPermissions,
  type LeadActorContext,
} from "../leadAccess";
import {
  addLocalLeadFollower,
  syncLeadFollowersFromOdoo,
} from "../leadFollowers";
import {
  createContactoIfUnique,
  findDuplicateContacto,
} from "../contactDeduplication";

function stripHtmlToPlainText(value: unknown): string | null {
  if (value === null || value === undefined || value === false) return null;

  const text = String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<\/div>\s*<div[^>]*>/gi, "\n")
    .replace(/<\/li>\s*<li[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();

  return text || null;
}

async function resolveImportedOdooLeadRelations(input: {
  empresaId: string;
  userId: string;
  remoteLead: Awaited<ReturnType<typeof getOdooLeadById>>;
}) {
  const remoteLead = input.remoteLead;
  let entidade: typeof entidades.$inferSelect | null = null;
  let contacto: typeof contactos.$inferSelect | null = null;
  let createdEntidade = false;
  let createdContacto = false;

  if (remoteLead?.partnerId) {
    const leadPartner = await getOdooPartnerById(
      input.empresaId,
      remoteLead.partnerId,
    );
    const entityPartner = leadPartner?.parentId
      ? (await getOdooPartnerById(input.empresaId, leadPartner.parentId)) ??
        leadPartner
      : leadPartner;

    if (entityPartner) {
      entidade =
        (await db.query.entidades.findFirst({
          where: and(
            eq(entidades.empresaId, input.empresaId),
            eq(entidades.odooPartnerId, String(entityPartner.id)),
          ),
        })) ?? null;

      if (!entidade && (entityPartner.vat || entityPartner.email)) {
        const weakMatches = [
          entityPartner.vat
            ? ilike(entidades.nif, entityPartner.vat.trim())
            : null,
          entityPartner.email
            ? ilike(entidades.email, entityPartner.email.trim())
            : null,
        ].filter(Boolean) as any[];
        entidade =
          (await db.query.entidades.findFirst({
            where: and(
              eq(entidades.empresaId, input.empresaId),
              isNull(entidades.odooPartnerId),
              or(...weakMatches),
            ),
          })) ?? null;
      }

      if (entidade && !entidade.odooPartnerId) {
        [entidade] = await db
          .update(entidades)
          .set({
            odooPartnerId: String(entityPartner.id),
            odooEntityId: entityPartner.id,
            needsSync: false,
            syncStatus: "synced",
            syncError: null,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(entidades.id, entidade.id))
          .returning();
      } else if (!entidade) {
        [entidade] = await db
          .insert(entidades)
          .values({
            empresaId: input.empresaId,
            nome: entityPartner.name,
            email: entityPartner.email ?? null,
            telefone: entityPartner.phone ?? null,
            nif: entityPartner.vat ?? null,
            cidade: entityPartner.city ?? null,
            morada: entityPartner.street ?? null,
            codigoPostal: entityPartner.zip ?? null,
            website: entityPartner.website ?? null,
            createdByUserId: input.userId,
            odooPartnerId: String(entityPartner.id),
            odooEntityId: entityPartner.id,
            needsSync: false,
            syncStatus: "synced",
            syncError: null,
            lastSyncAt: new Date(),
          })
          .returning();
        createdEntidade = true;
      }
    }
  }

  if (remoteLead?.salespersonPartnerId) {
    const salesperson = await getOdooPartnerById(
      input.empresaId,
      remoteLead.salespersonPartnerId,
    );
    if (salesperson) {
      const duplicate = await findDuplicateContacto({
        empresaId: input.empresaId,
        email: salesperson.email,
        telemovel: salesperson.phone,
        odooPartnerId: salesperson.id,
      });
      if (duplicate) {
        contacto = duplicate.contacto;
        if (!contacto.odooPartnerId) {
          [contacto] = await db
            .update(contactos)
            .set({
              odooPartnerId: String(salesperson.id),
              odooContactId: salesperson.id,
              needsSync: false,
              syncStatus: "synced",
              syncError: null,
              lastSyncAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(contactos.id, contacto.id))
            .returning();
        }
      } else {
        const creation = await createContactoIfUnique(
          {
            nome: salesperson.name || remoteLead.salespersonName || "Vendedor Odoo",
            email: salesperson.email ?? null,
            telemovel: salesperson.phone ?? null,
            funcao: "Vendedor Odoo",
            createdByUserId: input.userId,
            odooPartnerId: String(salesperson.id),
            odooContactId: salesperson.id,
            needsSync: false,
            syncStatus: "synced",
            syncError: null,
            lastSyncAt: new Date(),
          },
          input.empresaId,
        );
        contacto = creation.contacto;
        createdContacto = creation.created;
      }
    }
  }

  return {
    entidadeId: entidade?.id ?? null,
    contactoId: contacto?.id ?? null,
    createdEntidade,
    createdContacto,
  };
}

export function registerCrmLeadsRoutes(app: express.Express) {
  const router = express.Router();

  const formatUserName = (user?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null) => {
    if (!user) return null;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return fullName || user.email || null;
  };

  const parseOdooWriteDate = (value?: string | null) => {
    if (!value) return null;
    const normalized = value.includes("T")
      ? value
      : value.replace(" ", "T") + "Z";
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const buildLeadUpdateFromOdoo = (odooLead: {
    name: string;
    description: string | null;
    descriptionHtml?: string | null;
    tipoLead: string | null;
    expectedRevenue: string | null;
    writeDate: string | null;
  }) => {
    const updateData: Partial<typeof leads.$inferInsert> = {
      titulo: odooLead.name,
      descricao: odooLead.description ?? null,
      descricaoHtml: odooLead.descriptionHtml ?? null,
      tipoLead: odooLead.tipoLead ?? null,
      valorPrevisto: odooLead.expectedRevenue ?? null,
      updatedAt: new Date(),
    };

    return updateData;
  };

  const isMissingOdooLeadError = (message?: string | null) => {
    const text = (message || "").toLowerCase();
    return (
      text.includes("missingerror") ||
      text.includes("does not exist") ||
      text.includes("has been deleted") ||
      text.includes("record not found") ||
      text.includes("not found")
    );
  };

  const syncLeadRecordToOdoo = async (input: {
    empresaId: string;
    leadId: string;
    actorUserId: string;
    changedFields?: string[];
  }) => {
    const lead = await db.query.leads.findFirst({
      where: and(
        eq(leads.id, input.leadId),
        eq(leads.empresaId, input.empresaId),
      ),
      with: {
        entidade: true,
        contacto: true,
        visita: true,
      },
    });
    if (!lead) {
      const error = new Error("Lead não encontrado.");
      (error as any).status = 404;
      throw error;
    }
    let odooLeadId = lead.odooLeadId
      ? Number(lead.odooLeadId)
      : undefined;
    let created = false;

    if (!odooLeadId) {
      if (!lead.entidade || !lead.contacto) {
        const error = new Error(
          "O lead precisa de entidade e contacto antes de ser criado no Odoo.",
        );
        (error as any).status = 400;
        throw error;
      }
      if (!(lead.entidade as any).odooPartnerId) {
        const error = new Error(
          "A entidade associada ainda não está ligada ao Odoo.",
        );
        (error as any).status = 400;
        throw error;
      }
      odooLeadId = await createLeadFromVmLead({
        vmLead: lead,
        entidade: lead.entidade,
        contacto: lead.contacto,
        empresaId: input.empresaId,
      });
      created = true;
    } else {
      try {
        await updateLeadFromVmLead({
          odooLeadId,
          vmLead: lead,
          entidade: lead.entidade,
          contacto: lead.contacto,
          empresaId: input.empresaId,
        });
      } catch (error: any) {
        if (!isMissingOdooLeadError(error?.message)) throw error;
        if (!lead.entidade || !lead.contacto) {
          const missingLinkError = new Error(
            "O lead foi eliminado no Odoo e precisa de entidade e contacto para ser recriado.",
          );
          (missingLinkError as any).status = 409;
          throw missingLinkError;
        }
        if (!(lead.entidade as any).odooPartnerId) {
          const missingPartnerError = new Error(
            "O lead foi eliminado no Odoo e a entidade local ainda não está ligada ao Odoo.",
          );
          (missingPartnerError as any).status = 409;
          throw missingPartnerError;
        }
        odooLeadId = await createLeadFromVmLead({
          vmLead: lead,
          entidade: lead.entidade,
          contacto: lead.contacto,
          empresaId: input.empresaId,
        });
        created = true;
      }
    }

    await db
      .update(leads)
      .set({
        odooLeadId: String(odooLeadId),
        needsSync: false,
        syncStatus: "synced",
        syncError: null,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, input.leadId));

    const followers = await db
      .select({ odooPartnerId: leadFollowers.odooPartnerId })
      .from(leadFollowers)
      .where(
        and(
          eq(leadFollowers.empresaId, input.empresaId),
          eq(leadFollowers.leadId, input.leadId),
        ),
      );
    const followerPartnerIds = followers
      .map((row) => Number(row.odooPartnerId))
      .filter((id) => Number.isFinite(id) && id > 0);
    await subscribeOdooLeadFollowers({
      empresaId: input.empresaId,
      odooLeadId,
      partnerIds: followerPartnerIds,
    });

    const actor = await db.query.users.findFirst({
      where: eq(users.id, input.actorUserId),
      columns: { firstName: true, lastName: true, email: true },
    });
    const actorName = formatUserName(actor) ?? "Utilizador";
    const fields = input.changedFields?.length
      ? ` Campos: ${input.changedFields.join(", ")}.`
      : "";
    await postOdooLeadAuditNote({
      empresaId: input.empresaId,
      odooLeadId,
      body: `Atualizado através do Visit Manager por ${actorName}${
        actor?.email ? ` (${actor.email})` : ""
      }.${fields}`,
    }).catch((error) => {
      console.warn("[CRM Leads] Não foi possível registar nota no Odoo:", error);
    });

    return { odooLeadId, created };
  };

  // Multer configuration for file uploads (used by attachment and audio routes)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
  });

  // GET /api/crm/leads - List all leads for empresa (with filters and ordering)
  router.get("/", isAuthenticated, async (req, res) => {
    try {
      const context = await requireUserContext(req);
      const { empresaId } = context;
      await assertLeadsEnabled(empresaId);

      // FASE-LEADS-FILTROS-01: Parse query params with defaults
      const q =
        typeof req.query.q === "string"
          ? req.query.q.toLowerCase().trim()
          : undefined;
      const estado =
        typeof req.query.estado === "string"
          ? req.query.estado
          : undefined;
      const entidadeId =
        typeof req.query.entidadeId === "string"
          ? req.query.entidadeId
          : undefined;
      const contactoId =
        typeof req.query.contactoId === "string"
          ? req.query.contactoId
          : undefined;
      const visitaId =
        typeof req.query.visitaId === "string"
          ? req.query.visitaId
          : undefined;
      const hasOdoo =
        typeof req.query.hasOdoo === "string"
          ? req.query.hasOdoo
          : undefined;
      const orderBy =
        typeof req.query.orderBy === "string"
          ? req.query.orderBy
          : "createdAt";
      const orderDir =
        typeof req.query.orderDir === "string"
          ? req.query.orderDir
          : "desc";

      // Build WHERE clause
      let whereClause: any = eq(leads.empresaId, empresaId);
      const accessibleLeadIds = await getAccessibleLeadIds(
        context as LeadActorContext,
      );
      if (accessibleLeadIds && accessibleLeadIds.length === 0) {
        return res.json({ leads: [] });
      }
      if (accessibleLeadIds) {
        whereClause = and(
          whereClause,
          inArray(leads.id, accessibleLeadIds),
        );
      }

      // FASE-LEADS-FILTROS-01: Search (titulo + descricao, case-insensitive)
      if (q) {
        const { ilike, or } = await import("drizzle-orm");
        whereClause = and(
          whereClause,
          or(
            ilike(leads.titulo, `%${q}%`),
            ilike(leads.descricao, `%${q}%`),
            ilike(leads.marca, `%${q}%`)
          )
        );
      }

      if (estado) {
        whereClause = and(whereClause, eq(leads.estado, estado));
      }
      if (entidadeId) {
        whereClause = and(whereClause, eq(leads.entidadeId, entidadeId));
      }
      if (contactoId) {
        whereClause = and(whereClause, eq(leads.contactoId, contactoId));
      }
      if (visitaId) {
        whereClause = and(whereClause, eq(leads.visitaId, visitaId));
      }

      // FASE-LEADS-FILTROS-01: Filter by Odoo sync status
      if (hasOdoo === "true") {
        const { isNotNull } = await import("drizzle-orm");
        whereClause = and(whereClause, isNotNull(leads.odooLeadId));
      } else if (hasOdoo === "false") {
        const { isNull } = await import("drizzle-orm");
        whereClause = and(whereClause, isNull(leads.odooLeadId));
      }

      // Build ORDER BY (FASE-LEADS-FILTROS-01)
      const orderByFn = (l: any, { asc, desc }: any) => {
        const isAsc = orderDir === "asc";
        const compareFn = isAsc ? asc : desc;

        switch (orderBy) {
          case "titulo":
            return compareFn(l.titulo);
          case "valorPrevisto":
            return compareFn(l.valorPrevisto);
          case "entidade":
            // For entidade ordering, we'll sort by createdAt as fallback
            // (full join-based sorting would need raw query)
            return compareFn(l.createdAt);
          case "createdAt":
          default:
            return compareFn(l.createdAt);
        }
      };

      const rows = await db.query.leads.findMany({
        where: whereClause,
        orderBy: orderByFn,
        limit: 100, // FASE-LEADS-FILTROS-01: Paginação básica
        with: {
          marcasAssociadas: {
            with: {
              marca: true,
            },
          },
          entidade: true, // Include for potential client-side sorting by entidade name
          contacto: true,
        },
      });

      // Map marcasAssociadas to marcas array
      const leadsWithMarcas = rows.map((row: any) => ({
        ...row,
        marcas:
          row.marcasAssociadas?.map((lm: any) => ({
            id: lm.marca?.id,
            nome: lm.marca?.nome,
          })) ?? [],
      }));

      // FASE-LEADS-FILTROS-01: Sort by entidade name if requested (client-side since DB join is complex)
      let finalLeads = leadsWithMarcas;
      if (orderBy === "entidade") {
        finalLeads = leadsWithMarcas.sort((a, b) => {
          const nameA = a.entidade?.nome || "";
          const nameB = b.entidade?.nome || "";
          return orderDir === "asc"
            ? nameA.localeCompare(nameB)
            : nameB.localeCompare(nameA);
        });
      }

      console.log("[CRM Leads] GET /api/crm/leads", {
        empresaId,
        filters: { q, estado, entidadeId, contactoId, visitaId, hasOdoo },
        orderBy,
        orderDir,
        count: finalLeads.length,
      });

      return res.json({ leads: finalLeads });
    } catch (error: any) {
      if (error?.code === "LEADS_NOT_ENABLED") {
        return res.status(200).json({
          success: false,
          notEnabled: true,
          message: "Módulo de Leads não está ativo para esta empresa.",
        });
      }

      console.error("[CRM Leads] GET / error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Erro ao listar leads." });
    }
  });

  router.get("/odoo/search", isAuthenticated, async (req, res) => {
    try {
      const context = await requireUserContext(req);
      await assertLeadsEnabled(context.empresaId);
      const permissions = await getLeadActorPermissions(
        context as LeadActorContext,
      );
      if (
        context.userRole === "agent" &&
        !permissions.odooPartnerId
      ) {
        return res.status(403).json({
          success: false,
          message:
            "O administrador ainda não associou o seu contacto Odoo.",
        });
      }

      const results = await searchOdooLeads({
        empresaId: context.empresaId,
        query:
          typeof req.query.q === "string" ? req.query.q : undefined,
        followerPartnerId:
          context.userRole === "admin"
            ? null
            : Number(permissions.odooPartnerId),
        limit: 50,
      });
      const localRows =
        results.length > 0
          ? await db
              .select({
                id: leads.id,
                odooLeadId: leads.odooLeadId,
              })
              .from(leads)
              .where(
                and(
                  eq(leads.empresaId, context.empresaId),
                  inArray(
                    leads.odooLeadId,
                    results.map((lead) => String(lead.id)),
                  ),
                ),
              )
          : [];
      const localByOdooId = new Map(
        localRows.map((lead) => [lead.odooLeadId, lead.id]),
      );

      return res.json({
        success: true,
        results: results.map((lead) => ({
          ...lead,
          localLeadId: localByOdooId.get(String(lead.id)) ?? null,
        })),
      });
    } catch (error: any) {
      console.error("[CRM Leads] Odoo search error:", error);
      return res.status(error?.status ?? 500).json({
        success: false,
        message: error?.message ?? "Erro ao pesquisar leads no Odoo.",
      });
    }
  });

  router.post("/odoo/import", isAuthenticated, async (req, res) => {
    try {
      const context = await requireUserContext(req);
      await assertLeadsEnabled(context.empresaId);
      const permissions = await getLeadActorPermissions(
        context as LeadActorContext,
      );
      const odooLeadId = Number(req.body?.odooLeadId);
      if (!Number.isFinite(odooLeadId) || odooLeadId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Lead Odoo inválido.",
        });
      }

      let remoteLead = await getOdooLeadById(
        context.empresaId,
        odooLeadId,
      );
      if (!remoteLead) {
        return res.status(404).json({
          success: false,
          message: "Lead não encontrado no Odoo.",
        });
      }

      if (context.userRole === "admin") {
        const requestedUserIds: string[] = Array.isArray(req.body?.userIds)
          ? Array.from(
              new Set(
                req.body.userIds.filter(
                  (value: unknown): value is string =>
                    typeof value === "string",
                ),
              ),
            )
          : [];
        if (requestedUserIds.length > 0) {
          const selectedUsers = await db
            .select({
              id: users.id,
              odooPartnerId: users.odooPartnerId,
            })
            .from(users)
            .where(
              and(
                eq(users.empresaId, context.empresaId),
                inArray(users.id, requestedUserIds),
              ),
            );
          if (
            selectedUsers.length !== requestedUserIds.length ||
            selectedUsers.some((user) => !user.odooPartnerId)
          ) {
            return res.status(400).json({
              success: false,
              message:
                "Todos os agentes selecionados precisam de um contacto Odoo validado.",
            });
          }
          await subscribeOdooLeadFollowers({
            empresaId: context.empresaId,
            odooLeadId,
            partnerIds: selectedUsers.map((user) =>
              Number(user.odooPartnerId),
            ),
          });
          remoteLead =
            (await getOdooLeadById(context.empresaId, odooLeadId)) ??
            remoteLead;
        }
      } else {
        const partnerId = Number(permissions.odooPartnerId);
        if (
          !partnerId ||
          !remoteLead.followerPartnerIds.includes(partnerId)
        ) {
          return res.status(403).json({
            success: false,
            message: "Só pode importar leads onde é seguidor.",
          });
        }
      }

      let localLead = await db.query.leads.findFirst({
        where: and(
          eq(leads.empresaId, context.empresaId),
          eq(leads.odooLeadId, String(odooLeadId)),
        ),
      });
      const importedRelations = await resolveImportedOdooLeadRelations({
        empresaId: context.empresaId,
        userId: context.userId,
        remoteLead,
      });
      const values: any = {
        titulo: remoteLead.name,
        descricao: remoteLead.description,
        descricaoHtml: remoteLead.descriptionHtml,
        tipoLead: remoteLead.tipoLead,
        valorPrevisto: remoteLead.expectedRevenue,
        odooLeadId: String(remoteLead.id),
        needsSync: false,
        syncStatus: "synced" as const,
        syncError: null,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      };
      if (importedRelations.entidadeId) {
        values.entidadeId = importedRelations.entidadeId;
      }
      if (importedRelations.contactoId) {
        values.contactoId = importedRelations.contactoId;
      }
      if (localLead) {
        [localLead] = await db
          .update(leads)
          .set(values)
          .where(eq(leads.id, localLead.id))
          .returning();
      } else {
        [localLead] = await db
          .insert(leads)
          .values({
            empresaId: context.empresaId,
            ...values,
          })
          .returning();
      }

      if (importedRelations.contactoId) {
        const existingContactLink = await db.query.leadsContactos.findFirst({
          where: and(
            eq(leadsContactos.leadId, localLead.id),
            eq(leadsContactos.contactoId, importedRelations.contactoId),
          ),
        });
        if (!existingContactLink) {
          await db.insert(leadsContactos).values({
            leadId: localLead.id,
            contactoId: importedRelations.contactoId,
            role: "principal",
          });
        }
      }

      const followerUserIds = await syncLeadFollowersFromOdoo({
        empresaId: context.empresaId,
        leadId: localLead.id,
        followerPartnerIds: remoteLead.followerPartnerIds,
      });
      return res.json({
        success: true,
        lead: localLead,
        followerUserIds,
        importedRelations,
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "Este lead já está importado.",
        });
      }
      console.error("[CRM Leads] Odoo import error:", error);
      return res.status(error?.status ?? 500).json({
        success: false,
        message: error?.message ?? "Erro ao importar lead do Odoo.",
      });
    }
  });

  router.get("/approvals", isAuthenticated, async (req, res) => {
    try {
      const context = await requireUserContext(req);
      const status =
        typeof req.query.status === "string" ? req.query.status : null;
      let whereClause: any = eq(
        leadApprovalRequests.empresaId,
        context.empresaId,
      );
      if (context.userRole !== "admin") {
        whereClause = and(
          whereClause,
          eq(
            leadApprovalRequests.requestedByUserId,
            context.userId,
          ),
        );
      }
      if (status && status !== "all") {
        whereClause = and(
          whereClause,
          eq(leadApprovalRequests.status, status),
        );
      }

      const rows = await db
        .select({
          request: leadApprovalRequests,
          leadTitle: leads.titulo,
          requesterEmail: users.email,
          requesterFirstName: users.firstName,
          requesterLastName: users.lastName,
        })
        .from(leadApprovalRequests)
        .innerJoin(leads, eq(leads.id, leadApprovalRequests.leadId))
        .innerJoin(
          users,
          eq(users.id, leadApprovalRequests.requestedByUserId),
        )
        .where(whereClause)
        .orderBy(desc(leadApprovalRequests.createdAt))
        .limit(100);

      return res.json({
        success: true,
        requests: rows.map((row) => ({
          ...row.request,
          leadTitle: row.leadTitle,
          requesterName:
            [row.requesterFirstName, row.requesterLastName]
              .filter(Boolean)
              .join(" ") || row.requesterEmail,
          requesterEmail: row.requesterEmail,
        })),
      });
    } catch (error: any) {
      return res.status(error?.status ?? 500).json({
        success: false,
        message: error?.message ?? "Erro ao carregar aprovações.",
      });
    }
  });

  router.patch(
    "/approvals/:requestId",
    isAuthenticated,
    async (req, res) => {
      try {
        const context = await requireUserContext(req);
        const action = String(req.body?.action ?? "");
        const comment =
          typeof req.body?.comment === "string"
            ? req.body.comment.trim()
            : "";
        if (context.userRole !== "admin") {
          return res.status(403).json({
            success: false,
            message: "Apenas o administrador pode rever pedidos.",
          });
        }
        if (
          !["approve", "changes_requested", "rejected"].includes(action)
        ) {
          return res.status(400).json({
            success: false,
            message: "Ação de revisão inválida.",
          });
        }
        if (action !== "approve" && !comment) {
          return res.status(400).json({
            success: false,
            message: "Indique o motivo ou as correções necessárias.",
          });
        }

        const request = await db.query.leadApprovalRequests.findFirst({
          where: and(
            eq(
              leadApprovalRequests.id,
              String(req.params.requestId),
            ),
            eq(
              leadApprovalRequests.empresaId,
              context.empresaId,
            ),
          ),
        });
        if (!request) {
          return res.status(404).json({
            success: false,
            message: "Pedido não encontrado.",
          });
        }
        if (request.status !== "pending") {
          return res.status(409).json({
            success: false,
            message: "Este pedido já foi revisto.",
          });
        }

        if (action === "approve") {
          const lead = await db.query.leads.findFirst({
            where: and(
              eq(leads.id, request.leadId),
              eq(leads.empresaId, context.empresaId),
            ),
          });
          if (!lead) {
            return res.status(404).json({
              success: false,
              message: "Lead não encontrado.",
            });
          }
          if (lead.odooLeadId && request.baseOdooWriteDate) {
            const remote = await getOdooLeadById(
              context.empresaId,
              Number(lead.odooLeadId),
            );
            if (
              remote?.writeDate &&
              remote.writeDate !== request.baseOdooWriteDate
            ) {
              return res.status(409).json({
                success: false,
                conflict: true,
                message:
                  "O lead foi alterado no Odoo depois deste pedido. Atualize os dados antes de aprovar.",
              });
            }
          }

          const proposed =
            (request.proposedChanges as Record<string, unknown>) ?? {};
          const allowedFields = [
            "titulo",
            "descricao",
            "descricaoHtml",
            "tipoLead",
            "marca",
            "estado",
            "valorPrevisto",
            "moeda",
            "entidadeId",
            "contactoId",
            "visitaId",
          ] as const;
          const updateData: Record<string, unknown> = {};
          for (const field of allowedFields) {
            if (field in proposed) updateData[field] = proposed[field];
          }
          if ("descricaoHtml" in updateData) {
            updateData.descricao = updateData.descricaoHtml
              ? stripHtmlToPlainText(updateData.descricaoHtml)
              : null;
          }
          const proposedContactIds = Array.isArray(proposed.contactosIds)
            ? proposed.contactosIds.filter(
                (value): value is string => typeof value === "string",
              )
            : undefined;
          const proposedBrandIds = Array.isArray(proposed.marcasIds)
            ? proposed.marcasIds.filter(
                (value): value is string => typeof value === "string",
              )
            : undefined;
          await assertTenantReferences(context.empresaId, {
            entidadeId: updateData.entidadeId as string | null,
            contactoId: updateData.contactoId as string | null,
            visitaId: updateData.visitaId as string | null,
            contactosIds: proposedContactIds ?? [],
            marcasIds: proposedBrandIds ?? [],
          }, context);
          if (proposedBrandIds) {
            const brandRows = proposedBrandIds.length
              ? await db.query.marcas.findMany({
                  where: (brand, { and, eq, inArray }) =>
                    and(
                      eq(brand.empresaId, context.empresaId),
                      inArray(brand.id, proposedBrandIds),
                    ),
                })
              : [];
            updateData.marca = brandRows.map((brand) => brand.nome).join(", ") || null;
          }
          if (Object.keys(updateData).length > 0) {
            await db
              .update(leads)
              .set({ ...updateData, updatedAt: new Date() })
              .where(eq(leads.id, request.leadId));
          }
          if (proposedContactIds) {
            await db
              .delete(leadsContactos)
              .where(eq(leadsContactos.leadId, request.leadId));
            if (proposedContactIds.length) {
              await db.insert(leadsContactos).values(
                Array.from(new Set(proposedContactIds)).map((contactoId) => ({
                  leadId: request.leadId,
                  contactoId,
                })),
              );
            }
          }
          if (proposedBrandIds) {
            await db
              .delete(leadsMarcas)
              .where(eq(leadsMarcas.leadId, request.leadId));
            if (proposedBrandIds.length) {
              await db.insert(leadsMarcas).values(
                Array.from(new Set(proposedBrandIds)).map((marcaId) => ({
                  leadId: request.leadId,
                  marcaId,
                })),
              );
            }
          }
          await syncLeadRecordToOdoo({
            empresaId: context.empresaId,
            leadId: request.leadId,
            actorUserId: request.requestedByUserId,
            changedFields: [
              ...Object.keys(updateData),
              ...(proposedContactIds ? ["contactosIds"] : []),
              ...(proposedBrandIds ? ["marcasIds"] : []),
            ],
          });
        }

        const [updated] = await db
          .update(leadApprovalRequests)
          .set({
            status:
              action === "approve"
                ? "approved"
                : action,
            reviewerUserId: context.userId,
            reviewComment: comment || null,
            reviewedAt: new Date(),
            adminSeenAt: new Date(),
            agentSeenAt: null,
            updatedAt: new Date(),
          })
          .where(eq(leadApprovalRequests.id, request.id))
          .returning();
        return res.json({ success: true, request: updated });
      } catch (error: any) {
        console.error("[CRM Leads] Approval review error:", error);
        return res.status(error?.status ?? 500).json({
          success: false,
          message: error?.message ?? "Erro ao rever pedido.",
        });
      }
    },
  );

  // GET /api/crm/leads/:id - Get specific lead with context (entidade, contacto, visita)
  router.get("/:id", isAuthenticated, async (req, res) => {
    try {
      const context = await requireUserContext(req);
      const { empresaId } = context;
      await assertLeadsEnabled(empresaId);

      const id = req.params.id as string;
      await assertLeadAccess(context as LeadActorContext, id);

      console.log("[CRM Leads] GET /:id", { id, empresaId });

      // First, try loading with contactosAssociados and marcasAssociadas
      let lead: any = null;
      let contactosAssociados: any[] = [];
      let marcas: any[] = [];

      try {
        lead = await db.query.leads.findFirst({
          where: and(eq(leads.id, id), eq(leads.empresaId, empresaId)),
          with: {
            entidade: true,
            contacto: true,
            visita: true,
            contactosAssociados: {
              with: {
                contacto: true,
              },
            },
            marcasAssociadas: {
              with: {
                marca: true,
              },
            },
          },
        });

        if (lead && lead.contactosAssociados) {
          contactosAssociados =
            lead.contactosAssociados.map((lc: any) => lc.contacto) ?? [];
        }

        if (lead && lead.marcasAssociadas) {
          marcas =
            lead.marcasAssociadas.map((lm: any) => ({
              id: lm.marca?.id,
              nome: lm.marca?.nome,
            })) ?? [];
        }
      } catch (innerError: any) {
        // If leads_contactos or leads_marcas doesn't exist yet, load without them
        if (
          innerError?.code === "42P01" ||
          innerError?.message?.includes("leads_contactos") ||
          innerError?.message?.includes("leads_marcas")
        ) {
          console.warn(
            "[CRM Leads] Table doesn't exist, loading without relations",
            { code: innerError?.code, message: innerError?.message }
          );
          lead = await db.query.leads.findFirst({
            where: and(eq(leads.id, id), eq(leads.empresaId, empresaId)),
            with: {
              entidade: true,
              contacto: true,
              visita: true,
            },
          });
          contactosAssociados = [];
          marcas = [];
        } else {
          throw innerError;
        }
      }

      if (!lead) {
        return res
          .status(404)
          .json({ success: false, message: "Lead não encontrado." });
      }

      console.log("[CRM Leads] GET /:id success", {
        leadId: id,
        contactosCount: contactosAssociados.length,
        marcasCount: marcas.length,
      });

      return res.json({
        lead: {
          ...lead,
          entidadeNome: lead.entidade?.nome ?? null,
          contactoNome: lead.contacto?.nome ?? null,
          visitaData: lead.visita?.dataVisita ?? null,
          contactosAssociados,
          marcas,
        },
      });
    } catch (error: any) {
      if (error?.code === "LEADS_NOT_ENABLED") {
        return res.status(200).json({
          success: false,
          notEnabled: true,
          message: "Módulo de Leads não está ativo para esta empresa.",
        });
      }

      console.error("[CRM Leads] GET /:id error:", {
        leadId: req.params.id,
        empresaId: (await getUserContext(req).catch(() => null))?.empresaId,
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
      });

      return res.status(500).json({
        success: false,
        message: "Erro ao obter lead.",
        details: error?.message || "Erro desconhecido",
      });
    }
  });

  // POST /api/crm/leads - Create new lead
  router.post("/", isAuthenticated, async (req, res) => {
    try {
      const context = await requireUserContext(req);
      const { empresaId } = context;
      await assertLeadsEnabled(empresaId);
      const permissions = await getLeadActorPermissions(
        context as LeadActorContext,
      );
      if (context.userRole !== "admin" && permissions.mode === "view") {
        return res.status(403).json({
          success: false,
          message: "Não tem permissão para criar leads.",
        });
      }

      const body = req.body;

      console.log("[CRM Leads] POST body", body);

      const {
        entidadeId,
        contactoId,
        visitaId,
        titulo,
        descricao,
        descricaoHtml,
        tipoLead,
        marca,
        estado,
        valorPrevisto,
        moeda,
        responsavelUserId,
        contactosIds,
        marcasIds,
      } = body;

      // FASE-LEADS-CLEAN-01: titulo + (entidadeId OR contactoId) required
      if (!titulo) {
        return res.status(400).json({
          success: false,
          message: "Título é obrigatório.",
        });
      }

      if (!entidadeId && !contactoId) {
        return res.status(400).json({
          success: false,
          message:
            "É obrigatório indicar pelo menos uma Entidade ou um Contacto.",
        });
      }
      await assertTenantReferences(empresaId, {
        entidadeId,
        contactoId,
        visitaId,
        assignedUserId: responsavelUserId,
        contactosIds: Array.isArray(contactosIds) ? contactosIds : [],
        marcasIds: Array.isArray(marcasIds) ? marcasIds : [],
      }, context);

      // Validate with schema
      const validation = insertLeadSchema.safeParse({
        entidadeId,
        contactoId,
        visitaId: visitaId ?? null,
        titulo,
        descricao: descricaoHtml ? stripHtmlToPlainText(descricaoHtml) : descricao ?? null,
        descricaoHtml: descricaoHtml ?? null,
        tipoLead: tipoLead ?? null,
        marca: marca ?? null,
        estado: estado ?? "novo",
        valorPrevisto: valorPrevisto ?? null,
        moeda: moeda ?? "EUR",
        responsavelUserId: responsavelUserId ?? null,
        contactosIds: contactosIds ?? undefined,
        marcasIds: marcasIds ?? undefined,
      });

      if (!validation.success) {
        console.log(
          "[CRM Leads] POST validation errors:",
          validation.error.flatten()
        );
        return res.status(400).json({
          success: false,
          message: "Validação falhou",
          errors: validation.error.flatten(),
        });
      }

      // Determine final marca value based on marcasIds
      let finalMarca = marca ?? null;
      if (marcasIds && marcasIds.length > 0) {
        // Fetch marca names from database
        const marcasData = await db.query.marcas.findMany({
          where: (m, { inArray }) => inArray(m.id, marcasIds),
        });
        if (marcasData.length > 0) {
          finalMarca = marcasData.map((m) => m.nome).join(", ");
        }
      }

      const [created] = await db
        .insert(leads)
        .values({
          empresaId,
          entidadeId,
          contactoId,
          visitaId: visitaId ?? null,
          titulo,
          descricao: descricaoHtml ? stripHtmlToPlainText(descricaoHtml) : descricao ?? null,
          descricaoHtml: descricaoHtml ?? null,
          tipoLead: tipoLead ?? null,
          marca: finalMarca,
          estado: estado ?? "novo",
          valorPrevisto: valorPrevisto ?? null,
          moeda: moeda ?? "EUR",
          responsavelUserId: responsavelUserId ?? null,
        })
        .returning();

      if (context.userRole === "agent") {
        await addLocalLeadFollower({
          empresaId,
          leadId: created.id,
          userId: context.userId,
          odooPartnerId: permissions.odooPartnerId,
          source: "app",
        });
      }

      // FASE-LEADS-CLEAN-03: Handle contactosIds only if contacto exists
      if (contactosIds && contactosIds.length > 0) {
        const idsToInsert = Array.from(
          new Set([contactoId, ...contactosIds])
        ).filter(Boolean); // Filter out null/undefined
        if (idsToInsert.length > 0) {
          await db
            .delete(leadsContactos)
            .where(eq(leadsContactos.leadId, created.id));
          for (const cId of idsToInsert) {
            await db.insert(leadsContactos).values({
              leadId: created.id,
              contactoId: cId,
            });
          }
        }
      } else if (contactoId) {
        // Only create leadsContactos entry if contactoId exists (FASE-LEADS-CLEAN-03)
        await db.insert(leadsContactos).values({
          leadId: created.id,
          contactoId: contactoId,
        });
      }

      // Handle marcasIds if provided
      if (marcasIds && marcasIds.length > 0) {
        const uniqueMarcaIds = Array.from(
          new Set(marcasIds as string[])
        );

        for (const mId of uniqueMarcaIds) {
          const insertValue: typeof leadsMarcas.$inferInsert = {
            leadId: created.id,
            marcaId: mId,
          };

          await db.insert(leadsMarcas).values(insertValue);
        }
      }


      console.log("[CRM Leads] POST created lead", {
        id: created.id,
        marcasCount: marcasIds?.length ?? 0,
      });

      return res.status(201).json({ success: true, lead: created });
    } catch (error: any) {
      if (error?.code === "LEADS_NOT_ENABLED") {
        return res.status(200).json({
          success: false,
          notEnabled: true,
          message: "Módulo de Leads não está ativo para esta empresa.",
        });
      }

      if (error?.status === 400) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      console.error("[CRM Leads] POST /api/crm/leads error:", {
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
        stack: error?.stack,
      });

      return res.status(500).json({
        success: false,
        message: error?.message || "Erro inesperado ao criar lead.",
      });
    }
  });

  // PATCH /api/crm/leads/:id - Update lead
  router.patch("/:id", isAuthenticated, async (req, res) => {
    try {
      const context = await requireUserContext(req);
      const { empresaId } = context;
      await assertLeadsEnabled(empresaId);

      const id = req.params.id as string;
      const currentLead = await assertLeadAccess(
        context as LeadActorContext,
        id,
      );
      const permissions = await getLeadActorPermissions(
        context as LeadActorContext,
      );
      const persistedLead = await db.query.leads.findFirst({
        where: and(eq(leads.id, id), eq(leads.empresaId, empresaId)),
      });
      if (!persistedLead) {
        return res.status(404).json({
          success: false,
          message: "Lead não encontrado.",
        });
      }
      if (context.userRole !== "admin" && permissions.mode === "view") {
        return res.status(403).json({
          success: false,
          message: "Tem acesso de consulta, mas não pode alterar este lead.",
        });
      }
      const {
        entidadeId,
        contactoId,
        visitaId,
        titulo,
        descricao,
        descricaoHtml,
        tipoLead,
        marca,
        estado,
        valorPrevisto,
        moeda,
        responsavelUserId,
        odooLeadId,
        contactosIds,
        marcasIds,
      } = req.body;

      if (
        context.userRole === "agent" &&
        changesRequireAdminApproval(
          permissions.mode,
          req.body ?? {},
          persistedLead as Record<string, unknown>,
        )
      ) {
        let baseOdooWriteDate: string | null = null;
        if (currentLead.odooLeadId) {
          const remoteLead = await getOdooLeadById(
            empresaId,
            Number(currentLead.odooLeadId),
          );
          baseOdooWriteDate = remoteLead?.writeDate ?? null;
        }
        const approvalRequest = await createOrReplaceLeadApprovalRequest({
          empresaId,
          leadId: id,
          requestedByUserId: context.userId,
          requestType: currentLead.odooLeadId ? "update" : "create",
          proposedChanges: req.body ?? {},
          baseOdooWriteDate,
        });
        return res.status(202).json({
          success: true,
          approvalRequired: true,
          request: approvalRequest,
          message: "Alterações enviadas ao administrador para aprovação.",
        });
      }

      const updateData: any = {};
      await assertTenantReferences(empresaId, {
        entidadeId,
        contactoId,
        visitaId,
        assignedUserId: responsavelUserId,
        contactosIds: Array.isArray(contactosIds) ? contactosIds : [],
        marcasIds: Array.isArray(marcasIds) ? marcasIds : [],
      }, context);

      if (typeof titulo === "string") updateData.titulo = titulo;
      if (typeof entidadeId === "string" || entidadeId === null) {
        updateData.entidadeId = entidadeId;
      }
      if (typeof contactoId === "string" || contactoId === null) {
        updateData.contactoId = contactoId;
      }
      if (typeof visitaId === "string" || visitaId === null) {
        updateData.visitaId = visitaId;
      }
      if (typeof descricaoHtml === "string" || descricaoHtml === null) {
        updateData.descricaoHtml = descricaoHtml;
        updateData.descricao = descricaoHtml ? stripHtmlToPlainText(descricaoHtml) : null;
      } else if (typeof descricao === "string" || descricao === null) {
        updateData.descricao = descricao;
      }
      if (typeof tipoLead === "string" || tipoLead === null) updateData.tipoLead = tipoLead;
      if (typeof marca === "string") updateData.marca = marca;
      if (typeof estado === "string") updateData.estado = estado;
      if (valorPrevisto !== undefined) updateData.valorPrevisto = valorPrevisto;
      if (typeof moeda === "string") updateData.moeda = moeda;
      if (typeof responsavelUserId === "string")
        updateData.responsavelUserId = responsavelUserId;
      if (typeof odooLeadId === "string" || odooLeadId === null) {
        updateData.odooLeadId = odooLeadId;
      }

      // Handle marcasIds to update marca field
      if (marcasIds !== undefined && marcasIds.length > 0) {
        const marcasData = await db.query.marcas.findMany({
          where: (m, { and, eq, inArray }) =>
            and(eq(m.empresaId, empresaId), inArray(m.id, marcasIds)),
        });
        if (marcasData.length > 0) {
          updateData.marca = marcasData.map((m) => m.nome).join(", ");
        }
      } else if (marcasIds !== undefined) {
        updateData.marca = null;
      }

      const hasUpdateData = Object.keys(updateData).length > 0;
      const hasContactosIds = contactosIds !== undefined;
      const hasMarcasIds = marcasIds !== undefined;

      if (!hasUpdateData && !hasContactosIds && !hasMarcasIds) {
        return res.status(400).json({
          success: false,
          message: "Nenhum campo para atualizar.",
        });
      }

      let updated: typeof leads.$inferSelect | undefined;
      const existingLead = await db.query.leads.findFirst({
        where: and(eq(leads.id, id), eq(leads.empresaId, empresaId)),
      });

      if (!existingLead) {
        return res
          .status(404)
          .json({ success: false, message: "Lead não encontrado." });
      }

      if (hasUpdateData) {
        const shouldMarkPendingSync =
          (typeof updateData.odooLeadId === "string" && updateData.odooLeadId.length > 0) ||
          (updateData.odooLeadId === undefined && !!existingLead.odooLeadId);

        updateData.updatedAt = new Date();
        if (shouldMarkPendingSync) {
          updateData.needsSync = true;
          updateData.syncStatus = "pending";
          updateData.syncError = null;
        }
        const result = await db
          .update(leads)
          .set(updateData)
          .where(and(eq(leads.id, id), eq(leads.empresaId, empresaId)))
          .returning();
        updated = result[0];
      } else {
        updated = existingLead;
      }

      if (!updated) {
        return res
          .status(404)
          .json({ success: false, message: "Lead não encontrado." });
      }

      if (contactoId !== undefined) {
        await db
          .delete(leadsContactos)
          .where(
            and(
              eq(leadsContactos.leadId, id),
              eq(leadsContactos.role, "principal"),
            ),
          );
        if (contactoId) {
          const existingContactLink = await db.query.leadsContactos.findFirst({
            where: and(
              eq(leadsContactos.leadId, id),
              eq(leadsContactos.contactoId, contactoId),
            ),
          });
          if (!existingContactLink) {
            await db.insert(leadsContactos).values({
              leadId: id,
              contactoId,
              role: "principal",
            });
          }
        }
      }

      // FASE-LEADS-CLEAN-03: Handle contactosIds only if they are valid (not null)
      if (hasContactosIds) {
        const idsToInsert = Array.from(
          new Set(contactosIds as string[])
        ).filter(
          (val): val is string =>
            typeof val === "string" && val.length > 0
        );

        if (idsToInsert.length > 0) {
          await db
            .delete(leadsContactos)
            .where(eq(leadsContactos.leadId, id));

          for (const cId of idsToInsert) {
            const insertValue: typeof leadsContactos.$inferInsert = {
              leadId: id,
              contactoId: cId,
            };

            await db.insert(leadsContactos).values(insertValue);
          }
        } else {
          // If all contactosIds were null, delete all associations
          await db
            .delete(leadsContactos)
            .where(eq(leadsContactos.leadId, id));
        }
      }


      // Handle marcasIds if provided
      if (hasMarcasIds) {
        const uniqueMarcaIds = Array.from(
          new Set(marcasIds as string[])
        );

        await db
          .delete(leadsMarcas)
          .where(eq(leadsMarcas.leadId, id));

        for (const mId of uniqueMarcaIds) {
          const insertValue: typeof leadsMarcas.$inferInsert = {
            leadId: id,
            marcaId: mId,
          };

          await db.insert(leadsMarcas).values(insertValue);
        }
      }


      // Refetch updated lead if we modified it
      if (hasUpdateData) {
        // Lead was already updated above
      } else if (hasContactosIds || hasMarcasIds) {
        // Relations changed, need to refetch
        const result = await db.query.leads.findFirst({
          where: and(eq(leads.id, id), eq(leads.empresaId, empresaId)),
        });
        updated = result;
      }

      console.log("[CRM Leads] PATCH updated lead", {
        id,
        marcasCount: marcasIds?.length ?? 0,
      });

      return res.json({ success: true, lead: updated });
    } catch (error: any) {
      if (error?.code === "LEADS_NOT_ENABLED") {
        return res.status(200).json({
          success: false,
          notEnabled: true,
          message: "Módulo de Leads não está ativo para esta empresa.",
        });
      }

      if (error?.status === 400) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      console.error("[CRM Leads] PATCH /:id error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Erro ao atualizar lead." });
    }
  });

  // POST /api/crm/leads/:id/odoo/sync - Sincronizar lead com Odoo
  router.post("/:id/odoo/sync", isAuthenticated, async (req, res) => {
    try {
      const context = await requireUserContext(req);
      const { empresaId, userId } = context;
      await assertLeadsEnabled(empresaId);

      const leadId = req.params.id as string;
      const accessibleLead = await assertLeadAccess(
        context as LeadActorContext,
        leadId,
      );
      const permissions = await getLeadActorPermissions(
        context as LeadActorContext,
      );
      if (context.userRole === "agent") {
        if (permissions.mode === "view") {
          return res.status(403).json({
            success: false,
            message:
              "Tem acesso de consulta, mas não pode sincronizar este lead.",
          });
        }
        const needsApproval =
          permissions.mode === "propose" ||
          (!accessibleLead.odooLeadId && !permissions.canCreate);
        if (needsApproval) {
          let baseOdooWriteDate: string | null = null;
          if (accessibleLead.odooLeadId) {
            const remote = await getOdooLeadById(
              empresaId,
              Number(accessibleLead.odooLeadId),
            );
            baseOdooWriteDate = remote?.writeDate ?? null;
          }
          const approvalRequest =
            await createOrReplaceLeadApprovalRequest({
              empresaId,
              leadId,
              requestedByUserId: userId,
              requestType: accessibleLead.odooLeadId
                ? "update"
                : "create",
              proposedChanges: {},
              baseOdooWriteDate,
            });
          return res.status(202).json({
            success: true,
            approvalRequired: true,
            request: approvalRequest,
            message:
              "Pedido de sincronização enviado ao administrador.",
          });
        }
      }
      console.log("[CRM Leads] POST /:id/odoo/sync push-only", {
        leadId,
        body: req.body,
      });

      // Carregar lead com entidade e contacto
      const lead = await db.query.leads.findFirst({
        where: and(eq(leads.id, leadId), eq(leads.empresaId, empresaId)),
        with: {
          entidade: true,
          contacto: true,
          visita: true,
        },
      });

      if (!lead) {
        return res
          .status(404)
          .json({ success: false, message: "Lead não encontrado." });
      }

      // Ligações locais são obrigatórias para criar/recriar, não para atualizar.
      if (!lead.odooLeadId && (!lead.entidade || !lead.contacto)) {
        return res.status(400).json({
          success: false,
          message:
            "Este lead não tem entidade ou contacto associados suficientes para sincronizar com o Odoo.",
        });
      }

      const entidade: any = lead.entidade;
      if (!lead.odooLeadId && (!entidade || !entidade.odooPartnerId)) {
        return res.status(400).json({
          success: false,
          message:
            "Esta entidade não está ligada ao Odoo. Liga primeiro a entidade a um parceiro no Odoo.",
        });
      }

      let odooLeadId: number | undefined;
      let created = false;

      const [syncingUser, assignedUser, empresa] = await Promise.all([
        userId
          ? db.query.users.findFirst({
              where: eq(users.id, userId),
              columns: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            })
          : Promise.resolve(undefined),
        lead.responsavelUserId
          ? db.query.users.findFirst({
              where: eq(users.id, lead.responsavelUserId),
              columns: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            })
          : Promise.resolve(undefined),
        db.query.empresas.findFirst({
          where: eq(empresas.id, empresaId),
          columns: {
            id: true,
            nome: true,
          },
        }),
      ]);

      const visitaContext =
        lead.visitaId && !Array.isArray(lead.visita)
          ? `Visita ${lead.visitaId}`
          : null;

      const syncMetadata = {
        appRecordId: lead.id,
        appRecordRef: lead.id,
        appLeadRef: lead.id,
        appOrigin: "app" as const,
        createdByUserId: syncingUser?.id ?? null,
        createdByUserName: formatUserName(syncingUser),
        createdByUserEmail: syncingUser?.email ?? null,
        assignedUserId: assignedUser?.id ?? null,
        assignedUserName: formatUserName(assignedUser),
        companyId: empresa?.id ?? empresaId,
        companyName: empresa?.nome ?? null,
        lastSyncAt: new Date(),
        syncStatus: "synced" as const,
        lastSyncDirection: "app_to_odoo" as const,
        internalNotes: lead.descricao ?? null,
        visitContext: visitaContext,
      };

      try {
        if (!lead.odooLeadId) {
          // Criar novo lead no Odoo
          odooLeadId = await createLeadFromVmLead({
            vmLead: lead,
            entidade: lead.entidade,
            contacto: lead.contacto,
            empresaId,
            appSync: syncMetadata,
          });
          created = true;

          // Atualizar lead com odooLeadId
          await db
            .update(leads)
            .set({ odooLeadId: String(odooLeadId) })
            .where(eq(leads.id, leadId));

          console.log(
            `[CRM Leads] Lead ${leadId} criado no Odoo com ID ${odooLeadId}`
          );
        } else {
          // Atualizar lead existente no Odoo
          const odooId = Number(lead.odooLeadId);
          try {
            await updateLeadFromVmLead({
              odooLeadId: odooId,
              vmLead: lead,
              entidade: lead.entidade,
              contacto: lead.contacto,
              empresaId,
              appSync: syncMetadata,
            });

            odooLeadId = odooId;
            console.log(
              `[CRM Leads] Lead ${leadId} actualizado no Odoo com ID ${odooId}`
            );
          } catch (updateError: any) {
            if (!isMissingOdooLeadError(updateError?.message)) {
              throw updateError;
            }
            if (
              !lead.entidade ||
              !lead.contacto ||
              !(lead.entidade as any).odooPartnerId
            ) {
              return res.status(409).json({
                success: false,
                message:
                  "O lead foi eliminado no Odoo e precisa de entidade e contacto locais para ser recriado.",
              });
            }

            console.warn(
              `[CRM Leads] Lead ${leadId} aponta para Odoo ID ${odooId}, mas o registo já não existe. A recriar.`
            );

            odooLeadId = await createLeadFromVmLead({
              vmLead: lead,
              entidade: lead.entidade,
              contacto: lead.contacto,
              empresaId,
              appSync: syncMetadata,
            });
            created = true;

            await db
              .update(leads)
              .set({ odooLeadId: String(odooLeadId) })
              .where(eq(leads.id, leadId));
          }
        }

        if (odooLeadId) {
          await db
            .update(leads)
            .set({
              odooLeadId: String(odooLeadId),
              needsSync: false,
              syncStatus: "synced",
              syncError: null,
              lastSyncAt: new Date(),
            } as any)
            .where(eq(leads.id, leadId));
        }
      } catch (odooError: any) {
        await db
          .update(leads)
          .set({
            needsSync: true,
            syncStatus: "error",
            syncError: odooError?.message || "Unknown error",
            updatedAt: new Date(),
          } as any)
          .where(eq(leads.id, leadId));

        console.error("[CRM Leads] Erro ao sincronizar com Odoo:", {
          leadId,
          message: odooError?.message,
        });

        return res.status(500).json({
          success: false,
          message:
            "Erro ao sincronizar com o Odoo. Tenta novamente ou verifica a configuração Odoo.",
          details: odooError?.message || "Unknown error",
        });
      }

      if (odooLeadId) {
        const followerRows = await db
          .select({ odooPartnerId: leadFollowers.odooPartnerId })
          .from(leadFollowers)
          .where(
            and(
              eq(leadFollowers.empresaId, empresaId),
              eq(leadFollowers.leadId, leadId),
            ),
          );
        await subscribeOdooLeadFollowers({
          empresaId,
          odooLeadId,
          partnerIds: followerRows
            .map((row) => Number(row.odooPartnerId))
            .filter((id) => Number.isFinite(id) && id > 0),
        });
        const actorName = formatUserName(syncingUser) ?? "Utilizador";
        await postOdooLeadAuditNote({
          empresaId,
          odooLeadId,
          body: `Sincronizado através do Visit Manager por ${actorName}${
            syncingUser?.email ? ` (${syncingUser.email})` : ""
          }.`,
        }).catch((error) => {
          console.warn(
            "[CRM Leads] Não foi possível registar nota no Odoo:",
            error,
          );
        });
      }

      return res.json({
        success: true,
        created,
        pulled: false,
        odooLeadId: String(odooLeadId),
      });
    } catch (error: any) {
      if (error?.code === "LEADS_NOT_ENABLED") {
        return res.status(200).json({
          success: false,
          notEnabled: true,
          message: "Módulo de Leads não está ativo para esta empresa.",
        });
      }

      console.error("[CRM Leads] POST /:id/odoo/sync error:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao sincronizar lead com Odoo.",
      });
    }
  });

  router.post("/:id/odoo/pull", isAuthenticated, async (req, res) => {
    try {
      const context = await requireUserContext(req);
      const { empresaId } = context;
      await assertLeadsEnabled(empresaId);

      const leadId = req.params.id as string;
      await assertLeadAccess(context as LeadActorContext, leadId);
      const lead = await db.query.leads.findFirst({
        where: and(eq(leads.id, leadId), eq(leads.empresaId, empresaId)),
        columns: {
          id: true,
          odooLeadId: true,
        },
      });

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: "Lead não encontrado.",
        });
      }

      if (!lead.odooLeadId) {
        return res.status(400).json({
          success: false,
          message: "Este lead ainda não está sincronizado com o Odoo.",
        });
      }

      const odooLead = await getOdooLeadById(empresaId, Number(lead.odooLeadId));
      if (!odooLead) {
        return res.status(404).json({
          success: false,
          message: "Lead não encontrado no Odoo.",
        });
      }

      await db
        .update(leads)
        .set({
          ...buildLeadUpdateFromOdoo(odooLead),
          needsSync: false,
          syncStatus: "synced",
          syncError: null,
          lastSyncAt: new Date(),
        } as any)
        .where(eq(leads.id, leadId));
      await syncLeadFollowersFromOdoo({
        empresaId,
        leadId,
        followerPartnerIds: odooLead.followerPartnerIds,
      });

      return res.json({
        success: true,
        pulled: true,
        odooLeadId: lead.odooLeadId,
      });
    } catch (error: any) {
      if (error?.code === "LEADS_NOT_ENABLED") {
        return res.status(200).json({
          success: false,
          notEnabled: true,
          message: "Módulo de Leads não está ativo para esta empresa.",
        });
      }

      console.error("[CRM Leads] POST /:id/odoo/pull error:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar lead a partir do Odoo.",
        details: error?.message || "Unknown error",
      });
    }
  });

  // GET /api/crm/leads/:id/odoo/attachments - List Odoo attachments for a lead
  router.get(
    "/:id/odoo/attachments",
    isAuthenticated,
    async (req, res) => {
      try {
        const context = await requireUserContext(req);
        const { empresaId } = context;
        await assertLeadsEnabled(empresaId);

        const id = req.params.id as string;
        await assertLeadAccess(context as LeadActorContext, id);
        const permissions = await getLeadActorPermissions(
          context as LeadActorContext,
        );
        if (
          context.userRole === "agent" &&
          !permissions.canViewAttachments
        ) {
          return res.status(403).json({
            success: false,
            message: "Não tem permissão para consultar anexos deste lead.",
          });
        }

        console.log("[CRM Leads] GET /:id/odoo/attachments", {
          leadId: id,
          empresaId,
        });

        // Load lead from database
        const lead = await db.query.leads.findFirst({
          where: and(eq(leads.id, id), eq(leads.empresaId, empresaId)),
          columns: {
            id: true,
            odooLeadId: true,
          },
        });

        if (!lead) {
          return res.status(404).json({
            success: false,
            message: "Lead não encontrado",
          });
        }

        // If no odooLeadId, return empty attachments
        if (!lead.odooLeadId) {
          return res.json({
            success: true,
            attachments: [],
          });
        }

        // Fetch attachments from Odoo
        const attachments = await listLeadAttachments({
          empresaId,
          odooLeadId: lead.odooLeadId,
        });

        console.log(
          "[CRM Leads] GET /:id/odoo/attachments success",
          {
            leadId: id,
            odooLeadId: lead.odooLeadId,
            count: attachments.length,
          }
        );

        return res.json({
          success: true,
          attachments: attachments.map((attachment) => ({
            ...attachment,
            downloadUrl:
              `/api/crm/leads/${id}/odoo/attachments/${attachment.id}/download`,
          })),
        });
      } catch (error: any) {
        if (error?.code === "LEADS_NOT_ENABLED") {
          return res.status(200).json({
            success: false,
            notEnabled: true,
            message: "Módulo de Leads não está ativo para esta empresa.",
          });
        }

        console.error(
          "[CRM Leads] Erro ao listar anexos Odoo do lead",
          {
            leadId: req.params.id,
            empresaId: (await getUserContext(req).catch(
              () => null
            ))?.empresaId,
            error: error?.message,
          }
        );

        return res.status(500).json({
          success: false,
          message:
            "Erro ao carregar anexos do Odoo. Tenta novamente mais tarde.",
        });
      }
    }
  );

  router.get("/:id/odoo/chatter", isAuthenticated, async (req, res) => {
    try {
      const context = await requireUserContext(req);
      await assertLeadsEnabled(context.empresaId);
      const leadId = String(req.params.id);
      await assertLeadAccess(context as LeadActorContext, leadId);
      const permissions = await getLeadActorPermissions(
        context as LeadActorContext,
      );
      if (
        context.userRole === "agent" &&
        !permissions.canViewChatter
      ) {
        return res.status(403).json({
          success: false,
          message: "Não tem permissão para consultar mensagens deste lead.",
        });
      }
      const lead = await db.query.leads.findFirst({
        where: and(
          eq(leads.id, leadId),
          eq(leads.empresaId, context.empresaId),
        ),
        columns: { odooLeadId: true },
      });
      if (!lead?.odooLeadId) {
        return res.json({
          success: true,
          canPublish: permissions.canPublishChatter,
          recipients: [],
          messages: [],
        });
      }
      const [messages, recipients] = await Promise.all([
        listLeadChatter({
          empresaId: context.empresaId,
          odooLeadId: lead.odooLeadId,
        }),
        listOdooLeadChatterRecipients({
          empresaId: context.empresaId,
          odooLeadId: lead.odooLeadId,
        }),
      ]);
      return res.json({
        success: true,
        canPublish: permissions.canPublishChatter,
        recipients,
        messages: messages.map((message) => ({
          ...message,
          body: stripHtmlToPlainText(message.bodyHtml),
          bodyHtml: undefined,
        })),
      });
    } catch (error: any) {
      return res.status(error?.status ?? 500).json({
        success: false,
        message: error?.message ?? "Erro ao carregar mensagens do Odoo.",
      });
    }
  });

  router.post("/:id/odoo/chatter", isAuthenticated, async (req, res) => {
    try {
      const context = await requireUserContext(req);
      await assertLeadsEnabled(context.empresaId);
      const leadId = String(req.params.id);
      await assertLeadAccess(context as LeadActorContext, leadId);
      const permissions = await getLeadActorPermissions(
        context as LeadActorContext,
      );
      if (!permissions.canPublishChatter) {
        return res.status(403).json({
          success: false,
          message: "Não tem permissão para publicar mensagens neste lead.",
        });
      }

      const parsed = z.object({
        body: z.string().trim().min(1).max(5000),
      }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Escreva uma mensagem com até 5000 caracteres.",
        });
      }

      const [lead, actor] = await Promise.all([
        db.query.leads.findFirst({
          where: and(
            eq(leads.id, leadId),
            eq(leads.empresaId, context.empresaId),
          ),
          columns: { odooLeadId: true },
        }),
        db.query.users.findFirst({
          where: and(
            eq(users.id, context.userId),
            eq(users.empresaId, context.empresaId),
          ),
          columns: { firstName: true, lastName: true, email: true },
        }),
      ]);
      if (!lead?.odooLeadId) {
        return res.status(409).json({
          success: false,
          message: "Este lead ainda não está ligado ao Odoo.",
        });
      }

      const authorName = formatUserName(actor) || "utilizador da app";
      const authorLabel = actor?.email && actor.email !== authorName
        ? `${authorName} (${actor.email})`
        : authorName;
      const messageId = await postOdooLeadChatterMessage({
        empresaId: context.empresaId,
        odooLeadId: lead.odooLeadId,
        body: parsed.data.body,
        authorLabel,
      });

      return res.status(201).json({ success: true, messageId });
    } catch (error: any) {
      console.error("[CRM Leads] Erro ao publicar no Chatter", {
        leadId: req.params.id,
        error: error?.message,
      });
      return res.status(error?.status ?? 500).json({
        success: false,
        message: error?.message ?? "Erro ao publicar a mensagem no Odoo.",
      });
    }
  });

  router.get(
    "/:id/odoo/attachments/:attachmentId/download",
    isAuthenticated,
    async (req, res) => {
      try {
        const context = await requireUserContext(req);
        await assertLeadsEnabled(context.empresaId);
        const leadId = String(req.params.id);
        await assertLeadAccess(context as LeadActorContext, leadId);
        const permissions = await getLeadActorPermissions(
          context as LeadActorContext,
        );
        if (
          context.userRole === "agent" &&
          !permissions.canViewAttachments
        ) {
          return res.status(403).json({
            success: false,
            message: "Não tem permissão para consultar este anexo.",
          });
        }
        const attachmentId = Number(req.params.attachmentId);
        if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
          return res.status(400).json({
            success: false,
            message: "Anexo inválido.",
          });
        }
        const lead = await db.query.leads.findFirst({
          where: and(
            eq(leads.id, leadId),
            eq(leads.empresaId, context.empresaId),
          ),
          columns: { odooLeadId: true },
        });
        if (!lead?.odooLeadId) {
          return res.status(404).json({
            success: false,
            message: "Lead Odoo não encontrado.",
          });
        }
        const attachment = await downloadLeadAttachment({
          empresaId: context.empresaId,
          odooLeadId: lead.odooLeadId,
          attachmentId,
        });
        if (!attachment) {
          return res.status(404).json({
            success: false,
            message: "Anexo não encontrado neste lead.",
          });
        }
        const safeName = attachment.name.replace(/[\r\n"]/g, "_");
        res.setHeader("Content-Type", attachment.mimetype);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${safeName}"`,
        );
        return res.send(attachment.buffer);
      } catch (error: any) {
        return res.status(error?.status ?? 500).json({
          success: false,
          message: error?.message ?? "Erro ao descarregar anexo.",
        });
      }
    },
  );

  // POST /api/crm/leads/:id/odoo/attachments - Upload attachment to Odoo lead
  router.post(
    "/:id/odoo/attachments",
    isAuthenticated,
    upload.single("file"),
    async (req, res) => {
      try {
        const context = await requireUserContext(req);
        const { empresaId } = context;
        await assertLeadsEnabled(empresaId);

        const id = req.params.id as string;
        await assertLeadAccess(context as LeadActorContext, id);
        const permissions = await getLeadActorPermissions(
          context as LeadActorContext,
        );
        if (
          context.userRole === "agent" &&
          (permissions.mode !== "publish" ||
            !permissions.canViewAttachments)
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Não tem permissão para enviar anexos para este lead.",
          });
        }

        console.log("[CRM Leads] POST /:id/odoo/attachments", {
          leadId: id,
          empresaId,
        });

        // Load lead from database
        const lead = await db.query.leads.findFirst({
          where: and(eq(leads.id, id), eq(leads.empresaId, empresaId)),
          columns: {
            id: true,
            odooLeadId: true,
          },
        });

        if (!lead) {
          return res.status(404).json({
            success: false,
            message: "Lead não encontrado",
          });
        }

        // Check if lead is synchronized with Odoo
        if (!lead.odooLeadId) {
          return res.status(400).json({
            success: false,
            message:
              "Este lead ainda não está sincronizado com o Odoo.",
          });
        }

        // Check if file was provided
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "Nenhum ficheiro enviado.",
          });
        }

        const file = req.file;
        const buffer = file.buffer;
        const fileName = file.originalname;
        const mimetype = file.mimetype || null;

        // Validate file size (max 10 MB)
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (buffer.length > MAX_FILE_SIZE) {
          return res.status(400).json({
            success: false,
            message: "Ficheiro demasiado grande (máx. 10 MB).",
          });
        }

        console.log("[CRM Leads] Upload file details", {
          leadId: id,
          fileName,
          size: buffer.length,
          mimetype,
        });

        // Call OdooClient to create attachment
        const attachmentId = await createLeadAttachment({
          empresaId,
          odooLeadId: lead.odooLeadId,
          fileName,
          mimetype,
          buffer,
        });

        console.log(
          "[CRM Leads] POST /:id/odoo/attachments success",
          {
            leadId: id,
            odooLeadId: lead.odooLeadId,
            attachmentId,
          }
        );

        return res.json({
          success: true,
          attachmentId,
        });
      } catch (error: any) {
        if (error?.code === "LEADS_NOT_ENABLED") {
          return res.status(200).json({
            success: false,
            notEnabled: true,
            message: "Módulo de Leads não está ativo para esta empresa.",
          });
        }

        console.error(
          "[CRM Leads] Erro ao fazer upload de anexo para Odoo",
          {
            leadId: req.params.id,
            fileName: req.file?.originalname,
            empresaId: (await getUserContext(req).catch(
              () => null
            ))?.empresaId,
            error: error?.message,
          }
        );

        return res.status(500).json({
          success: false,
          message:
            "Erro ao enviar anexo para o Odoo. Tenta novamente mais tarde.",
        });
      }
    }
  );

  // POST /api/ai/leads/transcribe - Transcribe audio to text
  router.post(
    "/ai/transcribe",
    isAuthenticated,
    upload.single("file"),
    async (req, res) => {
      try {
        const { empresaId } = await requireUserContext(req);
        await assertLeadsEnabled(empresaId);

        if (!req.file) {
          console.error(
            "[CRM Leads AI] POST /ai/transcribe: No file provided"
          );
          return res.status(400).json({
            success: false,
            message: "Nenhum ficheiro de áudio fornecido.",
          });
        }

        // FASE-LEADS-IA-03: Log file details from multer
        console.log("[CRM Leads AI] File received from multer", {
          mimetype: req.file.mimetype,
          size: req.file.size,
          originalName: req.file.originalname,
          fieldName: req.file.fieldname,
        });

        // Validate file size on arrival
        if (!req.file.buffer || req.file.buffer.length === 0) {
          console.error(
            "[CRM Leads AI] POST /ai/transcribe: Empty buffer received"
          );
          return res.status(400).json({
            success: false,
            message: "Ficheiro de áudio vazio ou inválido.",
          });
        }

        // Save file to temp location for transcription
        const tmpDir = "/tmp";
        const tmpFile = path.join(
          tmpDir,
          `audio_${Date.now()}.webm`
        );

        try {
          // Write buffer to file
          console.log(
            "[CRM Leads AI] Writing buffer to temp file...",
            { tmpFile, bufferSize: req.file.buffer.length }
          );
          await fs.promises.writeFile(tmpFile, req.file.buffer);
          console.log(
            "[CRM Leads AI] Temp file created successfully",
            { tmpFile }
          );

          // Verify file was written
          const stats = fs.statSync(tmpFile);
          console.log("[CRM Leads AI] Temp file verification", {
            tmpFile,
            actualSize: stats.size,
          });

          // Transcribe audio
          console.log(
            "[CRM Leads AI] Calling transcribeAudio()..."
          );
          const result = await transcribeAudio(tmpFile);

          // Clean up temp file
          await fs.promises.unlink(tmpFile).catch(() => {});

          // Validate result
          if (
            !result.text ||
            result.text.includes("indisponível")
          ) {
            console.warn(
              "[CRM Leads AI] Transcription returned warning/placeholder text",
              { text: result.text }
            );
            return res.status(503).json({
              success: false,
              message:
                "IA não está configurada. Contacta o administrador.",
            });
          }

          console.log(
            "[CRM Leads AI] Transcription success",
            { empresaId, textLength: result.text.length }
          );
          return res.json({
            success: true,
            text: result.text,
          });
        } catch (transcribeError: any) {
          // Clean up temp file on error
          await fs.promises.unlink(tmpFile).catch(() => {});

          // Distinguish between different error types
          console.error(
            "[CRM Leads AI] Transcription error caught:",
            {
              message:
                transcribeError?.message ||
                String(transcribeError),
              code: transcribeError?.code,
              status: transcribeError?.status,
              stack: transcribeError?.stack,
            }
          );

          // Determine error type and return appropriate message
          const errorMsg =
            transcribeError?.message ||
            String(transcribeError) ||
            "Unknown error";

          if (
            errorMsg.includes("empty") ||
            errorMsg.includes("0 bytes")
          ) {
            return res.status(400).json({
              success: false,
              message:
                "Ficheiro de áudio vazio. Grava de novo.",
            });
          }

          if (
            errorMsg.includes("API key") ||
            errorMsg.includes("not configured")
          ) {
            return res.status(503).json({
              success: false,
              message:
                "IA não está configurada. Contacta o administrador.",
            });
          }

          if (
            errorMsg.includes("401") ||
            errorMsg.includes("Unauthorized")
          ) {
            return res.status(503).json({
              success: false,
              message:
                "Erro de autenticação com serviço de IA. Contacta o administrador.",
            });
          }

          if (
            errorMsg.includes("429") ||
            errorMsg.includes("rate limit")
          ) {
            return res.status(429).json({
              success: false,
              message:
                "Serviço de transcrição sobrecarregado. Tenta de novo em alguns momentos.",
            });
          }

          if (
            errorMsg.includes("timeout") ||
            errorMsg.includes("ECONNREFUSED")
          ) {
            return res.status(503).json({
              success: false,
              message:
                "Serviço de transcrição indisponível. Tenta de novo mais tarde.",
            });
          }

          if (
            errorMsg.includes("could not be decoded") ||
            errorMsg.includes("format is not supported")
          ) {
            return res.status(400).json({
              success: false,
              message:
                "Formato de áudio não suportado ou ficheiro corrompido. Tenta gravar novamente.",
            });
          }

          // Generic fallback for other errors
          return res.status(500).json({
            success: false,
            message:
              "Falha ao transcrever áudio. Por favor, tenta novamente.",
          });
        }
      } catch (error: any) {
        console.error(
          "[CRM Leads AI] Handler error (outer catch):",
          {
            message: error?.message || String(error),
            code: error?.code,
            stack: error?.stack,
          }
        );
        return res.status(500).json({
          success: false,
          message:
            "Falha ao processar áudio. Por favor, tenta novamente.",
        });
      }
    }
  );

  // POST /api/ai/leads/summarize - Improve/summarize lead description text
  router.post("/ai/summarize", isAuthenticated, async (req, res) => {
    try {
      const { empresaId } = await requireUserContext(req);
      await assertLeadsEnabled(empresaId);

      const { text, titulo } = req.body;

      if (
        !text ||
        typeof text !== "string" ||
        text.trim().length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Text is required and cannot be empty",
        });
      }

      try {
        const client = getOpenAIClient();

        const prompt = `Analisa este contexto de lead de vendas e cria uma descrição profissional e estruturada em português.

**Título do Lead:** ${titulo || "Sem título"}

**Texto Original:**
${text}

Por favor, melhora e estrutura este texto, tornando-o mais profissional e claro. Mantém os pontos-chave mas apresenta de forma mais polida.
Responde apenas com o texto melhorado, sem explicações adicionais.`;

        const response = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Você é um especialista em escrita comercial e resumos de vendas. Responde sempre em português de Portugal.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        const improvedText =
          response.choices[0].message.content || text;

        console.log("[CRM Leads AI] Summarize success", {
          empresaId,
          originalLength: text.length,
          improvedLength: improvedText.length,
        });
        return res.json({
          success: true,
          text: improvedText,
        });
      } catch (aiError: any) {
        console.error("[CRM Leads AI] OpenAI error:", aiError);
        return res.status(500).json({
          success: false,
          message:
            "Failed to process text with AI: " +
            (aiError?.message || "Unknown error"),
        });
      }
    } catch (error: any) {
      console.error("[CRM Leads AI] Summarize error:", error);
      return res.status(500).json({
        success: false,
        message:
          "Failed to summarize text: " +
          (error?.message || "Unknown error"),
      });
    }
  });

  app.use("/api/crm/leads", router);
}
