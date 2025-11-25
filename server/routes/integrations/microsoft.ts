import type { Router } from "express";
import { isAuthenticated } from "../../replitAuth";
import { getUserContext } from "../../authContext";
import { microsoftConnectionsStorage } from "../../storage/microsoftConnections";
import express from "express";

export function setupMicrosoftRoutes(app: any): void {
  const router = express.Router();

  // GET /api/integrations/microsoft/login
  // Inicia login na Microsoft
  router.get("/login", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = await getUserContext(req);

      const tenantId = process.env.MS_TENANT_ID;
      const clientId = process.env.MS_CLIENT_ID;
      const redirectUri = process.env.MS_REDIRECT_URI;

      if (!tenantId || !clientId || !redirectUri) {
        return res.status(500).json({ message: "Microsoft OAuth configuration incomplete" });
      }

      // Gera um state aleatório
      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      // Guarda state numa cookie HTTP-only (~10 min)
      res.cookie("ms_oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60 * 1000, // 10 minutes
      });

      // Constrói a URL de autorização
      const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
      authUrl.searchParams.append("client_id", clientId);
      authUrl.searchParams.append("response_type", "code");
      authUrl.searchParams.append("redirect_uri", redirectUri);
      authUrl.searchParams.append("response_mode", "query");
      authUrl.searchParams.append("scope", "openid profile offline_access User.Read Calendars.ReadWrite");
      authUrl.searchParams.append("state", state);

      res.redirect(302, authUrl.toString());
    } catch (error) {
      console.error("Error in Microsoft login:", error);
      res.status(500).json({ message: "Failed to start Microsoft login" });
    }
  });

  // GET /api/integrations/microsoft/callback
  // Recebe o code e guarda tokens
  router.get("/callback", async (req: any, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.status(400).json({ message: `Microsoft OAuth error: ${error}` });
      }

      if (!code) {
        return res.status(400).json({ message: "Missing authorization code" });
      }

      // Verifica state
      const cookieState = req.cookies.ms_oauth_state;
      if (!state || !cookieState || state !== cookieState) {
        return res.status(400).json({ message: "Invalid state parameter" });
      }

      const tenantId = process.env.MS_TENANT_ID;
      const clientId = process.env.MS_CLIENT_ID;
      const clientSecret = process.env.MS_CLIENT_SECRET;
      const redirectUri = process.env.MS_REDIRECT_URI;

      if (!tenantId || !clientId || !clientSecret || !redirectUri) {
        return res.status(500).json({ message: "Microsoft OAuth configuration incomplete" });
      }

      // Faz POST para obter tokens
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const tokenBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: redirectUri,
        scope: "openid profile offline_access User.Read Calendars.ReadWrite",
      });

      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenBody.toString(),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error("Microsoft token error:", errorData);
        return res.status(400).json({ message: "Failed to obtain tokens from Microsoft" });
      }

      const tokenData: any = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in;

      if (!accessToken || !refreshToken) {
        return res.status(400).json({ message: "Missing tokens in Microsoft response" });
      }

      // Faz GET para obter info do utilizador
      const meResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!meResponse.ok) {
        console.error("Microsoft graph me error:", await meResponse.text());
        return res.status(400).json({ message: "Failed to fetch user info from Microsoft" });
      }

      const meData: any = await meResponse.json();
      const msAccountId = meData.id;
      const email = meData.mail || meData.userPrincipalName;
      const displayName = meData.displayName;

      if (!msAccountId) {
        return res.status(400).json({ message: "Could not extract Microsoft account ID" });
      }

      // Obtém userId autenticado
      const { userId } = await getUserContext(req);

      // Calcula expiresAt
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Guarda conexão
      await microsoftConnectionsStorage.upsertMicrosoftConnection({
        userId,
        msAccountId,
        email: email || undefined,
        displayName: displayName || undefined,
        accessToken,
        refreshToken,
        expiresAt,
      });

      // Limpa cookie
      res.clearCookie("ms_oauth_state");

      // Redireciona para a página de configuração
      res.redirect(302, "/admin/empresa?tab=apis-keys&ms=connected");
    } catch (error) {
      console.error("Error in Microsoft callback:", error);
      res.status(500).json({ message: "Failed to process Microsoft callback" });
    }
  });

  // GET /api/integrations/microsoft/status
  // Diz se o user tem conta MS ligada
  router.get("/status", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = await getUserContext(req);

      const connection = await microsoftConnectionsStorage.getMicrosoftConnectionByUserId(userId);

      if (!connection) {
        return res.json({ connected: false });
      }

      res.json({
        connected: true,
        email: connection.email,
        displayName: connection.displayName,
        msAccountId: connection.msAccountId,
      });
    } catch (error) {
      console.error("Error fetching Microsoft connection status:", error);
      res.status(500).json({ message: "Failed to fetch Microsoft connection status" });
    }
  });

  app.use("/api/integrations/microsoft", router);
}
