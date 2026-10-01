import express from "express";
import { storage } from "../../storage";
import { listContactosForUser } from "../../auth/rbac";
import { assertTenantReferences } from "../../tenantValidation";
import {
  contactDuplicateMessage,
  createContactoIfUnique,
  findDuplicateContacto,
} from "../../contactDeduplication";
import {
  deleteContactSafely,
  groupDuplicateContacts,
  mergeContacts,
} from "../../contactManagement";
import { db } from "../../db";
import { contactos as contactosTable } from "@shared/schema";
import { eq } from "drizzle-orm";

export function contactosRoutes(app: express.Express) {
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next();
  };

  async function getUserContext(req: any) {
    return {
      userId: req.session?.user?.id || null,
      role: req.session?.user?.role || null,
      userRole: req.session?.user?.role || null,
      empresaId: req.session?.user?.empresaId || null,
      empresa: req.session?.user?.empresa || null,
    };
  }

  app.get("/api/contactos", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      const contactos = await listContactosForUser({
        empresaId,
        userId,
        userRole,
      });

      res.json(contactos);
    } catch (error) {
      console.error("Error fetching contactos:", error);
      res.status(500).json({ message: "Failed to fetch contactos" });
    }
  });

  app.get("/api/contactos-duplicates", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userRole } = await getUserContext(req);
      if (userRole !== "admin") {
        return res.status(403).json({ message: "Apenas administradores podem gerir duplicados." });
      }
      const companyContacts = await db
        .select()
        .from(contactosTable)
        .where(eq(contactosTable.empresaId, empresaId));
      res.json({ groups: groupDuplicateContacts(companyContacts) });
    } catch (error) {
      console.error("Error finding duplicate contacts:", error);
      res.status(500).json({ message: "Não foi possível procurar duplicados." });
    }
  });

  app.post("/api/contactos-merge", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userRole } = await getUserContext(req);
      if (userRole !== "admin") {
        return res.status(403).json({ message: "Apenas administradores podem unir contactos." });
      }
      const primaryId = String(req.body?.primaryId ?? "");
      const duplicateIds = Array.isArray(req.body?.duplicateIds)
        ? req.body.duplicateIds.map(String)
        : [];
      const contacto = await mergeContacts(primaryId, duplicateIds, empresaId);
      res.json({ success: true, contacto });
    } catch (error: any) {
      console.error("Error merging contacts:", error);
      res.status(400).json({ message: error?.message ?? "Não foi possível unir os contactos." });
    }
  });

  app.get("/api/contactos/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);
      const { id } = req.params;

      const contacto = await storage.getContacto(id, empresaId, userId, userRole);
      if (!contacto) return res.status(404).json({ message: "Contacto not found" });

      res.json(contacto);
    } catch (error) {
      console.error("Error fetching contacto:", error);
      res.status(500).json({ message: "Failed to fetch contacto" });
    }
  });

  app.post("/api/contactos", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId } = await getUserContext(req);
      await assertTenantReferences(empresaId, {
        entidadeId: req.body.entidadeId,
        assignedUserId: req.body.assignedUserId,
      });

      const result = await createContactoIfUnique(
        {
          ...req.body,
          empresaId: undefined,
          createdByUserId: userId,
        },
        empresaId,
      );

      if (!result.created) {
        return res.status(409).json({
          code: "CONTACT_DUPLICATE",
          message: contactDuplicateMessage(result),
          matchedBy: result.matchedBy,
          existingContact: {
            id: result.contacto.id,
            nome: result.contacto.nome,
          },
        });
      }

      res.status(201).json(result.contacto);
    } catch (error) {
      console.error("Error creating contacto:", error);
      res.status(400).json({ message: "Failed to create contacto" });
    }
  });

  app.patch("/api/contactos/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);
      await assertTenantReferences(empresaId, {
        entidadeId: req.body.entidadeId,
        assignedUserId: req.body.assignedUserId,
      });
      const updates = { ...req.body };
      delete updates.id;
      delete updates.empresaId;
      delete updates.createdByUserId;

      const duplicate = await findDuplicateContacto({
        empresaId,
        email: updates.email,
        telemovel: updates.telemovel,
        odooPartnerId: updates.odooPartnerId,
        excludeId: req.params.id,
      });
      if (duplicate) {
        return res.status(409).json({
          code: "CONTACT_DUPLICATE",
          message: contactDuplicateMessage(duplicate),
          matchedBy: duplicate.matchedBy,
          existingContact: {
            id: duplicate.contacto.id,
            nome: duplicate.contacto.nome,
          },
        });
      }

      const updated = await storage.updateContacto(
        req.params.id,
        updates,
        empresaId,
        userId,
        userRole
      );

      if (!updated) {
        return res.status(404).json({ message: "Contacto not found or unauthorized" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating contacto:", error);
      res.status(400).json({ message: "Failed to update contacto" });
    }
  });

  app.delete("/api/contactos/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      const deleted = await deleteContactSafely(
        req.params.id,
        empresaId,
        userId,
        userRole
      );
      if (!deleted) {
        return res.status(404).json({ message: "Contacto não encontrado ou sem permissão." });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contacto:", error);
      res.status(500).json({ message: "Failed to delete contacto" });
    }
  });

  app.get("/api/crm/contactos/search", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      const q = (req.query.q as string || "").toLowerCase();
      const entidadeId = req.query.entidadeId as string | undefined;

      const contactos = await listContactosForUser({
        empresaId,
        userId,
        userRole,
        entidadeId,
      });

      const results = contactos
        .filter((c: any) => c.nome.toLowerCase().includes(q))
        .slice(0, 20)
        .map((c: any) => ({
          id: c.id,
          label: c.nome,
          extraInfo: c.entidade?.nome || c.email || undefined,
          data: {
            entidadeNome: c.entidade?.nome,
            email: c.email,
          },
        }));

      res.json(results);
    } catch (error) {
      console.error("Error searching contactos:", error);
      res.status(500).json({ message: "Failed to search contactos" });
    }
  });
}
