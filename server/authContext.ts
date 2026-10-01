/**
 * FASE 2: Authentication Context Utilities
 *
 * Centralized functions for extracting user context (userId, empresaId, role)
 * from Express requests. Used throughout server/routes.ts for RBAC + multi-tenant filtering.
 */

import { storage } from "./storage";
import { isEmpresaLicenseActive } from "@shared/modules";

export interface UserContext {
  userId: string;
  empresaId?: string;
  userRole: "admin" | "agent";
  isOwner: boolean;
}

/**
 * Extract user context from authenticated request
 * Returns userId, empresaId (from user's company), and role
 */
export async function getUserContext(req: any): Promise<UserContext> {
  const sessionUser = req.session?.user;
  const userId = sessionUser?.id ?? req.user?.claims?.sub;

  if (!userId) {
    throw new Error("User not authenticated");
  }

  const user = await storage.getUser(userId);
  if (!user || !user.ativo) {
    throw new Error("User is missing or inactive");
  }

  // Preferir a BD, mas aceitar o contexto da sessão como fallback.
  const empresaIdValue = user.empresaId;
  const empresaId: string | undefined =
    empresaIdValue === null || empresaIdValue === undefined
      ? undefined
      : empresaIdValue;

  const userRoleValue = user.role;
  const normalizedRole: "admin" | "agent" =
    userRoleValue === "admin" ? "admin" : "agent";

  if (empresaId) {
    const company = await storage.getEmpresa(empresaId);
    if (!isEmpresaLicenseActive(company)) {
      const error = new Error("A licença desta empresa não está ativa.");
      (error as any).code = "LICENSE_INACTIVE";
      (error as any).status = 403;
      throw error;
    }
  }

  return {
    userId,
    userRole: normalizedRole,
    empresaId,
    isOwner: !!user.isOwner,
  };
}

/**
 * Middleware: Require admin role
 * Returns 403 if user is not admin
 */
export async function requireAdmin(req: any, res: any, next: any) {
  try {
    const context = await getUserContext(req);

    if (context.userRole !== "admin") {
      return res.status(403).json({
        error: "Access denied",
        message: "This action is reserved for administrators",
      });
    }

    // Attach context to request for use in route handlers
    req.userContext = context;
    next();
  } catch (error) {
    const status = (error as any)?.status ?? 401;
    return res.status(status).json({
      error: "Authentication failed",
      message:
        error instanceof Error
          ? error.message
          : "Unable to verify user authentication",
    });
  }
}

/**
 * Middleware: Ensure user is authenticated (get context)
 * Attaches userContext to request for use in route handlers
 */
export async function ensureAuthenticated(req: any, res: any, next: any) {
  try {
    const context = await getUserContext(req);
    req.userContext = context;
    next();
  } catch (error) {
    const status = (error as any)?.status ?? 401;
    return res.status(status).json({
      error: "Authentication failed",
      message:
        error instanceof Error ? error.message : "User not authenticated",
    });
  }
}
