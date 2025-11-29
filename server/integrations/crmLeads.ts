import { storage } from "../storage";

/**
 * Guard do módulo de Leads (CRM).
 *
 * Regra atual (simples e profissional):
 * - A fonte da verdade é empresa.crmLeadsEnabled (boolean).
 * - Se for true  → módulo ativo.
 * - Se for false → módulo desativado.
 * - Se for undefined/null → assume true (para empresas antigas).
 *
 * NOTA: Campo `features` fica reservado para futuro (planos avançados),
 * mas não é usado nesta versão do guard.
 */
export async function assertLeadsEnabled(empresaId?: string | null): Promise<void> {
  if (!empresaId) {
    const error: any = new Error("Empresa não encontrada para validar módulo de Leads.");
    error.code = "LEADS_NO_EMPRESA";
    error.success = false;
    error.notEnabled = true;
    throw error;
  }

  const empresa = await storage.getEmpresa(empresaId);

  if (!empresa) {
    const error: any = new Error("Empresa não encontrada.");
    error.code = "LEADS_EMPRESA_NOT_FOUND";
    error.success = false;
    error.notEnabled = true;
    throw error;
  }

  // Fonte de verdade: crmLeadsEnabled
  const rawFlag = (empresa as any).crmLeadsEnabled;

  const leadsEnabled =
    typeof rawFlag === "boolean"
      ? rawFlag           // se vier true/false da BD, usamos
      : true;             // se não vier nada, por defeito fica ativo (não parte empresas antigas)

  if (!leadsEnabled) {
    const error: any = new Error("Módulo de Leads está desativado para esta empresa.");
    error.code = "LEADS_NOT_ENABLED";
    error.success = false;
    error.notEnabled = true;
    throw error;
  }
}

export default { assertLeadsEnabled };
