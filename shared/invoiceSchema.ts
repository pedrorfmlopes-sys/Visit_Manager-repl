import { pgTable, varchar, text, boolean, jsonb, timestamp, integer, primaryKey, unique, foreignKey, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { empresas } from './schema';
export const commercialProjects=pgTable('commercial_projects',{
 id:varchar('id').primaryKey(),empresaId:varchar('empresa_id').notNull().references(()=>empresas.id),
 name:text('name').notNull(),reference:text('reference').notNull().default(''),address:text('address').notNull().default(''),description:text('description').notNull().default(''),status:text('status').notNull().default('active'),
 participants:jsonb('participants').notNull().default(sql`'[]'::jsonb`),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[unique().on(t.empresaId,t.id)]);
export const commercialProjectLinks=pgTable('commercial_project_links',{
 empresaId:varchar('empresa_id').notNull(),projectId:varchar('project_id').notNull(),objectType:text('object_type').notNull(),objectId:varchar('object_id').notNull(),
},t=>[primaryKey({columns:[t.empresaId,t.projectId,t.objectType,t.objectId]}),foreignKey({columns:[t.empresaId,t.projectId],foreignColumns:[commercialProjects.empresaId,commercialProjects.id]})]);
export const invoiceConnections=pgTable('invoice_connections',{
 empresaId:varchar('empresa_id').primaryKey().references(()=>empresas.id),enabled:boolean('enabled').notNull().default(false),baseUrl:text('base_url').notNull().default(''),publicUrl:text('public_url').notNull().default(''),tokenEncrypted:text('token_encrypted').notNull().default(''),autoSync:boolean('auto_sync').notNull().default(false),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
});
export const invoiceJobs=pgTable('invoice_jobs',{
 id:varchar('id').primaryKey(),empresaId:varchar('empresa_id').notNull().references(()=>empresas.id),kind:text('kind').notNull(),sourceId:varchar('source_id').notNull(),payload:jsonb('payload').notNull(),state:text('state').notNull().default('pending'),attempts:integer('attempts').notNull().default(0),result:jsonb('result'),error:text('error'),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[index('invoice_jobs_company').on(t.empresaId,t.createdAt)]);
export const invoiceProjectLinks=pgTable('invoice_project_links',{
 empresaId:varchar('empresa_id').notNull(),projectId:varchar('project_id').notNull(),remoteId:text('remote_id').notNull(),snapshot:jsonb('snapshot').notNull().default(sql`'{}'::jsonb`),syncedAt:timestamp('synced_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[primaryKey({columns:[t.empresaId,t.projectId]}),unique().on(t.empresaId,t.remoteId),foreignKey({columns:[t.empresaId,t.projectId],foreignColumns:[commercialProjects.empresaId,commercialProjects.id]})]);
