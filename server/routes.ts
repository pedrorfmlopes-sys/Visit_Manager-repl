// server/routes.ts
import express, { type Express, type Router } from "express";
import { createServer } from "http";

// -------- Auth --------
import { authRoutes } from "./routes/authRoutes";

// -------- CRM --------
import { registerEntidadesRoutes } from "./routes/crm/entidadesRoutes";
import { contactosRoutes } from "./routes/crm/contactosRoutes";
import { visitasRoutes } from "./routes/crm/visitasRoutes";
import { tarefasRoutes } from "./routes/crm/tarefasRoutes";
import { dashboardRoutes } from "./routes/crm/dashboardRoutes";
import { marcasCrmRoutes } from "./routes/crm/marcasRoutes";
import { leadsAiRoutes } from "./routes/crm/leadsAiRoutes";
import { leadsRoutes } from "./routes/crm/leadsRoutes";
import { registerCrmLeadsRoutes } from "./routes/crmLeads";


// -------- Admin --------
import { adminRoutes } from "./routes/admin/adminRoutes";
import { marcasRoutes } from "./routes/admin/marcasRoutes";

// -------- Odoo (Router) --------
import odooContactRequestsRoutes from "./routes/odoo/odooContactRequestsRoutes";

// -------- Uploads (Router) --------
import uploadsRoutes from "./routes/uploadsRoutes";

// -------- PDF / SEARCH / AI (Routers) --------
import pdfRoutes from "./routes/pdf/pdfRoutes";
import searchRoutes from "./routes/search/searchRoutes";
import aiRoutes from "./routes/ai/aiRoutes";

// -------- Misc (Routers) --------
import { proximityRouter } from "./routes/misc/proximityRoutes";
import { userSettingsRouter } from "./routes/misc/userSettingsRoutes";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function registerModule(
  name: string,
  fn: (app: Express) => unknown,
  app: Express,
) {
  console.log(`[routes] ▶ registar módulo "${name}"`);
  fn(app);
}

function isRouter(obj: any): obj is Router {
  return obj && typeof obj === "function" && "use" in obj && "handle" in obj;
}

function mountRouter(
  app: Express,
  basePath: string,
  router: any,
  name: string,
) {
  if (!isRouter(router)) {
    console.warn(
      `[routes] ⚠ "${name}" não é um Router Express válido (tipo: ${typeof router})`,
    );
    return;
  }
  console.log(`[routes] ▶ montar Router "${name}" em ${basePath}`);
  app.use(basePath, router);
}

// --------------------------------------------------
// Registo principal de rotas
// --------------------------------------------------

export default async function registerRoutes(app: Express) {
  console.log("[routes] ▶ iniciar registo de rotas");

  // Auth
  registerModule("authRoutes", authRoutes, app);

  // CRM
  registerModule("registerEntidadesRoutes", registerEntidadesRoutes, app);
  registerModule("contactosRoutes", contactosRoutes, app);
  registerModule("visitasRoutes", visitasRoutes, app);
  registerModule("tarefasRoutes", tarefasRoutes, app);
  registerModule("dashboardRoutes", dashboardRoutes, app); 
  registerModule("marcasCrmRoutes", marcasCrmRoutes, app);
  registerModule("leadsAiRoutes", leadsAiRoutes, app);
  registerModule("leadsRoutes", leadsRoutes, app);
  registerModule("registerCrmLeadsRoutes", registerCrmLeadsRoutes, app);

  // Admin
  registerModule("adminRoutes", adminRoutes, app);
  registerModule("marcasRoutes", marcasRoutes, app);

  // Routers montados com prefixos /api/...
  mountRouter(
    app,
    "/api/odoo/contact-requests",
    odooContactRequestsRoutes,
    "odooContactRequestsRoutes",
  );
  mountRouter(app, "/api/uploads", uploadsRoutes, "uploadsRoutes");
  mountRouter(app, "/api/pdf", pdfRoutes, "pdfRoutes");
  mountRouter(app, "/api/search", searchRoutes, "searchRoutes");
  mountRouter(app, "/api/ai", aiRoutes, "aiRoutes");
  mountRouter(app, "/api/misc", proximityRouter, "proximityRouter");
  mountRouter(app, "/api/misc", userSettingsRouter, "userSettingsRouter");

  console.log("[routes] ✅ rotas registadas, a criar HTTP server...");

  const httpServer = createServer(app);
  return httpServer;
}
