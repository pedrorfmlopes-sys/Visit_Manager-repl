CREATE TABLE IF NOT EXISTS commercial_projects (
 id varchar PRIMARY KEY, empresa_id varchar NOT NULL REFERENCES empresas(id),
 name text NOT NULL, reference text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '',
 description text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'active',
 participants jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS commercial_project_links (
 empresa_id varchar NOT NULL, project_id varchar NOT NULL, object_type text NOT NULL,
 object_id varchar NOT NULL, PRIMARY KEY(empresa_id,project_id,object_type,object_id),
 FOREIGN KEY(empresa_id,project_id) REFERENCES commercial_projects(empresa_id,id)
);
CREATE TABLE IF NOT EXISTS invoice_connections (
 empresa_id varchar PRIMARY KEY REFERENCES empresas(id), enabled boolean NOT NULL DEFAULT false,
 base_url text NOT NULL DEFAULT '', public_url text NOT NULL DEFAULT '', token_encrypted text NOT NULL DEFAULT '',
 auto_sync boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS invoice_jobs (
 id varchar PRIMARY KEY, empresa_id varchar NOT NULL REFERENCES empresas(id),
 kind text NOT NULL, source_id varchar NOT NULL, payload jsonb NOT NULL,
 state text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0,
 result jsonb, error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_jobs_company ON invoice_jobs(empresa_id,created_at DESC);
CREATE TABLE IF NOT EXISTS invoice_project_links (
 empresa_id varchar NOT NULL, project_id varchar NOT NULL, remote_id text NOT NULL,
 snapshot jsonb NOT NULL DEFAULT '{}', synced_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(empresa_id,project_id), UNIQUE(empresa_id,remote_id),
 FOREIGN KEY(empresa_id,project_id) REFERENCES commercial_projects(empresa_id,id)
);
