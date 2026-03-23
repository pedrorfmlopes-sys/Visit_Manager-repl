// server/routes/crm/leadsRoutes.ts
import type { Express, Request, Response } from "express";
import { getUserContext } from "../../authContext";
import { storage } from "../../storage";

/**
 * Rotas de CRM Leads
 *
 * Nota importante:
 *  - Nesta versão o storage pode ainda não ter métodos de leads implementados.
 *  - Para não rebentar a app, usamos (storage as any) com verificações de typeof
 *    e devolvemos [] ou erros controlados quando não existem.
 */
export function leadsRoutes(app: Express) {
  // ------------------------------------------------------
  // GET /api/crm/leads — Listar leads (com filtros opcionais)
  // ------------------------------------------------------
  app.get("/api/crm/leads", async (req: Request, res: Response) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req as any);

      if (!empresaId || !userId || !userRole) {
        return res
          .status(400)
          .json({ message: "Contexto de utilizador/empresa em falta" });
      }

      const { entidadeId, contactoId, status, search } = req.query as {
        entidadeId?: string;
        contactoId?: string;
        status?: string;
        search?: string;
      };

      const s: any = storage as any;

      if (typeof s.getLeads !== "function") {
        console.warn(
          "[leadsRoutes] storage.getLeads não está implementado. A devolver lista vazia."
        );
        return res.json([]);
      }

      const leads = await s.getLeads({
        empresaId,
        userId,
        userRole,
        entidadeId: entidadeId || undefined,
        contactoId: contactoId || undefined,
        status: status || undefined,
        search: search || undefined,
      });

      return res.json(leads ?? []);
    } catch (error) {
      console.error("[leadsRoutes] Erro em GET /api/crm/leads:", error);
      return res.status(500).json({ message: "Failed to list leads" });
    }
  });

  // ------------------------------------------------------
  // GET /api/crm/leads/:id — Obter lead por ID
  // ------------------------------------------------------
  app.get("/api/crm/leads/:id", async (req: Request, res: Response) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req as any);

      if (!empresaId || !userId || !userRole) {
        return res
          .status(400)
          .json({ message: "Contexto de utilizador/empresa em falta" });
      }

      const s: any = storage as any;

      const getter =
        typeof s.getLeadById === "function"
          ? s.getLeadById
          : typeof s.getLead === "function"
          ? s.getLead
          : null;

      if (!getter) {
        console.warn(
          "[leadsRoutes] storage.getLead/getLeadById não implementado."
        );
        return res
          .status(501)
          .json({ message: "Leads backend ainda não implementado" });
      }

      const lead = await getter.call(s, req.params.id, {
        empresaId,
        userId,
        userRole,
      });

      if (!lead) {
        return res.status(404).json({ message: "Lead não encontrada" });
      }

      return res.json(lead);
    } catch (error) {
      console.error("[leadsRoutes] Erro em GET /api/crm/leads/:id:", error);
      return res.status(500).json({ message: "Failed to get lead" });
    }
  });

  // ------------------------------------------------------
  // POST /api/crm/leads — Criar lead
  // ------------------------------------------------------
  app.post("/api/crm/leads", async (req: Request, res: Response) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req as any);

      if (!empresaId || !userId || !userRole) {
        return res
          .status(400)
          .json({ message: "Contexto de utilizador/empresa em falta" });
      }

      const s: any = storage as any;

      const creator =
        typeof s.createLead === "function"
          ? s.createLead
          : typeof s.createCrmLead === "function"
          ? s.createCrmLead
          : null;

      if (!creator) {
        console.warn(
          "[leadsRoutes] storage.createLead/createCrmLead não implementado."
        );
        return res
          .status(501)
          .json({ message: "Criação de leads ainda não implementada" });
      }

      const payload = {
        ...req.body,
        empresaId,
        createdByUserId: userId,
        assignedUserId: req.body.assignedUserId || userId,
      };

      const lead = await creator.call(s, payload);

      return res.status(201).json(lead);
    } catch (error) {
      console.error("[leadsRoutes] Erro em POST /api/crm/leads:", error);
      return res.status(500).json({ message: "Failed to create lead" });
    }
  });

  // ------------------------------------------------------
  // PATCH /api/crm/leads/:id — Atualizar lead
  // ------------------------------------------------------
  app.patch("/api/crm/leads/:id", async (req: Request, res: Response) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req as any);

      if (!empresaId || !userId || !userRole) {
        return res
          .status(400)
          .json({ message: "Contexto de utilizador/empresa em falta" });
      }

      const s: any = storage as any;

      const updater =
        typeof s.updateLead === "function"
          ? s.updateLead
          : typeof s.updateCrmLead === "function"
          ? s.updateCrmLead
          : null;

      if (!updater) {
        console.warn(
          "[leadsRoutes] storage.updateLead/updateCrmLead não implementado."
        );
        return res
          .status(501)
          .json({ message: "Atualização de leads ainda não implementada" });
      }

      const updated = await updater.call(
        s,
        req.params.id,
        req.body,
        empresaId,
        userId,
        userRole
      );

      if (!updated) {
        return res.status(404).json({ message: "Lead não encontrada" });
      }

      return res.json(updated);
    } catch (error) {
      console.error("[leadsRoutes] Erro em PATCH /api/crm/leads/:id:", error);
      return res.status(500).json({ message: "Failed to update lead" });
    }
  });

  // ------------------------------------------------------
  // POST /api/crm/leads/:id/odoo/sync — Sincronizar lead com Odoo
  // (stub seguro por enquanto)
  // ------------------------------------------------------
  app.post(
    "/api/crm/leads/:id/odoo/sync",
    async (req: Request, res: Response) => {
      try {
        const { empresaId, userId, userRole } = await getUserContext(req as any);

        if (!empresaId || !userId || !userRole) {
          return res
            .status(400)
            .json({ message: "Contexto de utilizador/empresa em falta" });
        }

        const s: any = storage as any;

        const syncFn =
          typeof s.syncLeadWithOdoo === "function"
            ? s.syncLeadWithOdoo
            : null;

        if (!syncFn) {
          console.warn(
            "[leadsRoutes] storage.syncLeadWithOdoo não implementado. A devolver 501."
          );
          return res.status(501).json({
            message: "Sincronização de leads com Odoo ainda não implementada",
          });
        }

        const result = await syncFn.call(s, {
          leadId: req.params.id,
          empresaId,
          userId,
          userRole,
        });

        return res.json(result);
      } catch (error) {
        console.error(
          "[leadsRoutes] Erro em POST /api/crm/leads/:id/odoo/sync:",
          error
        );
        return res.status(500).json({ message: "Failed to sync lead with Odoo" });
      }
    }
  );

  // ------------------------------------------------------
  // GET /api/crm/leads/:id/odoo/attachments — Listar anexos (stub)
  // ------------------------------------------------------
  app.get(
    "/api/crm/leads/:id/odoo/attachments",
    async (req: Request, res: Response) => {
      try {
        const { empresaId, userId, userRole } = await getUserContext(req as any);

        if (!empresaId || !userId || !userRole) {
          return res
            .status(400)
            .json({ message: "Contexto de utilizador/empresa em falta" });
        }

        const s: any = storage as any;

        const getter =
          typeof s.getLeadOdooAttachments === "function"
            ? s.getLeadOdooAttachments
            : null;

        if (!getter) {
          console.warn(
            "[leadsRoutes] storage.getLeadOdooAttachments não implementado. A devolver []."
          );
          return res.json([]);
        }

        const attachments = await getter.call(s, {
          leadId: req.params.id,
          empresaId,
          userId,
          userRole,
        });

        return res.json(attachments ?? []);
      } catch (error) {
        console.error(
          "[leadsRoutes] Erro em GET /api/crm/leads/:id/odoo/attachments:",
          error
        );
        return res.status(500).json({ message: "Failed to list attachments" });
      }
    }
  );

  // ------------------------------------------------------
  // POST /api/crm/leads/:id/odoo/attachments — Criar anexo (stub)
  // ------------------------------------------------------
  app.post(
    "/api/crm/leads/:id/odoo/attachments",
    async (req: Request, res: Response) => {
      try {
        const { empresaId, userId, userRole } = await getUserContext(req as any);

        if (!empresaId || !userId || !userRole) {
          return res
            .status(400)
            .json({ message: "Contexto de utilizador/empresa em falta" });
        }

        const s: any = storage as any;

        const creator =
          typeof s.createLeadOdooAttachment === "function"
            ? s.createLeadOdooAttachment
            : null;

        if (!creator) {
          console.warn(
            "[leadsRoutes] storage.createLeadOdooAttachment não implementado. A devolver 501."
          );
          return res.status(501).json({
            message: "Gestão de anexos de leads ainda não implementada",
          });
        }

        const attachment = await creator.call(s, {
          leadId: req.params.id,
          empresaId,
          userId,
          userRole,
          ...req.body,
        });

        return res.status(201).json(attachment);
      } catch (error) {
        console.error(
          "[leadsRoutes] Erro em POST /api/crm/leads/:id/odoo/attachments:",
          error
        );
        return res.status(500).json({ message: "Failed to create attachment" });
      }
    }
  );
}
