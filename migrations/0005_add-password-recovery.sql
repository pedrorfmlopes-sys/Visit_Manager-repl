CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash"),
  CONSTRAINT "password_reset_tokens_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_idx"
  ON "password_reset_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_idx"
  ON "password_reset_tokens" ("expires_at");
