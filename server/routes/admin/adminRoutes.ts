import express from "express";
import multer from "multer";
import fs from "fs";
import { subDays } from "date-fns";
import { storage } from "../../storage";

// Upload handler (ficheiros para logo da empresa)
const uploadsDir = "/tmp/uploads";
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({ dest: uploadsDir });

// ----------------------------------------
// Helpers de autenticação / contexto
// ----------------------------------------
const requireAdmin = (req: any, res: any, next: any) => {
  const user = req.session?.user;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};

async function getUserContext(req: any) {
  return {
    userId: req.session?.user?.id || null,
    userRole: req.session?.user?.role || null,
    empresaId: req.session?.user?.empresaId || null,
    empresa: req.session?.user?.empresa || null,
  };
}

export function adminRoutes(app: express.Express) {
  // ============================================================
  // GET /api/admin/empresa — Configuração da empresa (Admin)
  // ============================================================
  app.get("/api/admin/empresa", requireAdmin, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      const empresa = await storage.getEmpresa(empresaId);

      if (!empresa) {
        return res
          .status(404)
          .json({ message: "Empresa não encontrada" });
      }

      const empresaAny = empresa as any;
      const baseUi = (empresaAny.uiSettings ?? {}) as any;
      const baseIa = (baseUi.ia ?? {}) as any;

      const response: any = {
        ...empresa,
        odooCrmEnabled: empresa.odooCrmEnabled ?? true,
        crmLeadsEnabled: empresa.crmLeadsEnabled ?? false,
        odooContactsFeatureEnabled:
          empresaAny.odooContactsFeatureEnabled ?? false,
        odooContactsAdminEnabled:
          empresaAny.odooContactsAdminEnabled ?? true,
        odooContactsAgentsEnabled:
          empresaAny.odooContactsAgentsEnabled ?? false,
        odooContactsNoPermissionMessage:
          empresaAny.odooContactsNoPermissionMessage ?? null,
        crmVisitsOdooSyncEnabled:
          empresaAny.crmVisitsOdooSyncEnabled ?? false,
        uiSettings: {
          ...baseUi,
          ia: {
            ...baseIa,
            hasOwnOpenAIApiKey: !!empresaAny.openai_api_key,
          },
        },
      };

      delete response.openai_api_key;
      res.json(response);
    } catch (error) {
      res.status(500).json({ message: "Erro ao carregar empresa" });
    }
  });

  // ============================================================
  // PATCH /api/admin/empresa — Atualizar empresa
  // ============================================================
  app.patch("/api/admin/empresa", requireAdmin, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);

      const {
        nome,
        nif,
        email,
        telefone,
        logoUrl,
        mostrarGPS,
        mostrarMarcasEmVisitas,
        theme,
        uiSettings,
        iaOpenAIApiKey,
        odooCrmEnabled,
        crmLeadsEnabled,
        odooContactsFeatureEnabled,
        odooContactsAdminEnabled,
        odooContactsAgentsEnabled,
        odooContactsNoPermissionMessage,
        crmVisitsOdooSyncEnabled,
      } = req.body;

      const update: any = {};
      if (nome !== undefined) update.nome = nome;
      if (nif !== undefined) update.nif = nif;
      if (email !== undefined) update.email = email;
      if (telefone !== undefined) update.telefone = telefone;
      if (logoUrl !== undefined) update.logoUrl = logoUrl;
      if (mostrarGPS !== undefined) update.mostrarGPS = mostrarGPS;
      if (mostrarMarcasEmVisitas !== undefined)
        update.mostrarMarcasEmVisitas = mostrarMarcasEmVisitas;
      if (theme !== undefined) update.theme = theme;
      if (uiSettings !== undefined) update.uiSettings = uiSettings;

      if (typeof odooCrmEnabled === "boolean")
        update.odooCrmEnabled = odooCrmEnabled;
      if (typeof crmLeadsEnabled === "boolean")
        update.crmLeadsEnabled = crmLeadsEnabled;

      if (typeof odooContactsFeatureEnabled === "boolean")
        update.odooContactsFeatureEnabled = odooContactsFeatureEnabled;
      if (typeof odooContactsAdminEnabled === "boolean")
        update.odooContactsAdminEnabled = odooContactsAdminEnabled;
      if (typeof odooContactsAgentsEnabled === "boolean")
        update.odooContactsAgentsEnabled = odooContactsAgentsEnabled;
      if (typeof odooContactsNoPermissionMessage === "string")
        update.odooContactsNoPermissionMessage =
          odooContactsNoPermissionMessage;

      if (typeof crmVisitsOdooSyncEnabled === "boolean")
        update.crmVisitsOdooSyncEnabled = crmVisitsOdooSyncEnabled;

      // IA — gestão da chave OpenAI
      if (iaOpenAIApiKey !== undefined) {
        update.openai_api_key = iaOpenAIApiKey?.trim() || null;
      }

      const updated: any = await storage.updateEmpresa(empresaId, update);

      if (updated) {
        delete updated.openai_api_key;
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar empresa" });
    }
  });

  // ============================================================
  // POST /api/admin/empresa/logo — Upload de logotipo
  // ============================================================
  app.post(
    "/api/admin/empresa/logo",
    requireAdmin,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const { empresaId } = await getUserContext(req);

        if (!req.file) {
          return res
            .status(400)
            .json({ message: "Nenhum ficheiro enviado" });
        }

        const allowed = [
          "image/png",
          "image/jpeg",
          "image/svg+xml",
          "image/webp",
        ];
        if (!allowed.includes(req.file.mimetype)) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: "Formato inválido" });
        }

        const url = `/uploads/${req.file.filename}`;
        await storage.updateEmpresa(empresaId, { logoUrl: url });

        res.json({ logoUrl: url });
      } catch (error) {
        res.status(500).json({ message: "Erro ao carregar logo" });
      }
    }
  );

  // ============================================================
  // ADMIN — UTILIZADORES
  // ============================================================

  app.get("/api/admin/utilizadores", requireAdmin, async (req: any, res) => {
    const { empresaId } = await getUserContext(req);
    const users = await storage.getUtilizadoresByEmpresa(empresaId);
    res.json(users);
  });

  app.post("/api/admin/utilizadores", requireAdmin, async (req: any, res) => {
    const { empresaId } = await getUserContext(req);
    const { email, firstName, lastName, role } = req.body;

    const newUser = await storage.createUtilizador({
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      role: role || "agent",
      empresaId,
      ativo: true,
    });

    res.json(newUser);
  });

  app.patch(
    "/api/admin/utilizadores/:id",
    requireAdmin,
    async (req: any, res) => {
      const { empresaId } = await getUserContext(req);

      const update = {
        role: req.body.role,
        ativo: req.body.ativo,
      };

      const u = await storage.updateUtilizador(
        req.params.id,
        update,
        empresaId
      );

      if (!u) {
        return res
          .status(404)
          .json({ message: "Utilizador não encontrado" });
      }

      res.json(u);
    }
  );

  // ============================================================
  // ADMIN — ENTIDADES & TIPOS
  // ============================================================

  app.get("/api/admin/entidades", requireAdmin, async (req: any, res) => {
    const { empresaId, userId } = await getUserContext(req);
    const entidades = await storage.getEntidades(empresaId, userId, "admin");
    res.json(entidades);
  });

  // TIPOS
  app.get(
    "/api/admin/entidade-tipos",
    requireAdmin,
    async (req: any, res) => {
      const { empresaId } = await getUserContext(req);
      res.json(await storage.getEntidadeTipos(empresaId));
    }
  );

  app.post(
    "/api/admin/entidade-tipos",
    requireAdmin,
    async (req: any, res) => {
      const { empresaId } = await getUserContext(req);
      res.json(await storage.createEntidadeTipo(req.body, empresaId));
    }
  );

  app.patch(
    "/api/admin/entidade-tipos/:id",
    requireAdmin,
    async (req: any, res) => {
      const { empresaId } = await getUserContext(req);
      const updated = await storage.updateEntidadeTipo(
        req.params.id,
        req.body,
        empresaId
      );

      if (!updated) {
        return res
          .status(404)
          .json({ message: "Tipo de entidade não encontrado" });
      }
      res.json(updated);
    }
  );

  // MIGRAÇÃO de Tipos
  app.post(
    "/api/admin/entidades/migrar-tipos",
    requireAdmin,
    async (_req: any, res) => {
      const result = await storage.migrateEntidadeTipos();
      res.json({ message: "Migração concluída", ...result });
    }
  );

  // ============================================================
  // ADMIN DEBUG ENDPOINT
  // ============================================================

  app.get("/api/admin/debug", requireAdmin, async (req: any, res) => {
    const { empresaId, userId } = await getUserContext(req);

    const users = await storage.getUtilizadoresByEmpresa(empresaId);
    const entidades = await storage.getEntidades(empresaId, userId, "admin");
    const contactos = await storage.getContactos({ empresaId });
    const visitas = await storage.getVisitas(empresaId, userId, "admin");
    const tarefas = await storage.getTarefas(empresaId, userId, "admin");

    const visitasLast30 = visitas.filter(
      (v: any) =>
        new Date(v.dataVisita) >= subDays(new Date(), 30)
    ).length;

    const tarefasAtraso = tarefas.filter(
      (t: any) =>
        t.status === "pending" &&
        t.dueDate &&
        new Date(t.dueDate) < new Date()
    ).length;

    res.json({
      timestamp: new Date().toISOString(),
      stats: {
        users: users.length,
        entidades: entidades.length,
        contactos: contactos.length,
        visitas: visitas.length,
        visitasLast30,
        tarefas: tarefas.length,
        tarefasAtraso,
      },
    });
  });
}
