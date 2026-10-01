import { pool } from "./db";
import { encryptSecret, isEncryptedSecret } from "./secretCrypto";

const DEFAULT_EMPRESA_ID =
  process.env.DEFAULT_EMPRESA_ID ?? "00000000-0000-0000-0000-000000000001";
const DEFAULT_EMPRESA_NOME =
  process.env.DEFAULT_EMPRESA_NOME ?? "Empresa Principal";

async function tableExists(tableName: string) {
  const result = await pool.query(
    `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = current_schema() and table_name = $1
      ) as exists
    `,
    [tableName],
  );

  return Boolean(result.rows[0]?.exists);
}

async function columnExists(tableName: string, columnName: string) {
  const result = await pool.query(
    `
      select exists (
        select 1
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = $1
          and column_name = $2
      ) as exists
    `,
    [tableName, columnName],
  );

  return Boolean(result.rows[0]?.exists);
}

async function ensureLegacyEmpresaCompatibility() {
  const hasUsers = await tableExists("users");
  const hasEntidades = await tableExists("entidades");
  const hasContactos = await tableExists("contactos");
  const hasVisitas = await tableExists("visitas");

  if (!hasUsers && !hasEntidades && !hasContactos && !hasVisitas) {
    return;
  }

  await pool.query(`
    create table if not exists empresas (
      id varchar primary key,
      nome varchar(255) not null,
      created_at timestamp default now(),
      updated_at timestamp default now()
    )
  `);

  await pool.query(
    `insert into empresas (id, nome)
     values ($1, $2)
     on conflict (id) do nothing`,
    [DEFAULT_EMPRESA_ID, DEFAULT_EMPRESA_NOME],
  );

  const targets = [
    { table: "users", nullable: true },
    { table: "entidades", nullable: false },
    { table: "contactos", nullable: false },
    { table: "visitas", nullable: false },
    { table: "tarefas", nullable: false },
    { table: "marcas", nullable: false },
    { table: "lembretes", nullable: false },
    { table: "visitas_marcas", nullable: false },
    { table: "visitas_audio", nullable: false },
    { table: "visitas_contactos", nullable: false },
    { table: "odoo_connections", nullable: false },
    { table: "odoo_contact_requests", nullable: false },
  ];

  for (const target of targets) {
    if (!(await tableExists(target.table))) continue;
    if (!(await columnExists(target.table, "empresa_id"))) continue;

    await pool.query(
      `update "${target.table}" set empresa_id = $1 where empresa_id is null`,
      [DEFAULT_EMPRESA_ID],
    );

    if (!target.nullable) {
      await pool.query(
        `alter table "${target.table}" alter column empresa_id set not null`,
      );
    }
  }

  const constraints = [
    "users",
    "entidades",
    "contactos",
    "visitas",
    "tarefas",
    "marcas",
    "lembretes",
    "visitas_marcas",
    "visitas_audio",
    "visitas_contactos",
    "odoo_connections",
    "odoo_contact_requests",
  ];

  for (const tableName of constraints) {
    if (!(await tableExists(tableName))) continue;
    if (!(await columnExists(tableName, "empresa_id"))) continue;

    const constraintName = `${tableName}_empresa_id_empresas_id_fk`;
    await pool.query(`
      do $$
      begin
        if not exists (
          select 1
          from information_schema.table_constraints
          where table_schema = current_schema()
            and table_name = '${tableName}'
            and constraint_name = '${constraintName}'
        ) then
          alter table "${tableName}"
            add constraint "${constraintName}"
            foreign key (empresa_id) references empresas(id) on delete cascade;
        end if;
      end $$;
    `);
  }

  if (await tableExists("users")) {
    const hasAdmin = await pool.query(
      `select id from users where role = 'admin' limit 1`,
    );

    if (hasAdmin.rowCount === 0) {
      await pool.query(
        `
          update users
          set role = 'admin',
              empresa_id = coalesce(empresa_id, $1)
          where id = (
            select id
            from users
            order by created_at nulls first, email nulls last, id
            limit 1
          )
        `,
        [DEFAULT_EMPRESA_ID],
      );
    }
  }
}

async function ensureEnvOdooConfiguration() {
  const odooUrl = process.env.ODOO_URL?.trim();
  const odooDb = process.env.ODOO_DB?.trim();
  const odooUser = process.env.ODOO_USER?.trim();
  const odooPass = process.env.ODOO_PASS?.trim();

  if (!odooUrl || !odooDb || !odooUser || !odooPass) {
    return;
  }

  if (!(await tableExists("odoo_connections"))) {
    return;
  }

  const existing = await pool.query(
    `
      select id
      from odoo_connections
      where empresa_id = $1
      order by updated_at desc nulls last, created_at desc nulls last, id
      limit 1
    `,
    [DEFAULT_EMPRESA_ID],
  );

  if (existing.rowCount && existing.rows[0]?.id) {
    await pool.query(
      `
        update odoo_connections
        set base_url = $2,
            db_name = $3,
            username = $4,
            api_key = $5,
            environment = 'production',
            is_active = true,
            updated_at = now()
        where id = $1
      `,
      [
        existing.rows[0].id,
        odooUrl,
        odooDb,
        odooUser,
        encryptSecret(odooPass),
      ],
    );
  } else {
    await pool.query(
      `
        insert into odoo_connections (
          empresa_id,
          base_url,
          db_name,
          username,
          api_key,
          environment,
          is_active
        )
        values ($1, $2, $3, $4, $5, 'production', true)
      `,
      [
        DEFAULT_EMPRESA_ID,
        odooUrl,
        odooDb,
        odooUser,
        encryptSecret(odooPass),
      ],
    );
  }

  if (await tableExists("empresas")) {
    await pool.query(
      `
        update empresas
        set odoo_crm_enabled = true,
            updated_at = now()
        where id = $1
      `,
      [DEFAULT_EMPRESA_ID],
    );
  }
}

async function ensureLeadSyncCompatibility() {
  if (!(await tableExists("leads"))) {
    return;
  }

  await pool.query(`
    alter table leads
      add column if not exists needs_sync boolean default false not null,
      add column if not exists sync_status sync_status default 'never',
      add column if not exists last_sync_at timestamp,
      add column if not exists sync_error text
  `);
}

async function ensureEmailAuthCompatibility() {
  if (!(await tableExists("users"))) {
    return;
  }

  await pool.query(
    `alter table users add column if not exists password_hash text`,
  );
  await pool.query(`
    create unique index if not exists users_email_lower_unique
    on users (lower(email))
    where email is not null
  `);
}

async function ensureSocialAuthCompatibility() {
  if (!(await tableExists("users"))) {
    return;
  }

  await pool.query(`
    create table if not exists external_identities (
      id varchar primary key default gen_random_uuid(),
      user_id varchar not null references users(id) on delete cascade,
      provider varchar(20) not null,
      subject varchar(255) not null,
      email varchar(254),
      created_at timestamp default now()
    )
  `);
  await pool.query(`
    create unique index if not exists external_identities_provider_subject_unique
    on external_identities (provider, subject)
  `);
  await pool.query(`
    create unique index if not exists external_identities_user_provider_unique
    on external_identities (user_id, provider)
  `);
}

async function ensurePasswordRecoveryCompatibility() {
  if (!(await tableExists("users"))) {
    return;
  }

  await pool.query(`
    create table if not exists password_reset_tokens (
      id varchar primary key default gen_random_uuid(),
      user_id varchar not null references users(id) on delete cascade,
      token_hash varchar(64) not null unique,
      expires_at timestamp not null,
      used_at timestamp,
      created_at timestamp default now()
    )
  `);
  await pool.query(`
    create index if not exists password_reset_tokens_user_idx
    on password_reset_tokens (user_id)
  `);
  await pool.query(`
    create index if not exists password_reset_tokens_expires_idx
    on password_reset_tokens (expires_at)
  `);
}

async function ensureCompanyLicensingCompatibility() {
  if (!(await tableExists("empresas")) || !(await tableExists("users"))) {
    return;
  }

  await pool.query(`
    alter table empresas
      add column if not exists license_plan varchar(20) not null default 'enterprise',
      add column if not exists license_status varchar(20) not null default 'active',
      add column if not exists license_expires_at timestamp,
      add column if not exists license_max_users integer
  `);
  await pool.query(`
    alter table users
      add column if not exists is_owner boolean not null default false,
      add column if not exists invited_at timestamp,
      add column if not exists accepted_at timestamp
  `);
  await pool.query(`
    with companies_without_owner as (
      select empresa_id
      from users
      where empresa_id is not null
      group by empresa_id
      having bool_or(is_owner) = false
    ),
    first_admin as (
      select distinct on (users.empresa_id) users.id
      from users
      inner join companies_without_owner
        on companies_without_owner.empresa_id = users.empresa_id
      where users.role = 'admin'
      order by users.empresa_id, users.created_at, users.id
    )
    update users
    set is_owner = true,
        accepted_at = coalesce(users.accepted_at, users.created_at, now())
    where users.id in (select id from first_admin)
  `);
  await pool.query(`
    update users
    set accepted_at = coalesce(accepted_at, created_at, now())
    where password_hash is not null
      and accepted_at is null
  `);
  await pool.query(`
    create unique index if not exists users_one_owner_per_company
    on users (empresa_id)
    where is_owner = true
  `);
}

async function encryptLegacyColumn(
  tableName: string,
  idColumn: string,
  secretColumn: string,
) {
  if (
    !(await tableExists(tableName)) ||
    !(await columnExists(tableName, secretColumn))
  ) {
    return;
  }

  const result = await pool.query(
    `select "${idColumn}" as id, "${secretColumn}" as secret
     from "${tableName}"
     where "${secretColumn}" is not null`,
  );

  for (const row of result.rows) {
    const secret = String(row.secret ?? "");
    if (!secret || isEncryptedSecret(secret)) {
      continue;
    }
    await pool.query(
      `update "${tableName}"
       set "${secretColumn}" = $1
       where "${idColumn}" = $2`,
      [encryptSecret(secret), row.id],
    );
  }
}

async function ensureSecretsEncrypted() {
  await encryptLegacyColumn("odoo_connections", "id", "api_key");
  await encryptLegacyColumn("microsoft_connections", "id", "access_token");
  await encryptLegacyColumn("microsoft_connections", "id", "refresh_token");
  await encryptLegacyColumn("google_connections", "id", "access_token");
  await encryptLegacyColumn("google_connections", "id", "refresh_token");
  await encryptLegacyColumn("empresas", "id", "openai_api_key");
}

export async function ensureDatabaseCompatibility() {
  try {
    await ensureLegacyEmpresaCompatibility();
    await ensureLeadSyncCompatibility();
    await ensureEmailAuthCompatibility();
    await ensureSocialAuthCompatibility();
    await ensurePasswordRecoveryCompatibility();
    await ensureCompanyLicensingCompatibility();
    await ensureEnvOdooConfiguration();
    await ensureSecretsEncrypted();
  } catch (error) {
    console.error("[bootstrap-db] Failed to ensure database compatibility:", error);
    throw error;
  }
}
