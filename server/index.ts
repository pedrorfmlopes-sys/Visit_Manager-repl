import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { setupVite, serveStatic, log } from "./vite";
import registerRoutes from "./routes";
import { setupAuth } from "./replitAuth";
import { ensureDatabaseCompatibility } from "./bootstrapDb";
import { pool } from "./db";
import { validateRuntimeConfig } from "./runtimeConfig";
import { securityHeaders } from "./securityMiddleware";
import {contactMaintenanceMiddleware,contactMaintenanceStatus} from './contactMaintenance';

const app = express();
validateRuntimeConfig();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(securityHeaders);
app.use(contactMaintenanceMiddleware);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      const duration = Date.now() - start;
      log(
        `${req.method} ${path} ${res.statusCode} in ${duration}ms` +
          ` requestId=${req.requestId}`,
      );
    }
  });
  next();
});

(async () => {
  await ensureDatabaseCompatibility();

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/api/ready", async (_req, res) => {
    try {
      await pool.query("select 1");
      res.setHeader('Cache-Control','no-store');
      res.json({ status: "ready",...contactMaintenanceStatus() });
    } catch (error) {
      console.error("[health] Database readiness check failed:", error);
      res.status(503).json({ status: "unavailable" });
    }
  });

  // Session and authentication must be configured before protected routes.
  await setupAuth(app);
  const server = await registerRoutes(app);

  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ message: "API endpoint not found" });
  });

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const isUploadLimit = String(err?.code ?? "").startsWith("LIMIT_");
    const safeStatus = isUploadLimit ? 413 : status;
    const message =
      safeStatus >= 500
        ? "Internal Server Error"
        : isUploadLimit
          ? "O ficheiro enviado excede o limite permitido."
          : err.message || "Request failed";

    console.error(
      `[server] Unhandled request error requestId=${req.requestId}:`,
      err,
    );
    if (!res.headersSent) {
      res.status(safeStatus).json({ message, requestId: req.requestId });
    }
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5050", 10);
  const isWindows = process.platform === "win32";
  const host = isWindows ? "127.0.0.1" : "0.0.0.0";

  server.listen(
    {
      port,
      host,
      ...(isWindows ? {} : { reusePort: true }),
    },
    () => {
      log(`serving on ${host}:${port}`);
    },
  );
})();
