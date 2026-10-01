import type { User } from "@shared/schema";

export function safeUser(user: User) {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}
