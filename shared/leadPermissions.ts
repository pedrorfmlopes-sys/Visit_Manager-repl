export type OdooLeadAccessMode = "view" | "propose" | "publish";

export function changesRequireAdminApproval(
  mode: OdooLeadAccessMode,
  changes: Record<string, unknown>,
  current?: Record<string, unknown>,
) {
  if (mode !== "publish") return true;

  const sensitiveFields = new Set([
    "valorPrevisto",
    "entidadeId",
    "contactoId",
    "estado",
    "odooLeadId",
  ]);
  return Object.keys(changes).some((field) => {
    if (!sensitiveFields.has(field)) return false;
    if (!current) return true;
    const nextValue = changes[field];
    const currentValue = current[field];
    if (nextValue == null && currentValue == null) return false;
    return String(nextValue ?? "") !== String(currentValue ?? "");
  });
}
