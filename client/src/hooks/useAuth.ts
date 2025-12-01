import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export interface EmpresaFeatures {
  leadsEnabled?: boolean;
  [key: string]: any;
}

export interface EmpresaAuthInfo {
  id: string;
  nome: string;
  logoUrl?: string;
  mostrarMarcasEmVisitas: boolean;
  theme?: "light-business" | "dark-pro";
  uiSettings?: any;
  crmLeadsEnabled?: boolean;
  // PROMPT 6: Odoo Contacts RBAC flags
  odooCrmEnabled?: boolean;
  odooContactsFeatureEnabled?: boolean;
  odooContactsAdminEnabled?: boolean;
  odooContactsAgentsEnabled?: boolean;
  crmVisitsOdooSyncEnabled?: boolean;
  features?: EmpresaFeatures; // reservado para futuro
}

export interface AuthUser extends User {
  empresa?: EmpresaAuthInfo;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const isAdmin = user?.role === "admin";
  const empresa = user?.empresa;

  // PROMPT 7: Calcular flags derivadas para Odoo Contacts
  const odooCrmEnabled = empresa?.odooCrmEnabled ?? false;
  const odooContactsFeatureEnabled = empresa?.odooContactsFeatureEnabled ?? false;
  const odooContactsAdminEnabled = empresa?.odooContactsAdminEnabled ?? true;
  const odooContactsAgentsEnabled = empresa?.odooContactsAgentsEnabled ?? false;
  const crmVisitsOdooSyncEnabled = empresa?.crmVisitsOdooSyncEnabled ?? false;

  // PROMPT 7: Derivadas - Permissões RBAC (3-tier)
  const canUseOdooContacts =
    odooCrmEnabled &&
    odooContactsFeatureEnabled &&
    (isAdmin ? odooContactsAdminEnabled : odooContactsAgentsEnabled);

  const canSyncVisitsWithOdoo =
    odooCrmEnabled &&
    odooContactsFeatureEnabled &&
    crmVisitsOdooSyncEnabled &&
    (isAdmin ? odooContactsAdminEnabled : odooContactsAgentsEnabled);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin,
    empresa,
    // PROMPT 7: Odoo Contacts derived permissions
    canUseOdooContacts,
    canSyncVisitsWithOdoo,
  };
}
