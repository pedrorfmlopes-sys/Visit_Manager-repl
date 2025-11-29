import { storage } from "../storage";

/**
 * Garante que o módulo de Leads está ativo para a empresa.
 *
 * - empresaId vem normalmente do getUserContext(req)
 * - Verifica primeiro features.leadsEnabled (nova abordagem)
 * - Faz fallback para crmLeadsEnabled (coluna antiga), para retrocompatibilidade
 * - Por omissão, se nada estiver definido, assume true (não quebra empresas antigas)
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

  // Novo campo JSONB com feature flags
  const features: any = (empresa as any).features ?? {};

  // Regra de decisão:
  // 1) Se features.leadsEnabled for boolean, usamos isso
  // 2) Senão, se crmLeadsEnabled existir, usamos isso (retrocompat)
  // 3) Senão, por omissão, true (não partimos empresas antigas)
  const hasExplicitFeatureFlag =
    Object.prototype.hasOwnProperty.call(features, "leadsEnabled") &&
    typeof features.leadsEnabled === "boolean";

  const leadsEnabled =
    (hasExplicitFeatureFlag ? features.leadsEnabled : undefined) ??
    (empresa as any).crmLeadsEnabled ??
    true;

  if (!leadsEnabled) {
    const error: any = new Error("Módulo de Leads está desativado para esta empresa.");
    error.code = "LEADS_NOT_ENABLED";
    error.success = false;
    error.notEnabled = true;
    throw error;
  }
}
