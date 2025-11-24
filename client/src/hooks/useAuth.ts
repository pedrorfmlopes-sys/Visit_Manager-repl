import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export interface AuthUser extends User {
  empresa?: {
    id: string;
    nome: string;
    logoUrl?: string;
    mostrarMarcasEmVisitas: boolean;
    theme?: "light-business" | "dark-pro";
    uiSettings?: {
      visitas?: {
        enableFilterDateQuick?: boolean;
        enableFilterUser?: boolean;
        enableFilterMarca?: boolean;
        enableFilterEntidade?: boolean;
        enableFilterContacto?: boolean;
        enableFilterHasAudio?: boolean;
      };
    };
  } | null;
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
    isAdmin: user?.role === 'admin',
    empresa: user?.empresa,
  };
}
