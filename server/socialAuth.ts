import * as oidc from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import type { Express, Request } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { externalIdentities, users } from "@shared/schema";
import { isEmpresaLicenseActive } from "@shared/modules";
import { storage } from "./storage";
import {
  profileFromClaims,
  SOCIAL_AUTH_SCOPES,
  type SocialProfile,
  type SocialProvider,
} from "./socialProfile";

interface SocialProviderConfig {
  provider: SocialProvider;
  issuer: string;
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
}

const providerConfigs: Record<SocialProvider, SocialProviderConfig> = {
  google: {
    provider: "google",
    issuer: "https://accounts.google.com",
    clientId: process.env.GOOGLE_AUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_AUTH_CALLBACK_URL,
  },
  microsoft: {
    provider: "microsoft",
    issuer: `https://login.microsoftonline.com/${
      process.env.MICROSOFT_AUTH_TENANT || "common"
    }/v2.0`,
    clientId: process.env.MICROSOFT_AUTH_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_AUTH_CLIENT_SECRET,
    callbackUrl: process.env.MICROSOFT_AUTH_CALLBACK_URL,
  },
};

const discoveredConfigs = new Map<SocialProvider, Promise<oidc.Configuration>>();
const registeredStrategies = new Set<string>();

declare module "express-session" {
  interface SessionData {
    pendingSocial?: SocialProfile;
  }
}

export function getSocialAuthMethods() {
  return {
    google: isProviderConfigured("google"),
    microsoft: isProviderConfigured("microsoft"),
  };
}

function isProviderConfigured(provider: SocialProvider) {
  const config = providerConfigs[provider];
  return Boolean(config.clientId && config.clientSecret);
}

function getProviderConfiguration(provider: SocialProvider) {
  const existing = discoveredConfigs.get(provider);
  if (existing) return existing;

  const providerConfig = providerConfigs[provider];
  if (!providerConfig.clientId || !providerConfig.clientSecret) {
    throw new Error(`${provider} authentication is not configured`);
  }

  const discovery = oidc.discovery(
    new URL(providerConfig.issuer),
    providerConfig.clientId,
    providerConfig.clientSecret,
  );
  discoveredConfigs.set(provider, discovery);
  return discovery;
}

function getCallbackUrl(
  req: Request,
  providerConfig: SocialProviderConfig,
) {
  if (providerConfig.callbackUrl) return providerConfig.callbackUrl;
  return `${req.protocol}://${req.get("host")}/api/auth/${
    providerConfig.provider
  }/callback`;
}

async function ensureProviderStrategy(
  req: Request,
  provider: SocialProvider,
) {
  const providerConfig = providerConfigs[provider];
  const hostKey = String(req.get("host")).replace(/[^a-zA-Z0-9]/g, "_");
  const strategyName = `social:${provider}:${hostKey}`;
  if (registeredStrategies.has(strategyName)) return strategyName;

  const config = await getProviderConfiguration(provider);
  const verify: VerifyFunction = async (tokens, verified) => {
    try {
      const profile = profileFromClaims(provider, tokens.claims());
      verified(null, { socialProfile: profile });
    } catch (error) {
      verified(error as Error);
    }
  };

  passport.use(
    new Strategy(
      {
        name: strategyName,
        config,
        scope: SOCIAL_AUTH_SCOPES.join(" "),
        callbackURL: getCallbackUrl(req, providerConfig),
      },
      verify,
    ),
  );
  registeredStrategies.add(strategyName);
  return strategyName;
}

function regenerateSession(req: Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function saveSession(req: Request) {
  return new Promise<void>((resolve, reject) => {
    req.session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function processSocialIdentity(
  req: Request,
  profile: SocialProfile,
) {
  const [linkedAccount] = await db
    .select({
      id: users.id,
      role: users.role,
      empresaId: users.empresaId,
      ativo: users.ativo,
    })
    .from(externalIdentities)
    .innerJoin(users, eq(users.id, externalIdentities.userId))
    .where(
      and(
        eq(externalIdentities.provider, profile.provider),
        eq(externalIdentities.subject, profile.subject),
      ),
    )
    .limit(1);

  if (linkedAccount) {
    if (!linkedAccount.ativo) return "inactive" as const;
    const company = linkedAccount.empresaId
      ? await storage.getEmpresa(linkedAccount.empresaId)
      : null;
    if (!isEmpresaLicenseActive(company)) return "license_inactive" as const;
    await regenerateSession(req);
    req.session.user = {
      id: linkedAccount.id,
      role: linkedAccount.role,
      empresaId: linkedAccount.empresaId,
    };
    await saveSession(req);
    return "authenticated" as const;
  }

  const existingEmail = await db
    .select({
      id: users.id,
      role: users.role,
      empresaId: users.empresaId,
      ativo: users.ativo,
      passwordHash: users.passwordHash,
      acceptedAt: users.acceptedAt,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${profile.email}`)
    .limit(1);
  if (existingEmail.length) {
    const invitedAccount = existingEmail[0];
    if (
      invitedAccount.ativo &&
      !invitedAccount.passwordHash &&
      !invitedAccount.acceptedAt
    ) {
      const company = invitedAccount.empresaId
        ? await storage.getEmpresa(invitedAccount.empresaId)
        : null;
      if (!isEmpresaLicenseActive(company)) return "license_inactive" as const;

      await db.transaction(async (tx) => {
        await tx.insert(externalIdentities).values({
          userId: invitedAccount.id,
          provider: profile.provider,
          subject: profile.subject,
          email: profile.email,
        });
        await tx
          .update(users)
          .set({
            acceptedAt: new Date(),
            firstName: profile.firstName,
            lastName: profile.lastName,
            profileImageUrl: profile.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, invitedAccount.id));
      });
      await regenerateSession(req);
      req.session.user = {
        id: invitedAccount.id,
        role: invitedAccount.role,
        empresaId: invitedAccount.empresaId,
      };
      await saveSession(req);
      return "authenticated" as const;
    }
    delete req.session.pendingSocial;
    await saveSession(req);
    return "existing_account" as const;
  }

  await regenerateSession(req);
  req.session.pendingSocial = profile;
  await saveSession(req);
  return "pending" as const;
}

function redirectForSocialResult(
  result: Awaited<ReturnType<typeof processSocialIdentity>>,
) {
  if (result === "authenticated") return "/";
  if (result === "pending") return "/login?social=complete";
  if (result === "inactive") return "/login?authError=inactive";
  if (result === "license_inactive") {
    return "/login?authError=license_inactive";
  }
  return "/login?authError=existing_account";
}

export async function setupSocialAuth(app: Express) {
  for (const provider of ["google", "microsoft"] as const) {
    app.get(`/api/auth/${provider}`, async (req, res, next) => {
      if (!isProviderConfigured(provider)) {
        return res.status(404).json({ message: "Método não configurado." });
      }
      try {
        const strategyName = await ensureProviderStrategy(req, provider);
        passport.authenticate(strategyName, {
          scope: [...SOCIAL_AUTH_SCOPES],
          prompt: "select_account",
        })(req, res, next);
      } catch (error) {
        console.error(`[auth] Failed to start ${provider} login:`, error);
        return res.redirect("/login?authError=provider_unavailable");
      }
    });

    app.get(
      `/api/auth/${provider}/callback`,
      async (req, res, next) => {
        if (!isProviderConfigured(provider)) {
          return res.redirect("/login?authError=provider_unavailable");
        }
        try {
          const strategyName = await ensureProviderStrategy(req, provider);
          passport.authenticate(
            strategyName,
            async (error: unknown, identity: any) => {
              if (error || !identity?.socialProfile) {
                console.error(`[auth] ${provider} callback failed:`, error);
                return res.redirect("/login?authError=provider_failed");
              }
              try {
                const result = await processSocialIdentity(
                  req,
                  identity.socialProfile,
                );
                return res.redirect(redirectForSocialResult(result));
              } catch (processError) {
                console.error(
                  `[auth] Failed to process ${provider} identity:`,
                  processError,
                );
                return res.redirect("/login?authError=provider_failed");
              }
            },
          )(req, res, next);
        } catch (error) {
          console.error(`[auth] Failed to finish ${provider} login:`, error);
          return res.redirect("/login?authError=provider_unavailable");
        }
      },
    );
  }

  if (process.env.ENABLE_E2E_AUTH_HELPERS === "true") {
    app.post("/api/dev/auth/social-callback", async (req, res) => {
      try {
        const profile = profileFromClaims(req.body.provider, req.body.claims);
        const result = await processSocialIdentity(req, profile);
        return res.json({ result });
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : "Invalid profile",
        });
      }
    });
  }
}
