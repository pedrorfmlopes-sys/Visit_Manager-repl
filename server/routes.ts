// server/routes.ts
import express, { type Express, type Router as ExpressRouter } from "express";
import { createServer } from "http";

// -------- Auth (FUNÇÃO que recebe app) --------
import { authRoutes } from "./routes/authRoutes";

// -------- CRM (FUNÇÕES que recebem app) --------
import { registerEntidadesRoutes } from "./routes/crm/entidadesRoutes";
import { contactosRoutes } from "./routes/crm/contactosRoutes";
import { visitasRoutes } from "./routes/crm/visitasRoutes";
import { tarefasRoutes } from "./routes/crm/tarefasRoutes";

// -------- Admin (FUNÇÕES que recebem app) --------
import { adminRoutes } from "./routes/admin/adminRoutes";
import { marcasRoutes } from "./routes/admin/marcasRoutes";

// -------- Odoo (ROUTER) --------
import odooContactRequestsRoutes from "./routes/odoo/odooContactRequestsRoutes";

// -------- PDF / Search / AI (ROUTERS) --------
import pdfRoutes from "./routes/pdf/pdfRoutes";
import searchRoutes from "./routes/search/searchRoutes";
import aiRoutes from "./routes/ai/aiRoutes";

// -------- Misc (ROUTERS) --------
import { proximityRouter } from "./routes/misc/proximityRoutes";
import { userSettingsRouter } from "./routes/misc/userSettingsRoutes";

// -------- Uploads (ROUTER) --------
import uploadsRoutes from "./routes/uploadsRoutes";

// ----------------------------------------------------
// Helpers para montar Routers em segurança
// ----------------------------------------------------
function isRouter(obj: any): obj is ExpressRouter {
  return (
    obj &&
    typeof obj === "function" &&
    typeof obj.use === "function" &&
    typeof obj.handle === "function"
  );
}

function mountRouter(
  app: Express | ExpressRouter,
  basePath: string,
  router: any,
  name: string,
) {
  if (isRouter(router)) {
    console.log(`[routes] ▶ montar Router "${name}" em ${basePath}`);
    app.use(basePath, router);
  } else {
    console.warn(
      `[routes] ⚠ "${name}" não é um Router Express válido (typeof: ${typeof router}) — a ignorar para evitar crash.`,
    );
  }
}

// ----------------------------------------------------
// Registo principal de rotas
// ----------------------------------------------------
export default async function registerRoutes(app: Express) {
  console.log("[routes] ▶ iniciar registo de rotas");

  // -------- AUTH (FUNÇÃO) --------
  // authRoutes exporta: export function authRoutes(app: Express)
  authRoutes(app);

  // -------- CRM (FUNÇÕES) --------
  registerEntidadesRoutes(app);
  contactosRoutes(app);
  visitasRoutes(app);
  tarefasRoutes(app);

  // -------- ADMIN (FUNÇÕES) --------
  adminRoutes(app);
  marcasRoutes(app);

  // -------- Sub-Router /api para Odoo + Uploads --------
  const api = express.Router();

  // /api/odoo/contact-requests/* (ROUTER)
  mountRouter(api, "/odoo/contact-requests", odooContactRequestsRoutes, "odooContactRequestsRoutes");

  // /api/uploads/* (ROUTER)
  mountRouter(api, "/uploads", uploadsRoutes, "uploadsRoutes");

  // Montar subrouter principal
  app.use("/api", api);

  // -------- PDF / Search / AI (ROUTERS) --------
  // Estes exportam Router, então montamos com app.use
  mountRouter(app, "/api/pdf", pdfRoutes, "pdfRoutes");
  mountRouter(app, "/api/search", searchRoutes, "searchRoutes");
  mountRouter(app, "/api/ai", aiRoutes, "aiRoutes");

  // -------- MISC (ROUTERS) --------
  mountRouter(app, "/api/misc", proximityRouter, "proximityRouter");
  mountRouter(app, "/api/misc", userSettingsRouter, "userSettingsRouter");

  console.log("[routes] ✅ rotas registadas, a criar HTTP server...");

  const httpServer = createServer(app);
  return httpServer;
}
