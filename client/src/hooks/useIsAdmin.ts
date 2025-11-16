import { useCurrentUser } from "./useCurrentUser";

export function useIsAdmin() {
  const { data: user } = useCurrentUser();
  return user?.role === 'admin';
}
