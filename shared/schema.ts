import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// ENUMS (must be defined before tables that use them)
// ============================================

// User Role enum
export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'agent'
]);

// Tipo de Entidade enum
export const tipoEntidadeEnum = pgEnum('tipo_entidade', [
  'Gabinete',
  'Distribuidor',
  'Parceiro',
  'Construtor'
]);

// Odoo Sync Status enum
export const syncStatusEnum = pgEnum('sync_status', [
  'pending',
  'synced',
  'error',
  'never'
]);

// Task Status enum
export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'done'
]);

// Task Repeat Interval enum
export const taskRepeatEnum = pgEnum('task_repeat_interval', [
  'none',
  'daily',
  '2days',
  '3days',
  'weekly'
]);

// Reminder Type enum
export const lembreteTipoEnum = pgEnum('lembrete_tipo', [
  'visita_followup',
  'tarefa_overdue',
  'ai_suggestion'
]);

// ============================================
// TABLES
// ============================================

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// NOVO: Empresas (Companies/Tenants) table
export const empresas = pgTable("empresas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: varchar("nome", { length: 255 }).notNull(),
  nif: varchar("nif", { length: 50 }),
  email: varchar("email", { length: 255 }),
  telefone: varchar("telefone", { length: 50 }),
  logoUrl: varchar("logo_url", { length: 500 }),
  mostrarMarcasEmVisitas: boolean("mostrar_marcas_em_visitas").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmpresaSchema = createInsertSchema(empresas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmpresa = z.infer<typeof insertEmpresaSchema>;
export type Empresa = typeof empresas.$inferSelect;

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").notNull().default('agent'),
  ativo: boolean("ativo").default(true).notNull(), // FASE 3: User activation toggle
  empresaId: varchar("empresa_id").references(() => empresas.id, { onDelete: 'cascade' }), // NOVO: FK para empresas
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  empresa: one(empresas, {
    fields: [users.empresaId],
    references: [empresas.id],
  }),
  entidades: many(entidades),
  contactos: many(contactos),
  visitas: many(visitas),
  tarefas: many(tarefas),
  lembretes: many(lembretes),
}));

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// REFAITA: Marcas (Brands) table - agora com empresaId, codigo, ativa
export const marcas = pgTable("marcas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id").notNull().references(() => empresas.id, { onDelete: 'cascade' }), // NOVO
  nome: varchar("nome", { length: 255 }).notNull(),
  codigo: varchar("codigo", { length: 100 }),
  descricao: text("descricao"),
  logoUrl: varchar("logo_url", { length: 500 }),
  ativa: boolean("ativa").default(true).notNull(), // NOVO
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const marcasRelations = relations(marcas, ({ one }) => ({
  empresa: one(empresas, {
    fields: [marcas.empresaId],
    references: [empresas.id],
  }),
}));

export const insertMarcaSchema = createInsertSchema(marcas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMarca = z.infer<typeof insertMarcaSchema>;
export type Marca = typeof marcas.$inferSelect;

// Entidades (Universal Entities) table - replaces Gabinetes
export const entidades = pgTable("entidades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id").notNull().references(() => empresas.id, { onDelete: 'cascade' }), // NOVO
  tipoEntidade: tipoEntidadeEnum("tipo_entidade").notNull().default('Gabinete'),
  nome: varchar("nome", { length: 255 }).notNull(),
  morada: text("morada"),
  cidade: varchar("cidade", { length: 100 }),
  codigoPostal: varchar("codigo_postal", { length: 20 }),
  email: varchar("email", { length: 255 }),
  telefone: varchar("telefone", { length: 50 }),
  website: varchar("website", { length: 500 }),
  notas: text("notas"),
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),
  nif: varchar("nif", { length: 50 }),
  // Enrichment fields (from PT-Intelligent Search / AI)
  logoUrl: varchar("logo_url", { length: 500 }),
  domain: varchar("domain", { length: 255 }),
  industry: varchar("industry", { length: 255 }),
  descricao: text("descricao"),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  facebookUrl: varchar("facebook_url", { length: 500 }),
  twitterUrl: varchar("twitter_url", { length: 500 }),
  instagramUrl: varchar("instagram_url", { length: 500 }),
  xUrl: varchar("x_url", { length: 500 }),
  // Enrichment metadata
  lastEnrichedAt: timestamp("last_enriched_at"),
  enrichmentSource: varchar("enrichment_source", { length: 50 }), // 'fuzzy', 'webscan', 'ai', 'combined', 'none'
  pendingEnrichment: boolean("pending_enrichment").default(false),
  // User Ownership Fields (nullable during migration, will be made required later)
  createdByUserId: varchar("created_by_user_id", { length: 255 }),
  assignedUserId: varchar("assigned_user_id", { length: 255 }),
  // Odoo Integration Fields
  odooEntityId: integer("odoo_entity_id"),
  needsSync: boolean("needs_sync").default(false).notNull(),
  syncStatus: syncStatusEnum("sync_status").default('never'),
  lastSyncAt: timestamp("last_sync_at"),
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Portuguese NIF validation function (mod 11 algorithm)
function validateNIF(value: string): boolean {
  if (!value || value.length !== 9 || !/^\d{9}$/.test(value)) {
    return false;
  }
  
  // Calculate weighted sum of first 8 digits
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += (9 - i) * parseInt(value[i]);
  }
  
  // Calculate mod 11
  const mod = sum % 11;
  
  // Determine expected check digit
  let expectedCheckDigit: number;
  if (mod === 0 || mod === 1) {
    expectedCheckDigit = 0;
  } else {
    expectedCheckDigit = 11 - mod;
  }
  
  // Compare with actual last digit
  return expectedCheckDigit === parseInt(value[8]);
}

export const insertEntidadeSchema = createInsertSchema(entidades).omit({
  id: true,
  empresaId: true, // Set by backend from getUserContext
  createdAt: true,
  updatedAt: true,
  odooEntityId: true,
  needsSync: true,
  syncStatus: true,
  lastSyncAt: true,
  syncError: true,
  lastEnrichedAt: true,
  enrichmentSource: true,
  pendingEnrichment: true,
}).extend({
  // Add validation for coordinates (empty string treated as null)
  latitude: z.string().regex(/^-?([0-9]{1,2}|1[0-7][0-9]|180)(\.[0-9]+)?$/).or(z.literal("")).optional().nullable(),
  longitude: z.string().regex(/^-?([0-9]{1,2}|1[0-7][0-9]|180)(\.[0-9]+)?$/).or(z.literal("")).optional().nullable(),
  // NIF validation (Portuguese tax number - 9 digits with mod 11 check, empty string treated as null)
  nif: z.string()
    .regex(/^[0-9]{9}$/, "NIF deve ter 9 dígitos")
    .refine((val) => validateNIF(val), "NIF inválido - dígito de controlo incorreto")
    .or(z.literal(""))
    .optional()
    .nullable(),
});

export type InsertEntidade = z.infer<typeof insertEntidadeSchema>;
export type Entidade = typeof entidades.$inferSelect;

// Gabinetes (Architecture Offices) table - DEPRECATED, will be removed after migration
export const gabinetes = pgTable("gabinetes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: varchar("nome", { length: 255 }).notNull(),
  morada: text("morada"),
  codigoPostal: varchar("codigo_postal", { length: 20 }),
  cidade: varchar("cidade", { length: 100 }),
  telefone: varchar("telefone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 500 }),
  marcas: text("marcas").array(),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGabineteSchema = createInsertSchema(gabinetes).omit({
  id: true,
  createdAt: true,
});

export type InsertGabinete = z.infer<typeof insertGabineteSchema>;
export type Gabinete = typeof gabinetes.$inferSelect;

// Contactos (Contacts) table
export const contactos = pgTable("contactos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id").notNull().references(() => empresas.id, { onDelete: 'cascade' }), // NOVO
  nome: varchar("nome", { length: 255 }).notNull(),
  funcao: varchar("funcao", { length: 255 }),
  telemovel: varchar("telemovel", { length: 50 }),
  email: varchar("email", { length: 255 }),
  entidadeId: varchar("entidade_id").references(() => entidades.id, { onDelete: 'set null' }),
  gabineteId: varchar("gabinete_id").references(() => gabinetes.id, { onDelete: 'set null' }), // DEPRECATED
  observacoes: text("observacoes"),
  fotoUrl: varchar("foto_url", { length: 500 }),
  // User Ownership Fields (nullable during migration, will be made required later)
  createdByUserId: varchar("created_by_user_id", { length: 255 }),
  assignedUserId: varchar("assigned_user_id", { length: 255 }),
  // Odoo Integration Fields
  odooContactId: integer("odoo_contact_id"),
  needsSync: boolean("needs_sync").default(false).notNull(),
  syncStatus: syncStatusEnum("sync_status").default('never'),
  lastSyncAt: timestamp("last_sync_at"),
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contactosRelations = relations(contactos, ({ one }) => ({
  empresa: one(empresas, {
    fields: [contactos.empresaId],
    references: [empresas.id],
  }),
  entidade: one(entidades, {
    fields: [contactos.entidadeId],
    references: [entidades.id],
  }),
  assignedUser: one(users, {
    fields: [contactos.assignedUserId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [contactos.createdByUserId],
    references: [users.id],
  }),
}));

export const entidadesRelations = relations(entidades, ({ one, many }) => ({
  empresa: one(empresas, {
    fields: [entidades.empresaId],
    references: [empresas.id],
  }),
  contactos: many(contactos),
  visitas: many(visitas),
  assignedUser: one(users, {
    fields: [entidades.assignedUserId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [entidades.createdByUserId],
    references: [users.id],
  }),
}));

export const insertContactoSchema = createInsertSchema(contactos).omit({
  id: true,
  empresaId: true, // Set by backend from getUserContext
  createdAt: true,
  updatedAt: true,
  gabineteId: true, // DEPRECATED - use entidadeId
  odooContactId: true,
  needsSync: true,
  syncStatus: true,
  lastSyncAt: true,
  syncError: true,
});

export type InsertContacto = z.infer<typeof insertContactoSchema>;
export type Contacto = typeof contactos.$inferSelect;

// Visitas (Visits) table
export const visitas = pgTable("visitas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id").notNull().references(() => empresas.id, { onDelete: 'cascade' }), // NOVO
  entidadeId: varchar("entidade_id").references(() => entidades.id, { onDelete: 'set null' }),
  gabineteId: varchar("gabinete_id").references(() => gabinetes.id, { onDelete: 'set null' }), // DEPRECATED
  contactoId: varchar("contacto_id").references(() => contactos.id, { onDelete: 'set null' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Legacy field, use createdByUserId
  dataVisita: timestamp("data_visita").notNull(),
  notas: text("notas"),
  marcasEntregues: text("marcas_entregues").array(),
  audioUrl: varchar("audio_url", { length: 500 }),
  mediaUrls: text("media_urls").array(),
  proximaVisita: timestamp("proxima_visita"),
  linkVisita: varchar("link_visita", { length: 100 }).unique(),
  resumoIa: text("resumo_ia"),
  transcricaoAudio: text("transcricao_audio"),
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),
  locationAccuracy: varchar("location_accuracy", { length: 50 }),
  // User Ownership Fields (nullable during migration, will be made required later)
  createdByUserId: varchar("created_by_user_id", { length: 255 }),
  assignedUserId: varchar("assigned_user_id", { length: 255 }),
  // Odoo Integration Fields
  odooActivityId: integer("odoo_activity_id"),
  needsSync: boolean("needs_sync").default(false).notNull(),
  syncStatus: syncStatusEnum("sync_status").default('never'),
  lastSyncAt: timestamp("last_sync_at"),
  syncError: text("sync_error"),
  // Microsoft 365 Integration Fields
  outlookEventId: varchar("outlook_event_id", { length: 255 }),
  lastCalendarSyncAt: timestamp("last_calendar_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const visitasRelations = relations(visitas, ({ one, many }) => ({
  empresa: one(empresas, {
    fields: [visitas.empresaId],
    references: [empresas.id],
  }),
  entidade: one(entidades, {
    fields: [visitas.entidadeId],
    references: [entidades.id],
  }),
  contacto: one(contactos, {
    fields: [visitas.contactoId],
    references: [contactos.id],
  }),
  user: one(users, {
    fields: [visitas.userId],
    references: [users.id],
  }),
  assignedUser: one(users, {
    fields: [visitas.assignedUserId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [visitas.createdByUserId],
    references: [users.id],
  }),
  marcas: many(visitasMarcas),
  audio: many(visitasAudio),
}));

export const insertVisitaSchema = createInsertSchema(visitas).omit({
  id: true,
  empresaId: true, // Set by backend from getUserContext
  userId: true, // Legacy field, use createdByUserId (backend sets)
  createdByUserId: true, // Set by backend from getUserContext
  assignedUserId: true, // Optional, set by backend
  createdAt: true,
  updatedAt: true,
  linkVisita: true,
  resumoIa: true,
  transcricaoAudio: true,
  gabineteId: true, // DEPRECATED - use entidadeId
  odooActivityId: true,
  needsSync: true,
  syncStatus: true,
  lastSyncAt: true,
  syncError: true,
  outlookEventId: true,
  lastCalendarSyncAt: true,
});

export type InsertVisita = z.infer<typeof insertVisitaSchema>;
export type Visita = typeof visitas.$inferSelect;

// FASE 5: Visitas Marcas (relationship table)
export const visitasMarcas = pgTable("visitas_marcas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitaId: varchar("visita_id").notNull().references(() => visitas.id, { onDelete: 'cascade' }),
  marcaId: varchar("marca_id").notNull().references(() => marcas.id, { onDelete: 'cascade' }),
  empresaId: varchar("empresa_id").notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const visitasMarcasRelations = relations(visitasMarcas, ({ one }) => ({
  visita: one(visitas, {
    fields: [visitasMarcas.visitaId],
    references: [visitas.id],
  }),
  marca: one(marcas, {
    fields: [visitasMarcas.marcaId],
    references: [marcas.id],
  }),
  empresa: one(empresas, {
    fields: [visitasMarcas.empresaId],
    references: [empresas.id],
  }),
}));

// FASE 6: Visitas Audio (multiple audio clips per visit with transcription)
export const visitasAudio = pgTable("visitas_audio", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitaId: varchar("visita_id").notNull().references(() => visitas.id, { onDelete: 'cascade' }),
  empresaId: varchar("empresa_id").notNull().references(() => empresas.id, { onDelete: 'cascade' }),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  transcricao: text("transcricao"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const visitasAudioRelations = relations(visitasAudio, ({ one }) => ({
  visita: one(visitas, {
    fields: [visitasAudio.visitaId],
    references: [visitas.id],
  }),
  empresa: one(empresas, {
    fields: [visitasAudio.empresaId],
    references: [empresas.id],
  }),
}));

export const insertVisitasAudioSchema = createInsertSchema(visitasAudio).omit({
  id: true,
  empresaId: true,
  createdAt: true,
});

export type InsertVisitasAudio = z.infer<typeof insertVisitasAudioSchema>;
export type VisitasAudio = typeof visitasAudio.$inferSelect;

// Tarefas (Tasks) table
export const tarefas = pgTable("tarefas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id").notNull().references(() => empresas.id, { onDelete: 'cascade' }), // NOVO
  titulo: varchar("titulo", { length: 500 }).notNull(),
  descricao: text("descricao"),
  visitaId: varchar("visita_id").references(() => visitas.id, { onDelete: 'set null' }),
  entidadeId: varchar("entidade_id").references(() => entidades.id, { onDelete: 'set null' }),
  createdByUserId: varchar("created_by_user_id", { length: 255 }).notNull(),
  assignedUserId: varchar("assigned_user_id", { length: 255 }),
  dueDate: timestamp("due_date"),
  repeatInterval: taskRepeatEnum("repeat_interval").default('none').notNull(),
  status: taskStatusEnum("status").default('pending').notNull(),
  // Odoo Integration Fields
  odooTaskId: integer("odoo_task_id"),
  needsSync: boolean("needs_sync").default(false).notNull(),
  syncStatus: syncStatusEnum("sync_status").default('never'),
  lastSyncAt: timestamp("last_sync_at"),
  syncError: text("sync_error"),
  // Microsoft 365 Integration Fields
  plannerTaskId: varchar("planner_task_id", { length: 255 }),
  plannerPlanId: varchar("planner_plan_id", { length: 255 }),
  plannerBucketId: varchar("planner_bucket_id", { length: 255 }),
  lastPlannerSyncAt: timestamp("last_planner_sync_at"),
  todoTaskId: varchar("todo_task_id", { length: 255 }),
  lastTodoSyncAt: timestamp("last_todo_sync_at"),
  microsoftUserId: varchar("microsoft_user_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tarefasRelations = relations(tarefas, ({ one }) => ({
  empresa: one(empresas, {
    fields: [tarefas.empresaId],
    references: [empresas.id],
  }),
  visita: one(visitas, {
    fields: [tarefas.visitaId],
    references: [visitas.id],
  }),
  entidade: one(entidades, {
    fields: [tarefas.entidadeId],
    references: [entidades.id],
  }),
  assignedUser: one(users, {
    fields: [tarefas.assignedUserId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [tarefas.createdByUserId],
    references: [users.id],
  }),
}));

export const insertTarefaSchema = createInsertSchema(tarefas).omit({
  id: true,
  empresaId: true, // Set by backend from getUserContext
  createdByUserId: true, // Set by backend from getUserContext
  assignedUserId: true, // Optional, set by backend
  createdAt: true,
  updatedAt: true,
  odooTaskId: true,
  needsSync: true,
  syncStatus: true,
  lastSyncAt: true,
  syncError: true,
  plannerTaskId: true,
  plannerPlanId: true,
  plannerBucketId: true,
  lastPlannerSyncAt: true,
  todoTaskId: true,
  lastTodoSyncAt: true,
  microsoftUserId: true,
}).extend({
  descricao: z.string().trim().nullable().optional(),
  dueDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional().nullable(),
});

export type InsertTarefa = z.infer<typeof insertTarefaSchema>;
export type Tarefa = typeof tarefas.$inferSelect;

// Lembretes (Reminders) table
export const lembretes = pgTable("lembretes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id").notNull().references(() => empresas.id, { onDelete: 'cascade' }), // NOVO
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  entidadeId: varchar("entidade_id").references(() => entidades.id, { onDelete: 'cascade' }),
  visitaId: varchar("visita_id").references(() => visitas.id, { onDelete: 'cascade' }),
  tarefaId: varchar("tarefa_id").references(() => tarefas.id, { onDelete: 'cascade' }),
  tipo: lembreteTipoEnum("tipo").notNull(),
  mensagem: text("mensagem").notNull(),
  dataCriacao: timestamp("data_criacao").defaultNow().notNull(),
  dataVencimento: timestamp("data_vencimento"),
  snoozedUntil: timestamp("snoozed_until"),
  resolved: boolean("resolved").default(false).notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const lembretesRelations = relations(lembretes, ({ one }) => ({
  empresa: one(empresas, {
    fields: [lembretes.empresaId],
    references: [empresas.id],
  }),
  user: one(users, {
    fields: [lembretes.userId],
    references: [users.id],
  }),
  entidade: one(entidades, {
    fields: [lembretes.entidadeId],
    references: [entidades.id],
  }),
  visita: one(visitas, {
    fields: [lembretes.visitaId],
    references: [visitas.id],
  }),
  tarefa: one(tarefas, {
    fields: [lembretes.tarefaId],
    references: [tarefas.id],
  }),
}));

export const insertLembreteSchema = createInsertSchema(lembretes).omit({
  id: true,
  dataCriacao: true,
});

export type InsertLembrete = z.infer<typeof insertLembreteSchema>;
export type Lembrete = typeof lembretes.$inferSelect;

// Microsoft 365 Tokens table (per-user OAuth tokens)
export const microsoftTokens = pgTable("microsoft_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text("access_token").notNull(), // Encrypted
  refreshToken: text("refresh_token").notNull(), // Encrypted
  scopes: text("scopes").notNull(), // JSON array of granted scopes
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const microsoftTokensRelations = relations(microsoftTokens, ({ one }) => ({
  user: one(users, {
    fields: [microsoftTokens.userId],
    references: [users.id],
  }),
}));

export const insertMicrosoftTokenSchema = createInsertSchema(microsoftTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMicrosoftToken = z.infer<typeof insertMicrosoftTokenSchema>;
export type MicrosoftToken = typeof microsoftTokens.$inferSelect;

// Extended types for relations
export type EmpresaWithRelations = Empresa & {
  users?: User[];
  marcas?: Marca[];
  entidades?: Entidade[];
  contactos?: Contacto[];
  visitas?: Visita[];
  tarefas?: Tarefa[];
  lembretes?: Lembrete[];
};

export type EntidadeWithRelations = Entidade & {
  empresa?: Empresa;
  contactos?: Contacto[];
  visitas?: Visita[];
  assignedUser?: User | null;
  createdByUser?: User | null;
};

export type GabineteWithRelations = Gabinete & {
  contactos?: Contacto[];
  visitas?: Visita[];
};

export type ContactoWithRelations = Contacto & {
  empresa?: Empresa;
  entidade?: Entidade | null;
  gabinete?: Gabinete | null;
  assignedUser?: User | null;
  createdByUser?: User | null;
};

export type VisitaWithRelations = Visita & {
  empresa?: Empresa;
  entidade?: Entidade | null;
  gabinete?: Gabinete | null;
  contacto?: Contacto | null;
  user?: User;
  assignedUser?: User | null;
  createdByUser?: User | null;
};

export type TarefaWithRelations = Tarefa & {
  empresa?: Empresa;
  visita?: Visita | null;
  entidade?: Entidade | null;
  assignedUser?: User | null;
  createdByUser?: User | null;
};

export type LembreteWithRelations = Lembrete & {
  empresa?: Empresa;
  user?: User;
  entidade?: Entidade | null;
  visita?: Visita | null;
  tarefa?: Tarefa | null;
};
