// NEW assertLeadsEnabled.ts
export function assertLeadsEnabled(empresa: any) {
  if (!empresa?.features?.leadsEnabled) {
    const error = {
      success: false,
      notEnabled: true,
      message: "Módulo de Leads está desativado para esta empresa."
    };
    throw Object.assign(new Error(error.message), error);
  }
}
