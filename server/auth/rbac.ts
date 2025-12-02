// server/auth/rbac.ts

import type { Request } from "express";
import {
  getUserContext,
  type UserContext as BaseUserContext,
} from "../authContext";

/**
 * No projeto atual tens dois perfis:
 *  - admin
 *  - agent  (utilizador normal)
 *
 * Vamos reutilizar exatamente estes valores.
 */
export type UserRole = BaseUserContext["userRole"]; // 'admin' | 'agent'

/**
 * Versão "forte" do contexto, onde garantimos que há sempre empresaId.
 */
export interface UserContext extends BaseUserContext {
  empresaId: string;
}

/**
 * Garante que existe contexto autenticado COM empresaId.
 *
 * - Usa req.userContext se o middleware ensureAuthenticated já o tiver carregado.
 * - Senão chama getUserContext(req).
 * - Se não houver empresaId, lança erro 401.
 */
export async function requireUserContext(req: Request): Promise<UserContext> {
  const existing = (req as any).userContext as BaseUserContext | undefined;

  const base = existing ?? (await getUserContext(req));

  if (!base.empresaId) {
    const error = new Error(
      "Empresa não encontrada no contexto do utilizador",
    );
    (error as any).status = 401;
    throw error;
  }

  const ctx: UserContext = {
    ...base,
    empresaId: base.empresaId,
  };

  // Garante que todas as rotas seguintes usam sempre o mesmo contexto consistente
  (req as any).userContext = ctx;

  return ctx;
}

/**
 * Atalho para saber se é admin.
 */
export function isAdmin(ctx: UserContext): boolean {
  return ctx.userRole === "admin";
}

/**
 * RBAC para VISITAS:
 *
 *  - Obrigatório ter o mesmo empresaId.
 *  - admin  → pode ver TODAS as visitas da empresa.
 *  - agent  → só pode ver visitas onde é o responsável (userId).
 */
export function canUserAccessVisit(
  ctx: UserContext,
  visita: { empresaId: string; userId: string },
): boolean {
  if (visita.empresaId !== ctx.empresaId) return false;
  if (isAdmin(ctx)) return true;
  return visita.userId === ctx.userId;
}

/**
 * RBAC base para CONTACTOS:
 *
 *  - Obrigatório ter o mesmo empresaId.
 *  - A regra "apenas contactos associados às minhas visitas"
 *    vai ser garantida nas queries das rotas (join com visitas).
 */
export function canUserAccessContact(
  ctx: UserContext,
  contacto: { empresaId: string },
): boolean {
  return contacto.empresaId === ctx.empresaId;
}
