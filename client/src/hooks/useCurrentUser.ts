import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useCurrentUser() {
  return useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });
}
