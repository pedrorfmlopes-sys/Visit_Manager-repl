import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAllUsers() {
  return useQuery<User[]>({
    queryKey: ["/api/users"],
    retry: false,
  });
}
