import { Router, Request, Response } from "express";
import { isAuthenticated } from "../../replitAuth";
import { getUserContext } from "../../authContext";
import { storage } from "../../index";
import { db } from "../../db";
import { microsoftConnections } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// Helper: Generate random state for OAuth
function generateState(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Helper: Get user context with proper error handling
async function getAuthenticatedUser(req: any) {
  try {
    const context = await getUserContext(req);
    if (!context.userId) {
      throw new Error("No user ID in context");
    }
    return context.userId;
  } catch (error) {
    throw new Error("Unauthorized");
  }
}

// ENDPOINT 1: GET /api/integrations/microsoft/login
// Redireciona o utilizador autenticado para o login da Microsoft
router.get("/login", isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = await getAuthenticatedUser(req);

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const redirectUri = process.env.MS_REDIRECT_URI;

    if (!tenantId || !clientId || !redirectUri) {
      return res.status(500).json({ error: "Microsoft OAuth not configured" });
    }

    const state = generateState();
    
    // Store state in HTTP-only cookie (10 minutes expiry)
    res.cookie("ms_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    const authorizeUrl = new URL(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`
    );
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_mode", "query");
    authorizeUrl.searchParams.set(
      "scope",
      "openid profile offline_access User.Read Calendars.ReadWrite"
    );
    authorizeUrl.searchParams.set("state", state);

    res.redirect(302, authorizeUrl.toString());
  } catch (error: any) {
    console.error("[MS OAuth] Login error:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
});

// ENDPOINT 2: GET /api/integrations/microsoft/callback
// Recebe o code da Microsoft, troca por tokens, obtém dados do utilizador
router.get("/callback", async (req: any, res: Response) => {
  try {
    // Check if user is authenticated via existing session/cookie
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      // Redirect to login if not authenticated
      return res.redirect("/");
    }

    const { code, state, error: msError } = req.query;

    if (msError) {
      console.error("[MS OAuth] Microsoft error:", msError);
      return res.redirect("/admin/empresa?tab=apis-keys&ms=error");
    }

    if (!code || !state) {
      return res.redirect("/admin/empresa?tab=apis-keys&ms=error");
    }

    // Validate state from cookie
    const storedState = req.cookies.ms_oauth_state;
    if (!storedState || storedState !== state) {
      console.error("[MS OAuth] State mismatch or missing");
      return res.redirect("/admin/empresa?tab=apis-keys&ms=error");
    }

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const redirectUri = process.env.MS_REDIRECT_URI;

    if (!tenantId || !clientId || !clientSecret || !redirectUri) {
      console.error("[MS OAuth] Missing environment variables");
      return res.redirect("/admin/empresa?tab=apis-keys&ms=error");
    }

    // Exchange code for tokens
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code: code as string,
      redirect_uri: redirectUri,
      scope: "openid profile offline_access User.Read Calendars.ReadWrite",
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("[MS OAuth] Token exchange failed:", error);
      return res.redirect("/admin/empresa?tab=apis-keys&ms=error");
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token || !refresh_token) {
      console.error("[MS OAuth] Missing tokens in response");
      return res.redirect("/admin/empresa?tab=apis-keys&ms=error");
    }

    // Get user data from Microsoft Graph
    const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!graphResponse.ok) {
      console.error("[MS OAuth] Failed to fetch user data from Graph");
      return res.redirect("/admin/empresa?tab=apis-keys&ms=error");
    }

    const userData = await graphResponse.json();
    const { id: msAccountId, mail, userPrincipalName, displayName } = userData;

    if (!msAccountId) {
      console.error("[MS OAuth] No account ID from Graph");
      return res.redirect("/admin/empresa?tab=apis-keys&ms=error");
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Upsert Microsoft Connection
    const existingConnection = await db.query.microsoftConnections.findFirst({
      where: eq(microsoftConnections.userId, userId),
    });

    if (existingConnection) {
      // UPDATE
      await db
        .update(microsoftConnections)
        .set({
          msAccountId,
          email: mail || userPrincipalName,
          displayName: displayName || undefined,
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(microsoftConnections.id, existingConnection.id));
    } else {
      // INSERT
      await db.insert(microsoftConnections).values({
        userId,
        msAccountId,
        email: mail || userPrincipalName,
        displayName: displayName || undefined,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt,
      });
    }

    // Clear state cookie
    res.clearCookie("ms_oauth_state");

    // Redirect with success
    res.redirect("/admin/empresa?tab=apis-keys&ms=connected");
  } catch (error: any) {
    console.error("[MS OAuth] Callback error:", error);
    res.redirect("/admin/empresa?tab=apis-keys&ms=error");
  }
});

// ENDPOINT 3: GET /api/integrations/microsoft/status
// Permite ao frontend saber se o utilizador tem conta Microsoft ligada
router.get("/status", isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = await getAuthenticatedUser(req);

    const connection = await db.query.microsoftConnections.findFirst({
      where: eq(microsoftConnections.userId, userId),
    });

    if (!connection) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      displayName: connection.displayName,
      email: connection.email,
      msAccountId: connection.msAccountId,
    });
  } catch (error: any) {
    console.error("[MS OAuth] Status error:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
});

export default router;
