import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Client } = pg;
const MIGRATION_FILES = [
  "0000_add_ui_settings.sql",
  "0001_flowery_zombie.sql",
  "0002_add-lead-sync-state.sql",
  "0003_add-email-auth.sql",
  "0004_add-social-auth.sql",
  "0005_add-password-recovery.sql",
  "0006_add-company-licensing.sql",
  "0007_add-proximity-alerts.sql",
  "0008_add-planning-indexes.sql",
  "0009_add-odoo-lead-followers.sql",
  "0010_add-entity-research.sql",
  "0011_add-chatter-publishing.sql",
  "0012_invoice-integration.sql",
];

function quoteIdentifier(value: string) {
  if (!/^[a-z0-9_]+$/.test(value)) {
    throw new Error("Unsafe PostgreSQL identifier");
  }
  return `"${value}"`;
}

test("migrations create a complete database from scratch", async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured");

  const schemaName = `migration_test_${randomUUID().replaceAll("-", "")}`;
  const schemaIdentifier = quoteIdentifier(schemaName);
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schemaIdentifier}`);
    await client.query(`SET search_path TO ${schemaIdentifier}`);

    for (const fileName of MIGRATION_FILES) {
      const filePath = path.resolve("migrations", fileName);
      const migration = (await fs.readFile(filePath, "utf8")).replaceAll(
        '"public".',
        `${schemaIdentifier}.`,
      );
      const statements = migration
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);

      for (const statement of statements) {
        try {
          await client.query(statement);
        } catch (error) {
          throw new Error(
            `Migration ${fileName} failed while executing: ${statement.slice(0, 500)}`,
            { cause: error },
          );
        }
      }
    }

    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = $1`,
      [schemaName],
    );
    const tableNames = new Set(tables.rows.map(({ table_name }) => table_name));
    for (const requiredTable of [
      "empresas",
      "users",
      "entidades",
      "contactos",
      "visitas",
      "tarefas",
      "leads",
      "odoo_connections",
      "microsoft_connections",
      "google_connections",
      "external_identities",
      "password_reset_tokens",
      "lead_followers",
      "lead_approval_requests",
    ]) {
      assert.ok(tableNames.has(requiredTable), `Missing table ${requiredTable}`);
    }

    const planningIndexes = await client.query<{ indexname: string }>(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = $1
         AND indexname = ANY($2::text[])`,
      [
        schemaName,
        [
          "visitas_empresa_data_idx",
          "tarefas_empresa_due_idx",
          "tarefas_empresa_unplanned_idx",
        ],
      ],
    );
    assert.equal(planningIndexes.rowCount, 3);

    const leadColumns = await client.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'leads'`,
      [schemaName],
    );
    const leadColumnNames = new Set(
      leadColumns.rows.map(({ column_name }) => column_name),
    );
    for (const requiredColumn of [
      "needs_sync",
      "sync_status",
      "last_sync_at",
      "sync_error",
    ]) {
      assert.ok(
        leadColumnNames.has(requiredColumn),
        `Missing leads.${requiredColumn}`,
      );
    }

    const userColumns = await client.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'users'`,
      [schemaName],
    );
    const userColumnNames = new Set(
      userColumns.rows.map(({ column_name }) => column_name),
    );
    for (const requiredColumn of [
      "password_hash",
      "is_owner",
      "invited_at",
      "accepted_at",
      "odoo_partner_id",
      "odoo_lead_access",
      "odoo_lead_can_create",
      "odoo_lead_can_view_attachments",
      "odoo_lead_can_view_chatter",
      "odoo_lead_can_publish_chatter",
    ]) {
      assert.ok(
        userColumnNames.has(requiredColumn),
        `Missing users.${requiredColumn}`,
      );
    }

    const companyColumns = await client.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'empresas'`,
      [schemaName],
    );
    const companyColumnNames = new Set(
      companyColumns.rows.map(({ column_name }) => column_name),
    );
    for (const requiredColumn of [
      "license_plan",
      "license_status",
      "license_expires_at",
      "license_max_users",
    ]) {
      assert.ok(
        companyColumnNames.has(requiredColumn),
        `Missing empresas.${requiredColumn}`,
      );
    }

    for (const [tableName, columnName] of [
      ["entidades", "proximity_alerts_enabled"],
      ["visitas", "proximity_alerts_enabled"],
    ] as const) {
      const columns = await client.query<{ column_name: string }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2`,
        [schemaName, tableName],
      );
      assert.ok(
        columns.rows.some((column) => column.column_name === columnName),
        `Missing ${tableName}.${columnName}`,
      );
    }
  } finally {
    await client.query("RESET search_path").catch(() => undefined);
    await client
      .query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`)
      .catch(() => undefined);
    await client.end();
  }
});
