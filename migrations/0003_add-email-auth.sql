ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_unique" ON "users" (lower("email")) WHERE "email" IS NOT NULL;
