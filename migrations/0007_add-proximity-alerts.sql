ALTER TABLE "entidades"
ADD COLUMN IF NOT EXISTS "proximity_alerts_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "visitas"
ADD COLUMN IF NOT EXISTS "proximity_alerts_enabled" boolean DEFAULT false NOT NULL;
