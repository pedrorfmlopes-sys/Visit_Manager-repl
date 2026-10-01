ALTER TABLE users
  ADD COLUMN IF NOT EXISTS odoo_partner_id varchar,
  ADD COLUMN IF NOT EXISTS odoo_lead_access varchar(20) NOT NULL DEFAULT 'view',
  ADD COLUMN IF NOT EXISTS odoo_lead_can_create boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS odoo_lead_can_view_attachments boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS odoo_lead_can_view_chatter boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS users_empresa_odoo_partner_unique
  ON users (empresa_id, odoo_partner_id)
  WHERE empresa_id IS NOT NULL AND odoo_partner_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS lead_followers (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id varchar NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  lead_id varchar NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  odoo_partner_id varchar,
  source varchar(20) NOT NULL DEFAULT 'odoo',
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS lead_followers_lead_user_unique
  ON lead_followers (lead_id, user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS lead_followers_empresa_user_idx
  ON lead_followers (empresa_id, user_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS lead_approval_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id varchar NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  lead_id varchar NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  requested_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type varchar(20) NOT NULL,
  proposed_changes jsonb NOT NULL,
  base_odoo_write_date varchar,
  status varchar(30) NOT NULL DEFAULT 'pending',
  reviewer_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  review_comment text,
  reviewed_at timestamp with time zone,
  admin_seen_at timestamp with time zone,
  agent_seen_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS lead_approval_empresa_status_idx
  ON lead_approval_requests (empresa_id, status, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS lead_approval_requester_idx
  ON lead_approval_requests (requested_by_user_id, created_at);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS leads_empresa_odoo_unique
  ON leads (empresa_id, odoo_lead_id)
  WHERE odoo_lead_id IS NOT NULL;
