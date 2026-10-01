import { assertEmpresaModuleEnabled } from "../modules";

/**
 * Guard central do módulo de Leads.
 * Mantém a semântica atual das flags da empresa, mas passa a usar a camada
 * partilhada de módulos para evitar checks espalhados pelo código.
 */
export async function assertLeadsEnabled(
  empresaId?: string | null,
): Promise<void> {
  await assertEmpresaModuleEnabled(empresaId, "leads");
}

export default { assertLeadsEnabled };
