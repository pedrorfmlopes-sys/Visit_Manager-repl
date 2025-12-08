import express from "express";
import { storage } from "../../storage";
import { listContactosForUser } from "../../auth/rbac";

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
      const { empresaId } = await getUserContext(req);

      const newContacto = await storage.createContacto(
        { ...req.body },
        empresaId
      );

      res.json(newContacto);
    } catch (error) {
      console.error("Error creating contacto:", error);
      res.status(400).json({ message: "Failed to create contacto" });
    }
  });

  app.patch("/api/contactos/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      const updated = await storage.updateContacto(
        req.params.id,
        req.body,
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

      await storage.deleteContacto(
        req.params.id,
        empresaId,
        userId,
        userRole
      );

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
