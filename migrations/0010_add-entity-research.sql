ALTER TABLE entidades
  ADD COLUMN IF NOT EXISTS country_code varchar(2) NOT NULL DEFAULT 'PT',
  ADD COLUMN IF NOT EXISTS vat_validation_status varchar(30),
  ADD COLUMN IF NOT EXISTS vat_validated_at timestamp;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS entidades_empresa_country_idx
  ON entidades (empresa_id, country_code);
