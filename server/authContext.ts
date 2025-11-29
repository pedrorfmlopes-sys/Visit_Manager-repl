/**
 * FASE 2: Authentication Context Utilities
 * 
 * Centralized functions for extracting user context (userId, empresaId, role)
 * from Express requests. Used throughout server/routes.ts for RBAC + multi-tenant filtering.
 */

import { storage } from "./storage";

export interface UserContext {
  userId: string;
  empresaId?: string;
  userRole: 'admin' | 'agent';
}

/**
 * Extract user context from authenticated request
 * Returns userId, empresaId (from user's company), and role
 */
export async function getUserContext(req: any): Promise<UserContext> {
  const userId = req.user?.claims?.sub;

  if (!userId) {
    throw new Error("User not authenticated");
  }

  const user = await storage.getUser(userId);
  const userRole = user?.role || 'agent';
  const empresaId = user?.empresaId;

  return { userId, userRole, empresaId };
}

/**
 * Middleware: Require admin role
 * Returns 403 if user is not admin
 */
export async function requireAdmin(req: any, res: any, next: any) {
  try {
    const context = await getUserContext(req);

    if (context.userRole !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'This action is reserved for administrators'
      });
    }

    // Attach context to request for use in route handlers
    req.userContext = context;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Unable to verify user authentication'
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
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'User not authenticated'
    });
  }
}
