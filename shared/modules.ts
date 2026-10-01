export type EmpresaRole = "admin" | "agent";

export type EmpresaModuleId =
  | "core_crm"
  | "leads"
  | "odoo"
  | "odoo_contacts"
  | "odoo_visits_sync"
  | "ai";

export type ResolvedEmpresaModules = Record<EmpresaModuleId, boolean>;
export type EmpresaPlanPresetId = "base" | "pro" | "enterprise";

export type EmpresaModuleDescriptor = {
  id: EmpresaModuleId;
  label: string;
  shortLabel: string;
  description: string;
  category: "core" | "sales" | "integrations" | "productivity";
  dependsOn?: EmpresaModuleId[];
  availability: "base" | "addon";
};

export type EmpresaPlanPreset = {
  id: EmpresaPlanPresetId;
  label: string;
  description: string;
  modules: EmpresaModuleId[];
};

export const EMPRESA_MODULE_CATALOG: EmpresaModuleDescriptor[] = [
  {
    id: "core_crm",
    label: "Core CRM",
    shortLabel: "Core",
    description:
      "Base operacional da app: entidades, contactos, visitas, tarefas e lembretes.",
    category: "core",
    availability: "base",
  },
  {
    id: "leads",
    label: "Leads",
    shortLabel: "Leads",
    description:
      "Gestão de leads comerciais na app, com formulários, detalhe e sincronização dedicada.",
    category: "sales",
    dependsOn: ["core_crm"],
    availability: "addon",
  },
  {
    id: "odoo",
    label: "Odoo CRM",
    shortLabel: "Odoo",
    description:
      "Integração principal com Odoo para contactos, leads e sincronizações de CRM.",
    category: "integrations",
    dependsOn: ["core_crm"],
    availability: "addon",
  },
  {
    id: "odoo_contacts",
    label: "Contactos Odoo",
    shortLabel: "Contactos Odoo",
    description:
      "Permissões e fluxo de importação/sincronização de contactos Odoo por empresa e por perfil.",
    category: "integrations",
    dependsOn: ["odoo"],
    availability: "addon",
  },
  {
    id: "odoo_visits_sync",
    label: "Sync de Visitas Odoo",
    shortLabel: "Sync Visitas",
    description:
      "Sincronização das visitas com dados e contactos Odoo quando essa integração está ativa.",
    category: "integrations",
    dependsOn: ["odoo", "odoo_contacts"],
    availability: "addon",
  },
  {
    id: "ai",
    label: "IA",
    shortLabel: "IA",
    description:
      "Resumos, sugestões de tarefas e insights assistidos por IA para visitas e dashboards.",
    category: "productivity",
    dependsOn: ["core_crm"],
    availability: "addon",
  },
];

export const EMPRESA_PLAN_PRESETS: EmpresaPlanPreset[] = [
  {
    id: "base",
    label: "Base",
    description:
      "Operação CRM essencial para equipas que precisam de entidades, contactos, visitas, tarefas e lembretes.",
    modules: ["core_crm"],
  },
  {
    id: "pro",
    label: "Pro",
    description:
      "Adiciona módulo de leads e IA para equipas comerciais com pipeline e produtividade assistida.",
    modules: ["core_crm", "leads", "ai"],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    description:
      "Inclui o pacote comercial completo com Odoo, contactos Odoo, sincronização de visitas e IA.",
    modules: ["core_crm", "leads", "odoo", "odoo_contacts", "odoo_visits_sync", "ai"],
  },
];

type EmpresaModuleSource = {
  licensePlan?: EmpresaPlanPresetId | string | null;
  licenseStatus?: string | null;
  licenseExpiresAt?: Date | string | null;
  crmLeadsEnabled?: boolean | null;
  odooCrmEnabled?: boolean | null;
  odooContactsFeatureEnabled?: boolean | null;
  odooContactsAdminEnabled?: boolean | null;
  odooContactsAgentsEnabled?: boolean | null;
  crmVisitsOdooSyncEnabled?: boolean | null;
  uiSettings?: any;
} | null | undefined;

export function isEmpresaLicenseActive(source: EmpresaModuleSource): boolean {
  if (!source) return false;
  if ((source.licenseStatus ?? "active") !== "active") return false;
  if (!source.licenseExpiresAt) return true;
  return new Date(source.licenseExpiresAt).getTime() > Date.now();
}

export function getEmpresaLicensedModules(
  source: EmpresaModuleSource,
): Set<EmpresaModuleId> {
  if (!isEmpresaLicenseActive(source)) return new Set();
  const planId = (source?.licensePlan ?? "enterprise") as EmpresaPlanPresetId;
  const preset =
    EMPRESA_PLAN_PRESETS.find((item) => item.id === planId) ??
    EMPRESA_PLAN_PRESETS.find((item) => item.id === "base")!;
  return new Set(preset.modules);
}

function isLicensed(
  source: EmpresaModuleSource,
  moduleId: EmpresaModuleId,
): boolean {
  return getEmpresaLicensedModules(source).has(moduleId);
}

export function isLeadsModuleEnabled(source: EmpresaModuleSource): boolean {
  if (!isLicensed(source, "leads")) return false;
  const rawFlag = source?.crmLeadsEnabled;
  return typeof rawFlag === "boolean" ? rawFlag : true;
}

export function isOdooModuleEnabled(source: EmpresaModuleSource): boolean {
  return isLicensed(source, "odoo") && source?.odooCrmEnabled === true;
}

export function isOdooContactsFeatureEnabled(source: EmpresaModuleSource): boolean {
  return (
    isLicensed(source, "odoo_contacts") &&
    source?.odooContactsFeatureEnabled === true
  );
}

export function isOdooContactsAccessEnabled(
  source: EmpresaModuleSource,
  role: EmpresaRole,
): boolean {
  if (!isOdooModuleEnabled(source) || !isOdooContactsFeatureEnabled(source)) {
    return false;
  }

  if (role === "admin") {
    return source?.odooContactsAdminEnabled !== false;
  }

  return source?.odooContactsAgentsEnabled === true;
}

export function isOdooVisitsSyncEnabled(
  source: EmpresaModuleSource,
  role: EmpresaRole,
): boolean {
  return (
    isOdooContactsAccessEnabled(source, role) &&
    source?.crmVisitsOdooSyncEnabled === true
  );
}

export function isAiModuleEnabled(source: EmpresaModuleSource): boolean {
  if (!isLicensed(source, "ai")) return false;
  const uiSettings = source?.uiSettings ?? {};
  const legacyEnabled = uiSettings.enableIA !== false;
  const aiSettings = uiSettings.ia ?? {};
  const aiEnabled = aiSettings.aiEnabled !== false;
  return legacyEnabled && aiEnabled;
}

export function resolveEmpresaModules(
  source: EmpresaModuleSource,
  role: EmpresaRole = "agent",
): ResolvedEmpresaModules {
  return {
    core_crm: isLicensed(source, "core_crm"),
    leads: isLeadsModuleEnabled(source),
    odoo: isOdooModuleEnabled(source),
    odoo_contacts: isOdooContactsAccessEnabled(source, role),
    odoo_visits_sync: isOdooVisitsSyncEnabled(source, role),
    ai: isAiModuleEnabled(source),
  };
}

export function isEmpresaModuleEnabled(
  source: EmpresaModuleSource,
  moduleId: EmpresaModuleId,
  role: EmpresaRole = "agent",
): boolean {
  return resolveEmpresaModules(source, role)[moduleId];
}
