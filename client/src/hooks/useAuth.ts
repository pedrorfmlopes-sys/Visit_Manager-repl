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
  // Flag principal vinda do backend para o módulo de Leads
  crmLeadsEnabled?: boolean;
  // Preparado para futuro (feature flags mais avançadas)
  features?: EmpresaFeatures;
}

export interface AuthUser extends User {
  empresa?: EmpresaAuthInfo;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    empresa: user?.empresa,
  };
}
