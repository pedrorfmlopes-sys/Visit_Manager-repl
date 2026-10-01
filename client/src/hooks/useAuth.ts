import { useQuery } from "@tanstack/react-query";
import type { User, UserSettings } from "@shared/schema";
import {
  isEmpresaModuleEnabled,
  isOdooContactsFeatureEnabled,
  resolveEmpresaModules,
  type ResolvedEmpresaModules,
} from "@shared/modules";

export interface EmpresaFeatures {
  leadsEnabled?: boolean;
  [key: string]: any;
}

export interface EmpresaAuthInfo {
  id: string;
  nome: string;
  logoUrl?: string;
  mostrarMarcasEmVisitas: boolean;
  mostrarGPS?: boolean;
  theme?: "light-business" | "dark-pro";
  uiSettings?: any;
  crmLeadsEnabled?: boolean;
  // Odoo Contacts RBAC flags
  odooCrmEnabled?: boolean;
  odooContactsFeatureEnabled?: boolean;
  odooContactsAdminEnabled?: boolean;
  odooContactsAgentsEnabled?: boolean;
  crmVisitsOdooSyncEnabled?: boolean;
  odooContactsNoPermissionMessage?: string | null;
  licensePlan?: "base" | "pro" | "enterprise";
  licenseStatus?: string;
  licenseExpiresAt?: string | null;
  licenseMaxUsers?: number | null;
  features?: EmpresaFeatures; // reservado para futuro
}

export interface AuthUser extends Omit<User, "userSettings"> {
  empresa?: EmpresaAuthInfo;
  userSettings: UserSettings;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser>({
    // ✅ tem de bater certo com o endpoint do backend
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const isAdmin = user?.role === "admin";
  const empresa = user?.empresa;
  const role = isAdmin ? "admin" : "agent";
  const modules: ResolvedEmpresaModules = resolveEmpresaModules(empresa, role);

  const canUseOdooContacts = modules.odoo_contacts;
  const canSyncVisitsWithOdoo = modules.odoo_visits_sync;
  const canUseLeads = modules.leads;
  const canUseAI = modules.ai;
  const hasOdooContactsFeature =
    isEmpresaModuleEnabled(empresa, "odoo", role) &&
    isOdooContactsFeatureEnabled(empresa);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin,
    empresa,
    modules,
    canUseLeads,
    canUseAI,
    hasOdooContactsFeature,
    canUseOdooContacts,
    canSyncVisitsWithOdoo,
    isModuleEnabled: (moduleId: keyof ResolvedEmpresaModules) =>
      isEmpresaModuleEnabled(empresa, moduleId, role),
  };
}
