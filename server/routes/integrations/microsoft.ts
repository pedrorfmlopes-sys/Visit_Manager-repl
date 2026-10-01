import type { Router } from "express";
import { isAuthenticated } from "../../replitAuth";
import { getUserContext } from "../../authContext";
import { microsoftConnectionsStorage } from "../../storage/microsoftConnections";
import express from "express";
import { storage } from "../../storage";

type GraphConnection = {
  userId: string;
  msAccountId: string;
  email: string | null;
  displayName: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

export function setupMicrosoftRoutes(app: any): void {
  const router = express.Router();

  function getCookieValue(req: any, name: string): string | undefined {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return undefined;

    const cookies = cookieHeader.split(";").map((c: string) => c.trim());
    for (const cookie of cookies) {
      if (!cookie) continue;
      const [key, ...rest] = cookie.split("=");
      if (key === name) {
        return decodeURIComponent(rest.join("="));
      }
    }

    return undefined;
  }

  function hasMicrosoftOAuthConfig() {
    return Boolean(
      process.env.MS_TENANT_ID &&
        process.env.MS_CLIENT_ID &&
        process.env.MS_CLIENT_SECRET &&
        process.env.MS_REDIRECT_URI,
    );
  }

  async function getValidMicrosoftConnection(userId: string): Promise<GraphConnection> {
    const connection = await microsoftConnectionsStorage.getMicrosoftConnectionByUserId(userId);
    if (!connection) {
      throw new Error("Microsoft account not connected");
    }

    const now = new Date();
    if (connection.expiresAt && connection.expiresAt.getTime() > now.getTime() + 60_000) {
      return connection as GraphConnection;
    }

    const tenantId = process.env.MS_TENANT_ID;
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("Microsoft OAuth configuration incomplete");
    }

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: connection.refreshToken,
      scope: "openid profile offline_access User.Read Calendars.ReadWrite Tasks.ReadWrite",
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
      console.error("Microsoft refresh token error:", errorData);
      throw new Error("Failed to refresh Microsoft access token");
    }

    const tokenData: any = await tokenResponse.json();

    const refreshed = await microsoftConnectionsStorage.upsertMicrosoftConnection({
      userId: connection.userId,
      msAccountId: connection.msAccountId,
      email: connection.email || undefined,
      displayName: connection.displayName || undefined,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || connection.refreshToken,
      expiresAt: new Date(Date.now() + Number(tokenData.expires_in || 3600) * 1000),
    });

    return refreshed as GraphConnection;
  }

  async function graphRequest(userId: string, endpoint: string, init?: RequestInit) {
    const connection = await getValidMicrosoftConnection(userId);
    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Microsoft Graph error ${response.status}: ${errorText}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  // GET /api/integrations/microsoft/login
  // Inicia login na Microsoft
  router.get("/login", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = await getUserContext(req);

      const tenantId = process.env.MS_TENANT_ID!;
      const clientId = process.env.MS_CLIENT_ID!;
      const redirectUri = process.env.MS_REDIRECT_URI!;

      if (!tenantId || !clientId || !redirectUri || !process.env.MS_CLIENT_SECRET) {
        return res.status(400).json({ message: "Microsoft OAuth configuration incomplete" });
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

      // Constrói a URL de autorização com tenantId (NÃO clientId)
      const authorizeUrl =
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize` +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_mode=query` +
        `&scope=${encodeURIComponent("openid profile offline_access User.Read Calendars.ReadWrite Tasks.ReadWrite")}` +
        `&state=${encodeURIComponent(state)}`;

      res.redirect(302, authorizeUrl);
    } catch (error) {
      console.error("Error in Microsoft login:", error);
      res.status(500).json({ message: "Failed to start Microsoft login" });
    }
  });

  // GET /api/integrations/microsoft/callback
  // Recebe o code e guarda tokens
  router.get("/callback", isAuthenticated, async (req: any, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.status(400).json({ message: `Microsoft OAuth error: ${error}` });
      }

      if (!code) {
        return res.status(400).json({ message: "Missing authorization code" });
      }

      // Verifica state
      const cookieState = getCookieValue(req, "ms_oauth_state");
      if (!state || !cookieState || state !== cookieState) {
        return res.redirect("/admin/empresa?tab=apis-keys&ms=error");
      }

      const tenantId = process.env.MS_TENANT_ID;
      const clientId = process.env.MS_CLIENT_ID;
      const clientSecret = process.env.MS_CLIENT_SECRET;
      const redirectUri = process.env.MS_REDIRECT_URI;

      if (!tenantId || !clientId || !clientSecret || !redirectUri) {
        return res.redirect("/admin/empresa?tab=apis-keys&ms=error");
      }

      // Faz POST para obter tokens
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const tokenBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: redirectUri,
        scope: "openid profile offline_access User.Read Calendars.ReadWrite Tasks.ReadWrite",
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
        return res.redirect("/admin/empresa?tab=apis-keys&ms=error");
      }

      const tokenData: any = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in;

      if (!accessToken || !refreshToken) {
        return res.redirect("/admin/empresa?tab=apis-keys&ms=error");
      }

      // Faz GET para obter info do utilizador
      const meResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!meResponse.ok) {
        console.error("Microsoft graph me error:", await meResponse.text());
        return res.redirect("/admin/empresa?tab=apis-keys&ms=error");
      }

      const meData: any = await meResponse.json();
      const msAccountId = meData.id;
      const email = meData.mail || meData.userPrincipalName;
      const displayName = meData.displayName;

      if (!msAccountId) {
        return res.redirect("/admin/empresa?tab=apis-keys&ms=error");
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
      res.redirect("/admin/empresa?tab=apis-keys&ms=error");
    }
  });

  // GET /api/integrations/microsoft/status
  // Diz se o user tem conta MS ligada
  router.get("/status", isAuthenticated, async (req: any, res) => {
    try {
      const oauthConfigured = hasMicrosoftOAuthConfig();
      const { userId } = await getUserContext(req);

      const connection = await microsoftConnectionsStorage.getMicrosoftConnectionByUserId(userId);

      if (!connection) {
        return res.json({ connected: false, oauthConfigured });
      }

      res.json({
        connected: true,
        oauthConfigured,
        email: connection.email,
        displayName: connection.displayName,
        msAccountId: connection.msAccountId,
      });
    } catch (error) {
      console.error("Error fetching Microsoft connection status:", error);
      res.json({
        connected: false,
        oauthConfigured: hasMicrosoftOAuthConfig(),
        message: "Failed to fetch Microsoft connection status",
      });
    }
  });

  router.post("/disconnect", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = await getUserContext(req);
      await microsoftConnectionsStorage.deleteMicrosoftConnectionByUserId(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting Microsoft account:", error);
      res.status(500).json({ message: "Failed to disconnect Microsoft account" });
    }
  });

  router.get("/auth/status", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = await getUserContext(req);
      const connection = await microsoftConnectionsStorage.getMicrosoftConnectionByUserId(userId);

      res.json({
        authenticated: Boolean(connection),
        connected: Boolean(connection),
        oauthConfigured: hasMicrosoftOAuthConfig(),
      });
    } catch (error) {
      console.error("Error fetching Microsoft auth status:", error);
      res.json({
        authenticated: false,
        connected: false,
        oauthConfigured: hasMicrosoftOAuthConfig(),
      });
    }
  });

  router.get("/auth/login", isAuthenticated, async (_req: any, res) => {
    res.redirect(302, "/api/integrations/microsoft/login");
  });

  router.post("/todo/export/:tarefaId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, empresaId, userRole } = await getUserContext(req);
      const tarefaId = req.params.tarefaId;

      if (!empresaId) {
        return res.status(400).json({ message: "Empresa não definida para este utilizador" });
      }

      const tarefa = await storage.getTarefa(
        tarefaId,
        empresaId,
        userId,
        userRole as "admin" | "agent",
      );

      if (!tarefa) {
        return res.status(404).json({ message: "Tarefa não encontrada" });
      }

      const listsResponse = await graphRequest(userId, "/me/todo/lists");
      const lists = listsResponse?.value || [];
      if (!lists.length) {
        return res.status(400).json({ message: "Nenhuma lista do Microsoft To Do disponível" });
      }

      const defaultList =
        lists.find((list: any) => list.wellknownListName === "defaultList") ||
        lists[0];

      const body = {
        title: tarefa.titulo,
        body: tarefa.descricao
          ? {
              contentType: "html",
              content: tarefa.descricao,
            }
          : undefined,
        dueDateTime: tarefa.dueDate
          ? {
              dateTime: new Date(tarefa.dueDate).toISOString(),
              timeZone: "Europe/Lisbon",
            }
          : undefined,
      };

      let todoTaskId = tarefa.todoTaskId || null;
      if (todoTaskId) {
        await graphRequest(userId, `/me/todo/lists/${defaultList.id}/tasks/${todoTaskId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        const created = await graphRequest(userId, `/me/todo/lists/${defaultList.id}/tasks`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        todoTaskId = created?.id || null;
      }

      await storage.updateTarefaMicrosoftFields(tarefa.id, {
        todoTaskId: todoTaskId || undefined,
        lastTodoSyncAt: new Date(),
        microsoftUserId: userId,
      });

      res.json({
        success: true,
        todoTaskId,
        listId: defaultList.id,
      });
    } catch (error: any) {
      console.error("Error exporting task to Microsoft To Do:", error);
      res.status(500).json({
        message: "Não foi possível exportar para o Microsoft To Do",
        details: error?.message || "Unknown error",
      });
    }
  });

  router.post("/calendar/export/:visitaId", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, empresaId, userRole } = await getUserContext(req);
      const visitaId = req.params.visitaId;

      if (!empresaId) {
        return res.status(400).json({ message: "Empresa não definida para este utilizador" });
      }

      const visita = await storage.getVisita(
        visitaId,
        empresaId,
        userId,
        userRole as "admin" | "agent",
      );

      if (!visita) {
        return res.status(404).json({ message: "Visita não encontrada" });
      }

      const start = new Date(visita.dataVisita);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const locationParts = [
        visita.entidade?.morada,
        visita.entidade?.cidade,
        visita.entidade?.codigoPostal,
      ].filter(Boolean);

      const eventBody = {
        subject: `Visita: ${visita.entidade?.nome || "Sem entidade"}`,
        body: {
          contentType: "html",
          content:
            visita.resumoIa ||
            visita.notas ||
            "<p>Visita criada a partir da app.</p>",
        },
        start: {
          dateTime: start.toISOString(),
          timeZone: "Europe/Lisbon",
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: "Europe/Lisbon",
        },
        location: locationParts.length
          ? {
              displayName: locationParts.join(", "),
            }
          : undefined,
      };

      let outlookEventId = visita.outlookEventId || null;
      if (outlookEventId) {
        await graphRequest(userId, `/me/events/${outlookEventId}`, {
          method: "PATCH",
          body: JSON.stringify(eventBody),
        });
      } else {
        const created = await graphRequest(userId, "/me/events", {
          method: "POST",
          body: JSON.stringify(eventBody),
        });
        outlookEventId = created?.id || null;
      }

      await storage.updateVisitaMicrosoftFields(visita.id, {
        outlookEventId: outlookEventId || undefined,
        lastCalendarSyncAt: new Date(),
      });

      res.json({
        success: true,
        outlookEventId,
      });
    } catch (error: any) {
      console.error("Error exporting visit to Outlook Calendar:", error);
      res.status(500).json({
        message: "Não foi possível exportar para o Outlook Calendar",
        details: error?.message || "Unknown error",
      });
    }
  });

  app.use("/api/integrations/microsoft", router);
  app.use("/api/microsoft", router);
}
