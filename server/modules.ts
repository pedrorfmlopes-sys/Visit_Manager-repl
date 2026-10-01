import { isEmpresaModuleEnabled, type EmpresaModuleId } from "@shared/modules";
import { storage } from "./storage";

function buildModuleDisabledError(moduleId: EmpresaModuleId, empresaId?: string | null) {
  const error: any = new Error(`Module "${moduleId}" is disabled for this company.`);
  error.code = `MODULE_${moduleId.toUpperCase()}_DISABLED`;
  error.moduleId = moduleId;
  error.empresaId = empresaId ?? null;
  error.success = false;
  error.notEnabled = true;
  return error;
}

export function isModuleDisabledError(error: any): boolean {
  return Boolean(error?.notEnabled && error?.moduleId && typeof error?.message === "string");
}

export function buildModuleDisabledResponse(error: any) {
  return {
    success: false,
    notEnabled: true,
    moduleId: error?.moduleId ?? null,
    message:
      error?.message ??
      "Este módulo está desativado para a empresa atual.",
  };
}

export async function getEmpresaOrThrow(empresaId?: string | null) {
  if (!empresaId) {
    throw buildModuleDisabledError("core_crm", empresaId);
  }

  const empresa = await storage.getEmpresa(empresaId);
  if (!empresa) {
    const error: any = new Error("Empresa não encontrada.");
    error.code = "EMPRESA_NOT_FOUND";
    error.empresaId = empresaId;
    error.success = false;
    throw error;
  }

  return empresa;
}

export async function assertEmpresaModuleEnabled(
  empresaId: string | null | undefined,
  moduleId: EmpresaModuleId,
): Promise<void> {
  const empresa = await getEmpresaOrThrow(empresaId);

  if (!isEmpresaModuleEnabled(empresa, moduleId, "admin")) {
    throw buildModuleDisabledError(moduleId, empresaId);
  }
}
