// server/auth/rbac.ts

import type { Request } from "express";
import {
  getUserContext,
  type UserContext as BaseUserContext,
} from "../authContext";

import { db } from "../db";
import { contactos } from "@shared/schema";
import { eq, and, or, desc, type SQL } from "drizzle-orm";
import {contactAccessWhere} from '../contactAccessSql';

/**
 * No projeto atual tens dois perfis:
 *  - admin
 *  - agent  (utilizador normal)
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
 */
export async function requireUserContext(req: Request): Promise<UserContext> {
  const existing = (req as any).userContext as BaseUserContext | undefined;

  const base = existing ?? (await getUserContext(req));

  if (!base.empresaId) {
    const error = new Error("Empresa não encontrada no contexto do utilizador");
    (error as any).status = 401;
    throw error;
  }

  const ctx: UserContext = {
    ...base,
    empresaId: base.empresaId,
  };

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
 */
export function canUserAccessVisit(
  ctx: UserContext,
  visita: { empresaId: string; userId: string }
): boolean {
  if (visita.empresaId !== ctx.empresaId) return false;
  if (isAdmin(ctx)) return true;
  return visita.userId === ctx.userId;
}

/**
 * =====================================================================
 *  ✔ FUNÇÃO CORRETA — listContactosForUser
 * =====================================================================
 */
export async function listContactosForUser({
  empresaId,
  userId,
  userRole,
  entidadeId,
}: {
  empresaId: string;
  userId: string;
  userRole: "admin" | "agent";
  entidadeId?: string;
}) {
  let whereClause: SQL<unknown> = eq(contactos.empresaId, empresaId);

  if (entidadeId) {
    whereClause = and(whereClause, eq(contactos.entidadeId, entidadeId)) as SQL<unknown>;
  }

  // Agents só podem ver os seus contactos
  if (userRole === "agent") {
    whereClause = and(
      whereClause,
      or(
        eq(contactos.createdByUserId, userId),
        eq(contactos.assignedUserId, userId)
      )
    ) as SQL<unknown>;
  }

  if(process.env.CONTACT_ACCESS_V2==='true') {
    whereClause=contactAccessWhere('person',empresaId,userId,userRole) as SQL<unknown>;
    if(entidadeId)whereClause=and(whereClause,eq(contactos.entidadeId,entidadeId)) as SQL<unknown>;
  }

  return db.query.contactos.findMany({
    where: whereClause,
    orderBy: desc(contactos.createdAt),
    with: {
      entidade: process.env.CONTACT_ACCESS_V2!=='true' || userRole==='admin' ? true : undefined,
      assignedUser: {columns:{id:true,firstName:true,lastName:true}},
      createdByUser: {columns:{id:true,firstName:true,lastName:true}},
    },
  });
}
