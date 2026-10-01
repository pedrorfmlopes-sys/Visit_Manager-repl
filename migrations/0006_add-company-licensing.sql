ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS license_plan varchar(20) NOT NULL DEFAULT 'enterprise',
  ADD COLUMN IF NOT EXISTS license_status varchar(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS license_expires_at timestamp,
  ADD COLUMN IF NOT EXISTS license_max_users integer;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invited_at timestamp,
  ADD COLUMN IF NOT EXISTS accepted_at timestamp;

UPDATE users AS target
SET is_owner = true,
    accepted_at = COALESCE(target.accepted_at, target.created_at, now())
WHERE target.id IN (
  SELECT DISTINCT ON (empresa_id) id
  FROM users
  WHERE empresa_id IS NOT NULL
    AND role = 'admin'
  ORDER BY empresa_id, created_at, id
);

UPDATE users
SET accepted_at = COALESCE(accepted_at, created_at, now())
WHERE password_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_one_owner_per_company
  ON users (empresa_id)
  WHERE is_owner = true;
