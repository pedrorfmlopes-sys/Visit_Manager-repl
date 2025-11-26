import { db } from "@shared/db";
import { empresas } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * FASE SUBS-LEADS-FLAG-STEP1: Assert that CRM Leads module is enabled for the company
 * 
 * Throws error with code "LEADS_NOT_ENABLED" if the flag is not set to true
 * Used to protect routes that require the leads module
 */
export async function assertLeadsEnabled(empresaId: string): Promise<void> {
  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.id, empresaId),
    columns: {
      id: true,
      crmLeadsEnabled: true,
    },
  });

  if (!empresa?.crmLeadsEnabled) {
    const error: any = new Error("CRM Leads module is not enabled for this company");
    error.code = "LEADS_NOT_ENABLED";
    throw error;
  }
}

export default { assertLeadsEnabled };
