import assert from "node:assert/strict";
import test from "node:test";
import {
  profileFromClaims,
  SOCIAL_AUTH_SCOPES,
} from "../../server/socialProfile";

test("social login requests identity scopes only", () => {
  assert.deepEqual(SOCIAL_AUTH_SCOPES, ["openid", "email", "profile"]);
  assert.equal(SOCIAL_AUTH_SCOPES.some((scope) => scope.includes(".")), false);
});

test("extracts a verified Google identity from OIDC claims", () => {
  const profile = profileFromClaims("google", {
    sub: "google-subject",
    email: "Pessoa@Example.com",
    email_verified: true,
    given_name: "Ana",
    family_name: "Silva",
    picture: "https://example.test/photo.png",
  });

  assert.deepEqual(profile, {
    provider: "google",
    subject: "google-subject",
    email: "pessoa@example.com",
    firstName: "Ana",
    lastName: "Silva",
    profileImageUrl: "https://example.test/photo.png",
  });
});

test("extracts Microsoft identity without requiring Graph claims", () => {
  const profile = profileFromClaims("microsoft", {
    sub: "microsoft-subject",
    preferred_username: "pessoa@example.com",
    name: "Ana Silva",
  });

  assert.equal(profile.email, "pessoa@example.com");
  assert.equal(profile.firstName, "Ana");
  assert.equal(profile.lastName, "Silva");
});

test("rejects unverified Google email and incomplete identities", () => {
  assert.throws(() =>
    profileFromClaims("google", {
      sub: "subject",
      email: "pessoa@example.com",
      email_verified: false,
    }),
  );
  assert.throws(() =>
    profileFromClaims("microsoft", {
      sub: "subject",
    }),
  );
});
