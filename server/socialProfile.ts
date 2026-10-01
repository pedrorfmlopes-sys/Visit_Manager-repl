export type SocialProvider = "google" | "microsoft";
export const SOCIAL_AUTH_SCOPES = ["openid", "email", "profile"] as const;

export interface SocialProfile {
  provider: SocialProvider;
  subject: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

function claimString(
  claims: Record<string, unknown>,
  key: string,
): string | null {
  const value = claims[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function profileFromClaims(
  provider: SocialProvider,
  rawClaims: unknown,
): SocialProfile {
  const claims = (rawClaims || {}) as Record<string, unknown>;
  const subject = claimString(claims, "sub");
  const email =
    claimString(claims, "email") ||
    (provider === "microsoft"
      ? claimString(claims, "preferred_username")
      : null);

  if (!subject || !email || !email.includes("@")) {
    throw new Error("O fornecedor não devolveu um email válido.");
  }
  if (provider === "google" && claims.email_verified !== true) {
    throw new Error("O Google não confirmou este endereço de email.");
  }

  const displayName = claimString(claims, "name");
  const nameParts = displayName?.split(/\s+/) || [];
  return {
    provider,
    subject,
    email: email.toLowerCase(),
    firstName:
      claimString(claims, "given_name") || nameParts.shift() || null,
    lastName:
      claimString(claims, "family_name") || nameParts.join(" ") || null,
    profileImageUrl: claimString(claims, "picture"),
  };
}
