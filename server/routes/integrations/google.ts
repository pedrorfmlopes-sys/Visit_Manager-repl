import type { Router } from "express";
import { isAuthenticated } from "../../replitAuth";
import { getUserContext } from "../../authContext";
import { googleConnectionsStorage } from "../../storage/googleConnections";
import express from "express";

export function setupGoogleRoutes(app: any): void {
  const router = express.Router();

  // GET /api/integrations/google/login
  // Inicia login no Google
  router.get("/login", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = await getUserContext(req);

      const clientId = process.env.GOOGLE_CLIENT_ID!;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

      if (!clientId || !redirectUri) {
        return res.status(500).json({ message: "Google OAuth configuration incomplete" });
      }

      // Gera um state aleatório
      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      // Guarda state numa cookie HTTP-only (~10 min)
      res.cookie("google_oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60 * 1000, // 10 minutes
      });

      // Constrói a URL de autorização
      const scope = "openid profile email https://www.googleapis.com/auth/calendar";

      const authorizeUrl =
        "https://accounts.google.com/o/oauth2/v2/auth" +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scope)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${encodeURIComponent(state)}`;

      res.redirect(302, authorizeUrl);
    } catch (error) {
      console.error("Error in Google login:", error);
      res.status(500).json({ message: "Failed to start Google login" });
    }
  });

  // GET /api/integrations/google/callback
  // Recebe o code e guarda tokens
  router.get("/callback", async (req: any, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.redirect("/admin/empresa?tab=apis-keys&google=error");
      }

      if (!code) {
        return res.redirect("/admin/empresa?tab=apis-keys&google=error");
      }

      // Verifica state
      const cookieState = req.cookies.google_oauth_state;
      if (!state || !cookieState || state !== cookieState) {
        return res.redirect("/admin/empresa?tab=apis-keys&google=error");
      }

      const clientId = process.env.GOOGLE_CLIENT_ID!;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

      if (!clientId || !clientSecret || !redirectUri) {
        return res.status(500).json({ message: "Google OAuth configuration incomplete" });
      }

      // Faz POST para obter tokens
      const tokenUrl = "https://oauth2.googleapis.com/token";
      const tokenBody = new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
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
        console.error("Google token error:", errorData);
        return res.redirect("/admin/empresa?tab=apis-keys&google=error");
      }

      const tokenData: any = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in;

      if (!accessToken || !refreshToken) {
        console.error("Missing tokens in Google response");
        return res.redirect("/admin/empresa?tab=apis-keys&google=error");
      }

      // Faz GET para obter info do utilizador
      const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!userInfoResponse.ok) {
        console.error("Google userinfo error:", await userInfoResponse.text());
        return res.redirect("/admin/empresa?tab=apis-keys&google=error");
      }

      const userInfo: any = await userInfoResponse.json();
      const googleUserId = userInfo.sub;
      const email = userInfo.email;
      const name = userInfo.name;
      const picture = userInfo.picture;

      if (!googleUserId) {
        console.error("Could not extract Google user ID");
        return res.redirect("/admin/empresa?tab=apis-keys&google=error");
      }

      // Obtém userId autenticado
      const { userId } = await getUserContext(req);

      // Calcula expiresAt
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Guarda conexão
      await googleConnectionsStorage.upsertGoogleConnection({
        userId,
        googleUserId,
        email: email || undefined,
        name: name || undefined,
        picture: picture || undefined,
        accessToken,
        refreshToken,
        expiresAt,
      });

      // Limpa cookie
      res.clearCookie("google_oauth_state");

      // Redireciona para a página de configuração
      res.redirect(302, "/admin/empresa?tab=apis-keys&google=connected");
    } catch (error) {
      console.error("Error in Google callback:", error);
      res.redirect("/admin/empresa?tab=apis-keys&google=error");
    }
  });

  // GET /api/integrations/google/status
  // Diz se o user tem conta Google ligada
  router.get("/status", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = await getUserContext(req);

      const connection = await googleConnectionsStorage.getGoogleConnectionByUserId(userId);

      if (!connection) {
        return res.json({ connected: false });
      }

      res.json({
        connected: true,
        email: connection.email,
        name: connection.name,
        googleUserId: connection.googleUserId,
        picture: connection.picture,
      });
    } catch (error) {
      console.error("Error fetching Google connection status:", error);
      res.status(500).json({ message: "Failed to fetch Google connection status" });
    }
  });

  app.use("/api/integrations/google", router);
}
