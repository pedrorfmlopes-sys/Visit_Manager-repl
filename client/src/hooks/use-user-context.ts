import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

/**
 * Hook to fetch the current authenticated user with their role
 */
export function useCurrentUser() {
  return useQuery<User>({
    queryKey: ['/api/auth/user'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/**
 * Hook to fetch all users (admin only) for assignment dropdown
 */
export function useAllUsers() {
  return useQuery<User[]>({
    queryKey: ['/api/users'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry if 403 Forbidden (not admin)
  });
}

/**
 * Helper to check if user is admin
 */
export function useIsAdmin() {
  const { data: user } = useCurrentUser();
  return user?.role === 'admin';
}
