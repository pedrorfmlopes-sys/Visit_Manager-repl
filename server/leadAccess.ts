import { and, desc, eq,inArray } from "drizzle-orm";
import {contactRecordBoundary} from './contactRecordBoundary';
import { db } from "./db";
import {
  leadApprovalRequests,
  leadFollowers,
  leads,
  users,
} from "@shared/schema";
import {
  changesRequireAdminApproval,
  type OdooLeadAccessMode,
} from "@shared/leadPermissions";

export { changesRequireAdminApproval };
export type { OdooLeadAccessMode };

export type LeadActorContext = {
  empresaId: string;
  userId: string;
  userRole: "admin" | "agent";
};

export async function getLeadActorPermissions(context: LeadActorContext) {
  if (context.userRole === "admin") {
    return {
      mode: "publish" as const,
      canCreate: true,
      canViewAttachments: true,
      canViewChatter: true,
      canPublishChatter: true,
      odooPartnerId: null,
    };
  }

  const user = await db.query.users.findFirst({
    where: and(
      eq(users.id, context.userId),
      eq(users.empresaId, context.empresaId),
    ),
    columns: {
      odooPartnerId: true,
      odooLeadAccess: true,
      odooLeadCanCreate: true,
      odooLeadCanViewAttachments: true,
      odooLeadCanViewChatter: true,
      odooLeadCanPublishChatter: true,
    },
  });

  const mode = ["view", "propose", "publish"].includes(
    user?.odooLeadAccess ?? "",
  )
    ? (user!.odooLeadAccess as OdooLeadAccessMode)
    : "view";

  return {
    mode,
    canCreate: Boolean(user?.odooLeadCanCreate),
    canViewAttachments: Boolean(user?.odooLeadCanViewAttachments),
    canViewChatter: Boolean(user?.odooLeadCanViewChatter),
    canPublishChatter: Boolean(user?.odooLeadCanPublishChatter),
    odooPartnerId: user?.odooPartnerId ?? null,
  };
}

export async function isLeadFollower(context: LeadActorContext, leadId: string) {
  if (context.userRole === "admin") return true;
  const follower = await db.query.leadFollowers.findFirst({
    where: and(
      eq(leadFollowers.empresaId, context.empresaId),
      eq(leadFollowers.leadId, leadId),
      eq(leadFollowers.userId, context.userId),
    ),
    columns: { id: true },
  });
  return Boolean(follower);
}

export async function assertLeadAccess(
  context: LeadActorContext,
  leadId: string,
) {
  const lead = await db.query.leads.findFirst({
    where: and(
      eq(leads.id, leadId),
      eq(leads.empresaId, context.empresaId),
    ),
    columns: { id: true, odooLeadId: true,empresaId:true,entidadeId:true,contactoId:true,visitaId:true },
  });
  const allowed=await contactRecordBoundary(context.empresaId,context.userId,context.userRole);
  if (!lead || !allowed(lead)) {
    const error = new Error("Lead não encontrado.");
    (error as any).status = 404;
    throw error;
  }
  if (!(await isLeadFollower(context, leadId))) {
    const error = new Error("Não tem acesso a este lead.");
    (error as any).status = 403;
    throw error;
  }
  return lead;
}

export async function getAccessibleLeadIds(context: LeadActorContext) {
  if (context.userRole === "admin") return null;
  const rows = await db
    .select({ leadId: leadFollowers.leadId })
    .from(leadFollowers)
    .where(
      and(
        eq(leadFollowers.empresaId, context.empresaId),
        eq(leadFollowers.userId, context.userId),
      ),
    );
  if(process.env.CONTACT_ACCESS_V2==='true' && rows.length) {
    const allowed=await contactRecordBoundary(context.empresaId,context.userId,context.userRole);
    const records=await db.query.leads.findMany({where:and(eq(leads.empresaId,context.empresaId),inArray(leads.id,rows.map(row=>row.leadId)))});
    return records.filter(allowed).map(row=>row.id);
  }
  return rows.map((row) => row.leadId);
}

export async function createOrReplaceLeadApprovalRequest(input: {
  empresaId: string;
  leadId: string;
  requestedByUserId: string;
  requestType: "create" | "update";
  proposedChanges: Record<string, unknown>;
  baseOdooWriteDate?: string | null;
}) {
  const existing = await db.query.leadApprovalRequests.findFirst({
    where: and(
      eq(leadApprovalRequests.empresaId, input.empresaId),
      eq(leadApprovalRequests.leadId, input.leadId),
      eq(leadApprovalRequests.requestedByUserId, input.requestedByUserId),
      eq(leadApprovalRequests.status, "pending"),
    ),
    orderBy: [desc(leadApprovalRequests.createdAt)],
  });

  if (existing) {
    const [updated] = await db
      .update(leadApprovalRequests)
      .set({
        requestType: input.requestType,
        proposedChanges: input.proposedChanges,
        baseOdooWriteDate: input.baseOdooWriteDate ?? null,
        adminSeenAt: null,
        agentSeenAt: null,
        updatedAt: new Date(),
      })
      .where(eq(leadApprovalRequests.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(leadApprovalRequests)
    .values({
      empresaId: input.empresaId,
      leadId: input.leadId,
      requestedByUserId: input.requestedByUserId,
      requestType: input.requestType,
      proposedChanges: input.proposedChanges,
      baseOdooWriteDate: input.baseOdooWriteDate ?? null,
    })
    .returning();
  return created;
}
