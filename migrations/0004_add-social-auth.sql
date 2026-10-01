CREATE TABLE IF NOT EXISTS "external_identities" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "provider" varchar(20) NOT NULL,
  "subject" varchar(255) NOT NULL,
  "email" varchar(254),
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "external_identities_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_identities_provider_subject_unique"
  ON "external_identities" ("provider", "subject");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_identities_user_provider_unique"
  ON "external_identities" ("user_id", "provider");
