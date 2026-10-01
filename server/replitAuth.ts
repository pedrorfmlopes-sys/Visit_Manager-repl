import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { db } from "./db";
import { users as usersTable, empresas as empresasTable } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getSocialAuthMethods, setupSocialAuth } from "./socialAuth";

const oidcIssuerUrl =
  process.env.OIDC_ISSUER_URL ??
  process.env.ISSUER_URL ??
  (process.env.REPL_ID ? "https://replit.com/oidc" : undefined);
const oidcClientId = process.env.OIDC_CLIENT_ID ?? process.env.REPL_ID;
const oidcClientSecret = process.env.OIDC_CLIENT_SECRET;
const oidcScopes =
  process.env.OIDC_SCOPE ?? "openid email profile offline_access";
const hasOidcConfig = Boolean(oidcIssuerUrl && oidcClientId);

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(oidcIssuerUrl!),
      oidcClientId!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const isProduction = process.env.NODE_ENV === "production";
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

async function getFallbackLoginUser() {
  const rows = await db
    .select({
      id: usersTable.id,
      role: usersTable.role,
      empresaId: usersTable.empresaId,
      ativo: usersTable.ativo,
      passwordHash: usersTable.passwordHash,
    })
    .from(usersTable)
    .leftJoin(empresasTable, eq(empresasTable.id, usersTable.empresaId))
    .orderBy(usersTable.role, usersTable.email);

  const allowCredentialedTestUser =
    process.env.ENABLE_E2E_AUTH_HELPERS === "true";
  const activeRows = rows.filter(
    (row) => row.ativo && (allowCredentialedTestUser || !row.passwordHash),
  );
  return (
    activeRows.find((row) => row.empresaId && row.role === "admin") ??
    activeRows.find((row) => row.empresaId) ??
    activeRows[0]
  );
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"] ?? claims["given_name"] ?? null,
    lastName: claims["last_name"] ?? claims["family_name"] ?? null,
    profileImageUrl: claims["profile_image_url"] ?? claims["picture"] ?? null,
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  await setupSocialAuth(app);

  app.get("/api/auth/methods", (_req, res) => {
    res.json({
      email: true,
      oidc: hasOidcConfig,
      ...getSocialAuthMethods(),
    });
  });

  if (!hasOidcConfig) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[auth] OIDC not configured, email auth and local test login enabled");
    }

    app.get("/api/login", async (req, res) => {
      if (process.env.NODE_ENV === "production") {
        return res.redirect("/login");
      }

      const fallbackUser = await getFallbackLoginUser();

      if (!fallbackUser) {
        return res.status(503).json({
          message: "No users found in database for local login fallback",
        });
      }

      (req.session as any).user = {
        id: fallbackUser.id,
        role: fallbackUser.role || "agent",
        empresaId: fallbackUser.empresaId ?? null,
      };

      req.session.save((err) => {
        if (err) {
          console.error("[auth] Error saving local fallback session:", err);
          return res.status(500).json({ message: "Failed to save session" });
        }
        return res.redirect("/");
      });
    });

    app.get("/api/logout", (req, res) => {
      req.session.destroy((err) => {
        if (err) {
          console.error("[auth] Error destroying local session:", err);
        }
        res.redirect("/");
      });
    });

    return;
  }

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const callbackURL =
        process.env.OIDC_CALLBACK_URL ||
        `${process.env.NODE_ENV === "production" ? "https" : "http"}://${domain}/api/callback`;
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: oidcScopes,
          callbackURL,
          ...(oidcClientSecret ? { clientSecret: oidcClientSecret } : {}),
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };
  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: oidcScopes.split(/\s+/).filter(Boolean),
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, async (err: any, user: any) => {
      if (err || !user) {
        return res.redirect("/api/login");
      }
      
      req.login(user, async (loginErr) => {
        if (loginErr) {
          console.error("[auth] Erro no login:", loginErr);
          return res.redirect("/api/login");
        }
        
        // Sincronizar req.user com req.session.user para os handlers de authRoutes.ts
        const claims = user.claims;
        if (claims?.sub) {
          // Buscar o user da BD para obter role e empresaId
          const userFromDb = await storage.getUser(claims.sub);
          if (userFromDb) {
            // NOTA: NAO fazemos auto-atribuicao de empresa para preservar multi-tenancy
            // Se user nao tem empresaId, a sessao tera empresaId=null e o admin
            // deve configurar o user manualmente na area de administracao
            (req.session as any).user = {
              id: userFromDb.id,
              role: userFromDb.role || "agent",
              empresaId: userFromDb.empresaId ?? null,
            };
            
            req.session.save((saveErr) => {
              if (saveErr) {
                console.error("[auth] Erro ao gravar sessao:", saveErr);
              }
              return res.redirect("/");
            });
          } else {
            // User nao encontrado na BD - redirect para login
            console.error("[auth] User nao encontrado na BD:", claims.sub);
            return res.redirect("/");
          }
        } else {
          return res.redirect("/");
        }
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      try {
        const postLogoutRedirectUri =
          process.env.OIDC_LOGOUT_REDIRECT_URL ||
          `${req.protocol}://${req.hostname}`;

        const endSessionUrl = client.buildEndSessionUrl(config, {
          client_id: oidcClientId!,
          post_logout_redirect_uri: postLogoutRedirectUri,
        }).href;

        res.redirect(endSessionUrl);
      } catch {
        res.redirect("/");
      }
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const sessionUser = (req.session as any)?.user;
  if (sessionUser?.id) {
    const databaseUser = await storage.getUser(sessionUser.id);
    if (!databaseUser?.ativo) {
      req.session.destroy(() => undefined);
      return res.status(401).json({ message: "User account is inactive" });
    }

    sessionUser.role = databaseUser.role === "admin" ? "admin" : "agent";
    sessionUser.empresaId = databaseUser.empresaId ?? null;
    return next();
  }

  if (!hasOidcConfig) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
