// server/routes/misc/userSettingsRoutes.ts
import { Router } from "express";
import { requireUserContext } from "../../auth/rbac";
import { storage } from "../../storage";

export const userSettingsRouter = Router();

/**
 * GET /api/user/settings
 * FASE 24 — Obter definições do utilizador
 */
userSettingsRouter.get("/user/settings", async (req: any, res) => {
  try {
    const { userId, empresaId } = await requireUserContext(req);

    const user = await storage.getUserSettings(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const empresa = await storage.getEmpresa(empresaId);

    const userSettings =
      typeof user.userSettings === "string"
        ? JSON.parse(user.userSettings)
        : user.userSettings || {};

    res.json({
      id: user.id,
      nome: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      email: user.email,
      role: user.role,
      empresaNome: empresa?.nome || "",
      userSettings,
    });
  } catch (error) {
    console.error("Error fetching user settings:", error);
    const status = (error as any)?.status ?? 500;
    res.status(status).json({ message: "Failed to fetch user settings" });
  }
});

/**
 * PATCH /api/user/settings
 * FASE 24 — Atualizar definições do utilizador
 */
userSettingsRouter.patch("/user/settings", async (req: any, res) => {
  try {
    const { userId, empresaId } = await requireUserContext(req);
    const updates = req.body;

    const user = await storage.getUserSettings(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentSettings =
      typeof user.userSettings === "string"
        ? JSON.parse(user.userSettings)
        : user.userSettings || {};

    let newSettings: any = {};

    if (updates.userSettings) {
      // Merge completo vindo de userSettings
      newSettings = { ...currentSettings, ...updates.userSettings };
    } else {
      // Atualização granular
      newSettings = { ...currentSettings };
      if (updates.homePage) newSettings.homePage = updates.homePage;
      if (updates.listDensity) newSettings.listDensity = updates.listDensity;
      if (updates.ia) {
        newSettings.ia = { ...(newSettings.ia || {}), ...updates.ia };
      }
      if (updates.notifications) {
        newSettings.notifications = {
          ...(newSettings.notifications || {}),
          ...updates.notifications,
        };
      }
    }

    const updated = await storage.updateUserSettings(userId, newSettings);
    if (!updated) {
      return res.status(500).json({ message: "Failed to update settings" });
    }

    const empresa = await storage.getEmpresa(empresaId);

    res.json({
      id: updated.id,
      nome: `${updated.firstName || ""} ${updated.lastName || ""}`.trim(),
      email: updated.email,
      role: updated.role,
      empresaNome: empresa?.nome || "",
      userSettings: newSettings,
    });
  } catch (error) {
    console.error("Error updating user settings:", error);
    const status = (error as any)?.status ?? 500;
    res.status(status).json({ message: "Failed to update user settings" });
  }
});
