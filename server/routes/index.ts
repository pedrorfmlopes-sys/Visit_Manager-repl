// server/routes/index.ts
import express from "express";
import { createServer } from "http";

// -------- IMPORTAR TODOS OS ROUTERS / FUNÇÕES DE ROTAS --------

// CRM (estes módulos exportam funções nomeadas que recebem `app`)
import { entidadesRoutes } from "./crm/entidadesRoutes";
import { contactosRoutes } from "./crm/contactosRoutes";
import { visitasRoutes } from "./crm/visitasRoutes";
import { tarefasRoutes } from "./crm/tarefasRoutes";

// Admin (funções que recebem `app`)
import { adminRoutes } from "./admin/adminRoutes";
import { marcasRoutes } from "./admin/marcasRoutes";

// Odoo CRM Contact Requests (router por defeito)
import odooContactRequestsRoutes from "./odoo/odooContactRequestsRoutes";

// PDF (router por defeito)
import pdfRouter from "./pdf/pdfRoutes";

// Search (router por defeito)
import searchRouter from "./search/searchRoutes";

// Misc (routers com export nomeado)
import { proximityRouter } from "./misc/proximityRoutes";
import { userSettingsRouter } from "./misc/userSettingsRoutes";

// Uploads (router por defeito)
import uploadsRoutes from "./uploadsRoutes";

// AI (router por defeito)
import aiRouter from "./ai/aiRoutes";

// =====================================================
//   REGISTO PRINCIPAL DAS ROTAS
// =====================================================

export async function registerRoutes(app: express.Express) {
  // ---- CRM ----
  entidadesRoutes(app);
  contactosRoutes(app);
  visitasRoutes(app);
  tarefasRoutes(app);

  // ---- ADMIN ----
  adminRoutes(app);
  marcasRoutes(app);

  // Criar router agrupador para /api
  const api = express.Router();

  // ---- ODOO + UPLOADS ----
  api.use("/odoo/contact-requests", odooContactRequestsRoutes);
  api.use("/uploads", uploadsRoutes);

  // ---- PDF ----
  // Rotas começam em "/pdf/..." -> ficam /api/pdf/...
  api.use("/", pdfRouter);

  // ---- SEARCH ----
  // Rotas começam em "/entidades/search", etc. -> /api/crm/entidades/search
  api.use("/crm", searchRouter);

  // ---- MISC ----
  api.use("/", proximityRouter);     // /api/visitas/proximidade
  api.use("/", userSettingsRouter);  // /api/user/settings

  // ---- AI ----
  api.use("/ai", aiRouter);          // /api/ai/...

  // Montar tudo sob /api
  app.use("/api", api);

  // Cria o servidor HTTP
  const httpServer = createServer(app);
  return httpServer;
}
