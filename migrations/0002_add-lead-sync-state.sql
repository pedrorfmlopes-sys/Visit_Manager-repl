ALTER TABLE "leads" ADD COLUMN "needs_sync" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "sync_status" "sync_status" DEFAULT 'never';--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_sync_at" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "sync_error" text;