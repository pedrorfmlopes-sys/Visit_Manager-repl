ALTER TABLE users
  ADD COLUMN IF NOT EXISTS odoo_lead_can_publish_chatter boolean NOT NULL DEFAULT false;
