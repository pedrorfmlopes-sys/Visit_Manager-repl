import express from "express";
import multer from "multer";
import fs from "fs";
import { getUserContext, requireAdmin } from "../../authContext";
import { storage } from "../../storage";
import {
  isSupportedUploadedFile,
  removeUploadByUrl,
  uploadsDir,
} from "../../uploads";
import { encryptSecret } from "../../secretCrypto";
import { getEmpresaLicensedModules } from "@shared/modules";
import { resolveEntityResearchSettings } from "@shared/entityResearch";

const router = express.Router();

// ========= MULTER CONFIG =========
const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

// =========================================================
// GET /api/admin/empresa — obter dados da empresa
// =========================================================
router.get("/", requireAdmin, async (req: any, res) => {
  try {
    const { empresaId } = await getUserContext(req);
    if (!empresaId)
      return res.status(400).json({ message: "User has no company assigned" });

    const empresa = await storage.getEmpresa(empresaId);
    if (!empresa) return res.status(404).json({ message: "Empresa not found" });

    const empresaAny = empresa as any;
    const baseUi = (empresaAny.uiSettings ?? {}) as any;
    const baseIa = (baseUi.ia ?? { aiEnabled: true, aiKeyMode: "global" }) as any;

    const response = {
      ...empresa,
      odooCrmEnabled: empresa.odooCrmEnabled ?? true,
      crmLeadsEnabled: empresa.crmLeadsEnabled ?? false,

      // NOVAS FLAGS ODOO CONTACT REQUESTS
      odooContactsFeatureEnabled: empresaAny.odooContactsFeatureEnabled ?? false,
      odooContactsAdminEnabled: empresaAny.odooContactsAdminEnabled ?? true,
      odooContactsAgentsEnabled: empresaAny.odooContactsAgentsEnabled ?? false,
      odooContactsNoPermissionMessage: empresaAny.odooContactsNoPermissionMessage ?? null,
      crmVisitsOdooSyncEnabled: empresaAny.crmVisitsOdooSyncEnabled ?? false,

      uiSettings: {
        ...baseUi,
        ia: {
          ...baseIa,
          hasOwnOpenAIApiKey: !!empresaAny.openai_api_key,
        },
      },
    };

    const { openai_api_key, ...safeResponse } = response as any;
    res.json(safeResponse);
  } catch (error) {
    console.error("[admin/empresaRoutes] GET error:", error);
    res.status(500).json({ message: "Failed to fetch empresa" });
  }
});

// =========================================================
// POST /api/admin/empresa/logo — upload de LOGO
// =========================================================
router.post("/logo", requireAdmin, upload.single("file"), async (req: any, res) => {
  try {
    const { empresaId } = await getUserContext(req);
    if (!empresaId)
      return res.status(400).json({ message: "User has no company assigned" });

    if (!req.file)
      return res.status(400).json({ message: "No file provided" });

    const currentCompany = await storage.getEmpresa(empresaId);
    if (!currentCompany) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "Empresa not found" });
    }

    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (
      !allowed.includes(req.file.mimetype) ||
      !(await isSupportedUploadedFile(req.file.path, "logo"))
    ) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Invalid file type" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const updated = await storage.updateEmpresa(empresaId, { logoUrl: fileUrl });

    if (!updated) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "Empresa not found" });
    }

    if (currentCompany.logoUrl && currentCompany.logoUrl !== fileUrl) {
      await removeUploadByUrl(currentCompany.logoUrl).catch((error) => {
        console.error("[admin/empresaRoutes] Failed to remove old logo:", error);
      });
    }

    res.json({ logoUrl: fileUrl });
  } catch (error) {
    console.error("[admin/empresaRoutes] UPLOAD error:", error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: "Failed to upload logo" });
  }
});

// =========================================================
// PATCH /api/admin/empresa — update configs da empresa
// =========================================================
router.patch("/", requireAdmin, async (req: any, res) => {
  try {
    const { empresaId } = await getUserContext(req);
    if (!empresaId)
      return res.status(400).json({ message: "User has no company assigned" });

    const currentCompany = await storage.getEmpresa(empresaId);
    if (!currentCompany) {
      return res.status(404).json({ message: "Empresa not found" });
    }
    const licensedModules = getEmpresaLicensedModules(currentCompany);

    const {
      nome,
      nif,
      email,
      telefone,
      logoUrl,
      mostrarMarcasEmVisitas,
      mostrarGPS,
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

    if (theme !== undefined && !["light-business", "dark-pro"].includes(theme)) {
      return res.status(400).json({ message: "Invalid theme" });
    }
    const requestedLicensedFeatures = [
      [crmLeadsEnabled, "leads"],
      [odooCrmEnabled, "odoo"],
      [odooContactsFeatureEnabled, "odoo_contacts"],
      [crmVisitsOdooSyncEnabled, "odoo_visits_sync"],
      [uiSettings?.ia?.aiEnabled, "ai"],
    ] as const;
    const unavailable = requestedLicensedFeatures.find(
      ([enabled, moduleId]) => enabled === true && !licensedModules.has(moduleId),
    );
    if (unavailable) {
      return res.status(403).json({
        message: "Este módulo não está incluído na licença da empresa.",
        moduleId: unavailable[1],
      });
    }

    const updateData: any = {};
    if (nome !== undefined) updateData.nome = nome;
    if (nif !== undefined) updateData.nif = nif;
    if (email !== undefined) updateData.email = email;
    if (telefone !== undefined) updateData.telefone = telefone;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (mostrarMarcasEmVisitas !== undefined)
      updateData.mostrarMarcasEmVisitas = mostrarMarcasEmVisitas;
    if (mostrarGPS !== undefined) updateData.mostrarGPS = mostrarGPS;
    if (theme !== undefined) updateData.theme = theme;
    if (uiSettings !== undefined) {
      updateData.uiSettings = {
        ...uiSettings,
        entityResearch: resolveEntityResearchSettings(uiSettings),
      };
    }

    // FLAGS CRM / CONTACT REQUESTS
    if (typeof odooCrmEnabled === "boolean") updateData.odooCrmEnabled = odooCrmEnabled;
    if (typeof crmLeadsEnabled === "boolean") updateData.crmLeadsEnabled = crmLeadsEnabled;
    if (typeof odooContactsFeatureEnabled === "boolean")
      updateData.odooContactsFeatureEnabled = odooContactsFeatureEnabled;
    if (typeof odooContactsAdminEnabled === "boolean")
      updateData.odooContactsAdminEnabled = odooContactsAdminEnabled;
    if (typeof odooContactsAgentsEnabled === "boolean")
      updateData.odooContactsAgentsEnabled = odooContactsAgentsEnabled;
    if (typeof odooContactsNoPermissionMessage === "string")
      updateData.odooContactsNoPermissionMessage = odooContactsNoPermissionMessage;
    if (typeof crmVisitsOdooSyncEnabled === "boolean")
      updateData.crmVisitsOdooSyncEnabled = crmVisitsOdooSyncEnabled;

    // ===== OPENAI API KEY MANAGEMENT =====
    if (iaOpenAIApiKey !== undefined) {
      if (iaOpenAIApiKey && iaOpenAIApiKey.trim()) {
        updateData.openai_api_key = encryptSecret(iaOpenAIApiKey.trim());
      } else {
        updateData.openai_api_key = null;
      }
    }

    const updated = await storage.updateEmpresa(empresaId, updateData);
    if (!updated) return res.status(404).json({ message: "Empresa not found" });

    if (
      logoUrl !== undefined &&
      currentCompany.logoUrl &&
      currentCompany.logoUrl !== logoUrl
    ) {
      await removeUploadByUrl(currentCompany.logoUrl).catch((error) => {
        console.error("[admin/empresaRoutes] Failed to remove old logo:", error);
      });
    }

    const updatedAny = updated as any;
    const baseUi = (updatedAny.uiSettings ?? {}) as any;
    const baseIa = (baseUi.ia ?? { aiEnabled: true, aiKeyMode: "global" }) as any;

    const safeResponse: any = {
      ...updatedAny,
      uiSettings: {
        ...baseUi,
        ia: {
          ...baseIa,
          hasOwnOpenAIApiKey: !!updatedAny.openai_api_key,
        },
      },
    };

    delete safeResponse.openai_api_key;

    res.json(safeResponse);
  } catch (error) {
    console.error("[admin/empresaRoutes] PATCH error:", error);
    res.status(500).json({ message: "Failed to update empresa" });
  }
});

export default router;
