import express, { type Request, type Response, type NextFunction } from "express";
import { setupVite, serveStatic, log } from "./vite";
import registerRoutes from "./routes";
import { setupAuth } from "./replitAuth";

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      // Guardar o raw body para webhooks, etc.
      (req as any).rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Middleware de logging simples para /api/*
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Guardar referência ao json original
  const originalResJson = res.json.bind(res) as (body?: any) => Response;

  // Monkey-patch de res.json para capturar a resposta
  res.json = (bodyJson: any): Response => {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;

    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } catch {
          // ignora se não der para stringify
        }
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // ===== IMPORTANTE: Configurar sessao e auth ANTES das rotas =====
  await setupAuth(app);

  // Registo de todas as rotas (CRM, admin, Odoo, AI, etc.)
  const server = await registerRoutes(app);

  // Handler global de erros (depois das rotas)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });

    // manter o throw para logs em dev
    throw err;
  });

  // Dev vs produção (Vite)
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);

  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
