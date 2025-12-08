import express from "express";
import { and, eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { db } from "../db";
import {
  leads,
  leadsContactos,
  insertLeadSchema,
  leadsMarcas,
} from "../../shared/schema";
import { isAuthenticated } from "../replitAuth";
import { getUserContext } from "../authContext";
import { requireUserContext } from "../auth/rbac";
import { assertLeadsEnabled } from "../integrations/crmLeads";
import {
  createLeadFromVmLead,
  updateLeadFromVmLead,
  listLeadAttachments,
  createLeadAttachment,
} from "../integrations/odooClient";
import { transcribeAudio, getOpenAIClient } from "../openai";
import multer from "multer";

export function registerCrmLeadsRoutes(app: express.Express) {
  const router = express.Router();

  // Multer configuration for file uploads (used by attachment and audio routes)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
  });

  // GET /api/crm/leads - List all leads for empresa (with filters and ordering)
  router.get("/", isAuthenticated, async (req, res) => {
    try {
      const { empresaId } = await requireUserContext(req);
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

  // GET /api/crm/leads/:id - Get specific lead with context (entidade, contacto, visita)
  router.get("/:id", isAuthenticated, async (req, res) => {
    try {
      const { empresaId } = await requireUserContext(req);
      await assertLeadsEnabled(empresaId);

      const id = req.params.id as string;

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
      const { empresaId } = await requireUserContext(req);
      await assertLeadsEnabled(empresaId);

      const body = req.body;

      console.log("[CRM Leads] POST body", body);

      const {
        entidadeId,
        contactoId,
        visitaId,
        titulo,
        descricao,
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

      // Validate with schema
      const validation = insertLeadSchema.safeParse({
        entidadeId,
        contactoId,
        visitaId: visitaId ?? null,
        titulo,
        descricao: descricao ?? null,
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
          descricao: descricao ?? null,
          marca: finalMarca,
          estado: estado ?? "novo",
          valorPrevisto: valorPrevisto ?? null,
          moeda: moeda ?? "EUR",
          responsavelUserId: responsavelUserId ?? null,
        })
        .returning();

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
      const { empresaId } = await requireUserContext(req);
      await assertLeadsEnabled(empresaId);

      const id = req.params.id as string;
      const {
        titulo,
        descricao,
        marca,
        estado,
        valorPrevisto,
        moeda,
        responsavelUserId,
        odooLeadId,
        contactosIds,
        marcasIds,
      } = req.body;

      const updateData: any = {};

      if (typeof titulo === "string") updateData.titulo = titulo;
      if (typeof descricao === "string") updateData.descricao = descricao;
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
          where: (m, { inArray }) => inArray(m.id, marcasIds),
        });
        if (marcasData.length > 0) {
          updateData.marca = marcasData.map((m) => m.nome).join(", ");
        }
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

      if (hasUpdateData) {
        const result = await db
          .update(leads)
          .set(updateData)
          .where(and(eq(leads.id, id), eq(leads.empresaId, empresaId)))
          .returning();
        updated = result[0];
      } else {
        const result = await db.query.leads.findFirst({
          where: and(eq(leads.id, id), eq(leads.empresaId, empresaId)),
        });
        updated = result;
      }

      if (!updated) {
        return res
          .status(404)
          .json({ success: false, message: "Lead não encontrado." });
      }

      // FASE-LEADS-CLEAN-03: Handle contactosIds only if they are valid (not null)
      if (hasContactosIds && contactosIds.length > 0) {
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
      if (hasMarcasIds && marcasIds.length > 0) {
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

      console.error("[CRM Leads] PATCH /:id error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Erro ao atualizar lead." });
    }
  });

  // POST /api/crm/leads/:id/odoo/sync - Sincronizar lead com Odoo
  router.post("/:id/odoo/sync", isAuthenticated, async (req, res) => {
    try {
      const { empresaId } = await requireUserContext(req);
      await assertLeadsEnabled(empresaId);

      const leadId = req.params.id as string;

      // Carregar lead com entidade e contacto
      const lead = await db.query.leads.findFirst({
        where: and(eq(leads.id, leadId), eq(leads.empresaId, empresaId)),
        with: {
          entidade: true,
          contacto: true,
        },
      });

      if (!lead) {
        return res
          .status(404)
          .json({ success: false, message: "Lead não encontrado." });
      }

      // Validar que lead tem entidade e contacto
      if (!lead.entidade || !lead.contacto) {
        return res.status(400).json({
          success: false,
          message:
            "Este lead não tem entidade ou contacto associados suficientes para sincronizar com o Odoo.",
        });
      }

      // Validar que entidade tem odooPartnerId
      const entidade: any = lead.entidade;
      if (!entidade || !entidade.odooPartnerId) {
        return res.status(400).json({
          success: false,
          message:
            "Esta entidade não está ligada ao Odoo. Liga primeiro a entidade a um parceiro no Odoo.",
        });
      }

      let odooLeadId: number | undefined;
      let created = false;

      try {
        if (!lead.odooLeadId) {
          // Criar novo lead no Odoo
          odooLeadId = await createLeadFromVmLead({
            vmLead: lead,
            entidade: lead.entidade,
            contacto: lead.contacto,
            empresaId,
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
          await updateLeadFromVmLead({
            odooLeadId: odooId,
            vmLead: lead,
            entidade: lead.entidade,
            contacto: lead.contacto,
            empresaId,
          });

          odooLeadId = odooId;
          console.log(
            `[CRM Leads] Lead ${leadId} actualizado no Odoo com ID ${odooId}`
          );
        }
      } catch (odooError: any) {
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

      return res.json({
        success: true,
        created,
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

  // GET /api/crm/leads/:id/odoo/attachments - List Odoo attachments for a lead
  router.get(
    "/:id/odoo/attachments",
    isAuthenticated,
    async (req, res) => {
      try {
        const { empresaId } = await requireUserContext(req);
        await assertLeadsEnabled(empresaId);

        const id = req.params.id as string;

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
          attachments,
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

  // POST /api/crm/leads/:id/odoo/attachments - Upload attachment to Odoo lead
  router.post(
    "/:id/odoo/attachments",
    isAuthenticated,
    upload.single("file"),
    async (req, res) => {
      try {
        const { empresaId } = await requireUserContext(req);
        await assertLeadsEnabled(empresaId);

        const id = req.params.id as string;

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
