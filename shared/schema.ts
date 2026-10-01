import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  index,
  uniqueIndex,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  pgEnum,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export * from './invoiceSchema';

// ============================================
// FASE SS-01: Search Result Types
// ============================================
export type SearchResult<T = any> = {
  id: string;
  label: string;
  extraInfo?: string | null;
  data?: T;
};

export type EntidadeSearchResult = SearchResult<{
  cidade?: string;
  nif?: string;
}>;
export type ContactoSearchResult = SearchResult<{
  entidadeNome?: string;
  email?: string;
}>;
export type VisitaSearchResult = SearchResult<{
  entidadeNome?: string;
  date?: string;
}>;

// ============================================
// ENUMS
// ============================================

export const userRoleEnum = pgEnum("user_role", ["admin", "agent"]);

export const tipoEntidadeEnum = pgEnum("tipo_entidade", [
  "Gabinete",
  "Distribuidor",
  "Parceiro",
  "Construtor",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "pending",
  "synced",
  "error",
  "never",
]);

export const taskStatusEnum = pgEnum("task_status", ["pending", "done"]);

export const taskRepeatEnum = pgEnum("task_repeat_interval", [
  "none",
  "daily",
  "2days",
  "3days",
  "weekly",
]);

export const lembreteTipoEnum = pgEnum("lembrete_tipo", [
  "visita_followup",
  "tarefa_overdue",
  "ai_suggestion",
]);

// ============================================
// TABLES
// ============================================

// Sessions
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Empresas
export const empresas = pgTable("empresas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: varchar("nome", { length: 255 }).notNull(),
  licensePlan: varchar("license_plan", { length: 20 })
    .notNull()
    .default("enterprise"),
  licenseStatus: varchar("license_status", { length: 20 })
    .notNull()
    .default("active"),
  licenseExpiresAt: timestamp("license_expires_at"),
  licenseMaxUsers: integer("license_max_users"),
  nif: varchar("nif", { length: 50 }),
  email: varchar("email", { length: 255 }),
  telefone: varchar("telefone", { length: 50 }),
  logoUrl: varchar("logo_url", { length: 500 }),
  mostrarMarcasEmVisitas: boolean("mostrar_marcas_em_visitas")
    .default(false)
    .notNull(),
  mostrarGPS: boolean("mostrar_gps").default(false).notNull(),
  theme: varchar("theme", { length: 50 })
    .default("light-business")
    .notNull(),
  openai_api_key: text("openai_api_key"),
  uiSettings: jsonb("ui_settings").default(sql`'{
    "mostrarGPS": false,
    "mostrarMarcasEmVisitas": false,
    "enableIA": true,
    "enableAudio": true,
    "enableAudioTranscription": true,
    "enableFollowups": true,
    "enableAlertRibbon": true,
    "enableBadges": true,
    "refreshInterval": 60,
    "ia": {
      "aiEnabled": true,
      "aiKeyMode": "global"
    },
    "entidades": {
      "enableFilterTipoEntidade": true,
      "enableFilterSearch": true
    },
    "contactos": {
      "enableFilterEntidade": true,
      "enableFilterCargo": true,
      "enableFilterSearch": true
    },
    "visitas": {
      "enableFilterDateQuick": true,
      "enableFilterUser": true,
      "enableFilterMarca": true,
      "enableFilterEntidade": true,
      "enableFilterContacto": true,
      "enableFilterHasAudio": true,
      "multiContactosEnabled": false
    },
    "tarefas": {
      "enableFilterStatus": true,
      "enableFilterOverdue": true,
      "enableFilterAssignedUser": true,
      "enableFilterEntidade": true,
      "enableFilterVisita": true
    }
  }'`),

  // Odoo CRM global
  odooCrmEnabled: boolean("odoo_crm_enabled").notNull().default(true),

  // Módulo de Leads CRM
  crmLeadsEnabled: boolean("crm_leads_enabled").notNull().default(false),

  // 3 níveis de contactos Odoo
  odooContactsFeatureEnabled: boolean("odoo_contacts_feature_enabled")
    .notNull()
    .default(false),

  odooContactsAdminEnabled: boolean("odoo_contacts_admin_enabled")
    .notNull()
    .default(true),

  odooContactsAgentsEnabled: boolean("odoo_contacts_agents_enabled")
    .notNull()
    .default(false),

  odooContactsNoPermissionMessage: text(
    "odoo_contacts_no_permission_message",
  ),

  crmVisitsOdooSyncEnabled: boolean("crm_visits_odoo_sync_enabled")
    .notNull()
    .default(false),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmpresaSchema = createInsertSchema(empresas)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    theme: z.enum(["light-business", "dark-pro"]).optional(),
    mostrarGPS: z.boolean().optional(),
  });

export type InsertEmpresa = z.infer<typeof insertEmpresaSchema>;
export type Empresa = typeof empresas.$inferSelect;

// Users
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: text("password_hash"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").notNull().default("agent"),
  ativo: boolean("ativo").default(true).notNull(),
  isOwner: boolean("is_owner").default(false).notNull(),
  invitedAt: timestamp("invited_at"),
  acceptedAt: timestamp("accepted_at"),
  empresaId: varchar("empresa_id").references(() => empresas.id, {
    onDelete: "cascade",
  }),
  odooPartnerId: varchar("odoo_partner_id"),
  odooLeadAccess: varchar("odoo_lead_access", { length: 20 })
    .notNull()
    .default("view"),
  odooLeadCanCreate: boolean("odoo_lead_can_create").notNull().default(false),
  odooLeadCanViewAttachments: boolean("odoo_lead_can_view_attachments")
    .notNull()
    .default(false),
  odooLeadCanViewChatter: boolean("odoo_lead_can_view_chatter")
    .notNull()
    .default(false),
  odooLeadCanPublishChatter: boolean("odoo_lead_can_publish_chatter")
    .notNull()
    .default(false),
  userSettings: jsonb("user_settings").default(sql`'{
    "homePage": "dashboard",
    "listDensity": "comfortable",
    "ia": {
      "showVisitSummary": true,
      "showTaskSuggestions": true,
      "showDashboardInsights": true
    },
    "notifications": {
      "emailTaskReminders": false,
      "emailVisitReminders": false
    }
  }'`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const externalIdentities = pgTable(
  "external_identities",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 20 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    email: varchar("email", { length: 254 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("external_identities_provider_subject_unique").on(
      table.provider,
      table.subject,
    ),
    uniqueIndex("external_identities_user_provider_unique").on(
      table.userId,
      table.provider,
    ),
  ],
);

export type ExternalIdentity = typeof externalIdentities.$inferSelect;

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("password_reset_tokens_user_idx").on(table.userId),
    index("password_reset_tokens_expires_idx").on(table.expiresAt),
  ],
);

// User settings schema
export const userSettingsSchema = z
  .object({
    homePage: z
      .enum(["dashboard", "hoje", "visitas", "tarefas"])
      .default("dashboard"),
    listDensity: z
      .enum(["comfortable", "compact"])
      .default("comfortable"),
    ia: z
      .object({
        showVisitSummary: z.boolean().default(true),
        showTaskSuggestions: z.boolean().default(true),
        showDashboardInsights: z.boolean().default(true),
      })
      .default({})
      .optional(),
    notifications: z
      .object({
        emailTaskReminders: z.boolean().default(false),
        emailVisitReminders: z.boolean().default(false),
      })
      .default({})
      .optional(),
    visitasUi: z
      .object({
        showAdvancedFilters: z.boolean().default(true),
      })
      .default({})
      .optional(),
    onboarding: z
      .object({
        seenDashboardTips: z.boolean().default(false),
        seenVisitsTips: z.boolean().default(false),
      })
      .default({})
      .optional(),
    entitySearch: z
      .object({
        hideAiFallbackPrompt: z.boolean().default(false),
      })
      .default({})
      .optional(),
  })
  .partial()
  .default({});

export type UserSettings = z.infer<typeof userSettingsSchema>;

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

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
  externalIdentities: many(externalIdentities),
  passwordResetTokens: many(passwordResetTokens),
}));

export const externalIdentitiesRelations = relations(
  externalIdentities,
  ({ one }) => ({
    user: one(users, {
      fields: [externalIdentities.userId],
      references: [users.id],
    }),
  }),
);

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

// Response type for GET /api/user/settings
export const userSettingsResponseSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string().optional(),
  role: z.enum(["admin", "agent"]),
  empresaNome: z.string(),
  userSettings: userSettingsSchema,
});

export type UserSettingsResponse = z.infer<
  typeof userSettingsResponseSchema
>;

// Entidade Tipos
export const entidadeTipos = pgTable("entidade_tipos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id")
    .notNull()
    .references(() => empresas.id, { onDelete: "cascade" }),
  nome: varchar("nome", { length: 255 }).notNull(),
  cor: varchar("cor", { length: 20 }),
  icon: varchar("icon", { length: 50 }).default("Building2"),
  ativo: boolean("ativo").default(true).notNull(),
  ordem: integer("ordem").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const entidadeTiposRelations = relations(
  entidadeTipos,
  ({ one, many }) => ({
    empresa: one(empresas, {
      fields: [entidadeTipos.empresaId],
      references: [empresas.id],
    }),
    entidades: many(entidades),
  }),
);

export const entidadeTipoIconEnum = z.enum([
  "Building2",
  "Store",
  "Factory",
  "Briefcase",
  "Users",
  "Home",
  "Handshake",
  "Package",
]);

export const insertEntidadeTipoSchema = createInsertSchema(entidadeTipos)
  .omit({
    id: true,
    empresaId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    icon: entidadeTipoIconEnum.optional(),
  });

export type InsertEntidadeTipo = z.infer<typeof insertEntidadeTipoSchema>;
export type EntidadeTipo = typeof entidadeTipos.$inferSelect;

// Marcas
export const marcas = pgTable("marcas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id")
    .notNull()
    .references(() => empresas.id, { onDelete: "cascade" }),
  nome: varchar("nome", { length: 255 }).notNull(),
  codigo: varchar("codigo", { length: 100 }),
  descricao: text("descricao"),
  logoUrl: varchar("logo_url", { length: 500 }),
  ativa: boolean("ativa").default(true).notNull(),
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

// Entidades
export const entidades = pgTable("entidades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id")
    .notNull()
    .references(() => empresas.id, { onDelete: "cascade" }),
  entidadeTipoId: varchar("entidade_tipo_id").references(
    () => entidadeTipos.id,
    { onDelete: "set null" },
  ),
  tipoEntidade: tipoEntidadeEnum("tipo_entidade")
    .notNull()
    .default("Gabinete"),
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
  proximityAlertsEnabled: boolean("proximity_alerts_enabled")
    .default(false)
    .notNull(),
  nif: varchar("nif", { length: 50 }),
  logoUrl: varchar("logo_url", { length: 500 }),
  domain: varchar("domain", { length: 255 }),
  industry: varchar("industry", { length: 255 }),
  descricao: text("descricao"),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  facebookUrl: varchar("facebook_url", { length: 500 }),
  twitterUrl: varchar("twitter_url", { length: 500 }),
  instagramUrl: varchar("instagram_url", { length: 500 }),
  xUrl: varchar("x_url", { length: 500 }),
  countryCode: varchar("country_code", { length: 2 }).notNull().default("PT"),
  vatValidationStatus: varchar("vat_validation_status", { length: 30 }),
  vatValidatedAt: timestamp("vat_validated_at"),
  lastEnrichedAt: timestamp("last_enriched_at"),
  enrichmentSource: varchar("enrichment_source", { length: 50 }),
  pendingEnrichment: boolean("pending_enrichment").default(false),
  createdByUserId: varchar("created_by_user_id", { length: 255 }),
  assignedUserId: varchar("assigned_user_id", { length: 255 }),
  odooEntityId: integer("odoo_entity_id"),
  odooPartnerId: text("odoo_partner_id"),
  needsSync: boolean("needs_sync").default(false).notNull(),
  syncStatus: syncStatusEnum("sync_status").default("never"),
  lastSyncAt: timestamp("last_sync_at"),
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// NIF validation
function validateNIF(value: string): boolean {
  if (!value || value.length !== 9 || !/^\d{9}$/.test(value)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += (9 - i) * parseInt(value[i]);
  }

  const mod = sum % 11;
  let expectedCheckDigit: number;
  if (mod === 0 || mod === 1) {
    expectedCheckDigit = 0;
  } else {
    expectedCheckDigit = 11 - mod;
  }

  return expectedCheckDigit === parseInt(value[8]);
}

export const insertEntidadeSchema = createInsertSchema(entidades)
  .omit({
    id: true,
    empresaId: true,
    createdAt: true,
    updatedAt: true,
    odooEntityId: true,
    odooPartnerId: true,
    needsSync: true,
    syncStatus: true,
    lastSyncAt: true,
    syncError: true,
    vatValidationStatus: true,
    vatValidatedAt: true,
    lastEnrichedAt: true,
    enrichmentSource: true,
    pendingEnrichment: true,
  })
  .extend({
    entidadeTipoId: z.string().uuid().optional().nullable(),
    latitude: z
      .string()
      .regex(
        /^-?([0-9]{1,2}|1[0-7][0-9]|180)(\.[0-9]+)?$/,
      )
      .or(z.literal(""))
      .optional()
      .nullable(),
    longitude: z
      .string()
      .regex(
        /^-?([0-9]{1,2}|1[0-7][0-9]|180)(\.[0-9]+)?$/,
      )
      .or(z.literal(""))
      .optional()
      .nullable(),
    countryCode: z.string().length(2).default("PT"),
    selectedOdooPartnerId: z.number().int().positive().optional().nullable(),
    validatedVatStatus: z.enum(["valid", "invalid"]).optional().nullable(),
    nif: z
      .string()
      .max(50, "Identificação fiscal demasiado longa")
      .regex(/^[A-Za-z0-9 .\-/]*$/, "Identificação fiscal inválida")
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    const countryCode = data.countryCode?.toUpperCase() || "PT";
    const taxNumber = (data.nif ?? "").replace(/^PT/i, "").replace(/\s/g, "");
    if (countryCode === "PT" && taxNumber && !validateNIF(taxNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nif"],
        message: "NIF inválido - use 9 dígitos com dígito de controlo correto",
      });
    }
  });

export type InsertEntidade = z.infer<typeof insertEntidadeSchema>;
export type Entidade = typeof entidades.$inferSelect;

// Gabinetes (deprecated)
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

// Contactos
export const contactos = pgTable("contactos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id")
    .notNull()
    .references(() => empresas.id, { onDelete: "cascade" }),
  nome: varchar("nome", { length: 255 }).notNull(),
  funcao: varchar("funcao", { length: 255 }),
  telemovel: varchar("telemovel", { length: 50 }),
  email: varchar("email", { length: 255 }),
  entidadeId: varchar("entidade_id").references(() => entidades.id, {
    onDelete: "set null",
  }),
  gabineteId: varchar("gabinete_id").references(() => gabinetes.id, {
    onDelete: "set null",
  }),
  observacoes: text("observacoes"),
  fotoUrl: varchar("foto_url", { length: 500 }),
  createdByUserId: varchar("created_by_user_id", { length: 255 }),
  assignedUserId: varchar("assigned_user_id", { length: 255 }),
  odooContactId: integer("odoo_contact_id"),
  odooPartnerId: text("odoo_partner_id"),
  needsSync: boolean("needs_sync").default(false).notNull(),
  syncStatus: syncStatusEnum("sync_status").default("never"),
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
  entidadeTipo: one(entidadeTipos, {
    fields: [entidades.entidadeTipoId],
    references: [entidadeTipos.id],
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
  empresaId: true,
  createdAt: true,
  updatedAt: true,
  gabineteId: true,
  odooContactId: true,
  odooPartnerId: true,
  needsSync: true,
  syncStatus: true,
  lastSyncAt: true,
  syncError: true,
});

export type InsertContacto = z.infer<typeof insertContactoSchema>;
export type Contacto = typeof contactos.$inferSelect;

// Visitas
export const visitas: any = pgTable("visitas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id")
    .notNull()
    .references(() => empresas.id, { onDelete: "cascade" }),
  entidadeId: varchar("entidade_id").references(() => entidades.id, {
    onDelete: "set null",
  }),
  gabineteId: varchar("gabinete_id").references(() => gabinetes.id, {
    onDelete: "set null",
  }),
  contactoId: varchar("contacto_id").references(() => contactos.id, {
    onDelete: "set null",
  }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  dataVisita: timestamp("data_visita").notNull(),
  notas: text("notas"),
  marcasEntregues: text("marcas_entregues").array(),
  audioUrl: varchar("audio_url", { length: 500 }),
  mediaUrls: text("media_urls").array(),
  proximaVisita: timestamp("proxima_visita"),
  proximaVisitaStatus: varchar("proxima_visita_status", { length: 50 }).default(
    "agendada",
  ),
  proximaVisitaStatusData: timestamp("proxima_visita_status_data"),
  visitaAnteriorId: varchar("visita_anterior_id").references(
    () => visitas.id,
    { onDelete: "set null" },
  ),
  linkVisita: varchar("link_visita", { length: 100 }).unique(),
  resumoIa: text("resumo_ia"),
  pontosChaveIA: text("pontos_chave_ia"),
  tarefasSugeridasIA: text("tarefas_sugeridas_ia"),
  iaLastGeneratedAt: timestamp("ia_last_generated_at"),
  transcricaoAudio: text("transcricao_audio"),
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),
  locationAccuracy: varchar("location_accuracy", { length: 50 }),
  proximityAlertsEnabled: boolean("proximity_alerts_enabled")
    .default(false)
    .notNull(),
  createdByUserId: varchar("created_by_user_id", { length: 255 }),
  assignedUserId: varchar("assigned_user_id", { length: 255 }),
  odooActivityId: integer("odoo_activity_id"),
  needsSync: boolean("needs_sync").default(false).notNull(),
  syncStatus: syncStatusEnum("sync_status").default("never"),
  lastSyncAt: timestamp("last_sync_at"),
  syncError: text("sync_error"),
  outlookEventId: varchar("outlook_event_id", { length: 255 }),
  lastCalendarSyncAt: timestamp("last_calendar_sync_at"),
  odooLeadId: text("odoo_lead_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("visitas_empresa_data_idx").on(table.empresaId, table.dataVisita),
]);

export const visitasRelations = relations(
  visitas,
  ({ one, many }): any => ({
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
    visitaAnterior: one(visitas, {
      fields: [visitas.visitaAnteriorId],
      references: [visitas.id],
      relationName: "previousVisit",
    }),
    visitasPosteriores: many(visitas, {
      relationName: "previousVisit",
    }),
    marcas: many(visitasMarcas),
    audio: many(visitasAudio),
    contactos: many(visitasContactos),
  }),
);

export const insertVisitaSchema = createInsertSchema(visitas)
  .omit({
    id: true,
    empresaId: true,
    userId: true,
    createdByUserId: true,
    assignedUserId: true,
    visitaAnteriorId: true,
    createdAt: true,
    updatedAt: true,
    linkVisita: true,
    resumoIa: true,
    pontosChaveIA: true,
    tarefasSugeridasIA: true,
    iaLastGeneratedAt: true,
    transcricaoAudio: true,
    gabineteId: true,
    odooActivityId: true,
    odooLeadId: true,
    needsSync: true,
    syncStatus: true,
    lastSyncAt: true,
    syncError: true,
    outlookEventId: true,
    lastCalendarSyncAt: true,
    proximaVisitaStatus: true,
    proximaVisitaStatusData: true,
  })
  .extend({
    contactosIds: z.array(z.string().uuid()).optional(),
  });

export type InsertVisita = z.infer<typeof insertVisitaSchema>;
export type Visita = typeof visitas.$inferSelect;

// Leads
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  empresaId: varchar("empresa_id")
    .notNull()
    .references(() => empresas.id, { onDelete: "cascade" }),

  entidadeId: varchar("entidade_id").references(() => entidades.id, {
    onDelete: "cascade",
  }),

  contactoId: varchar("contacto_id").references(() => contactos.id, {
    onDelete: "cascade",
  }),

  visitaId: varchar("visita_id").references(() => visitas.id, {
    onDelete: "set null",
  }),

  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  descricaoHtml: text("descricao_html"),
  tipoLead: text("tipo_lead"),

  marca: text("marca"),

  estado: text("estado").notNull().default("novo"),

  valorPrevisto: numeric("valor_previsto"),
  moeda: varchar("moeda", { length: 3 }).default("EUR"),

  responsavelUserId: varchar("responsavel_user_id"),

  odooLeadId: varchar("odoo_lead_id"),
  needsSync: boolean("needs_sync").default(false).notNull(),
  syncStatus: syncStatusEnum("sync_status").default("never"),
  lastSyncAt: timestamp("last_sync_at"),
  syncError: text("sync_error"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Leads Contactos
export const leadsContactos = pgTable("leads_contactos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  contactoId: varchar("contacto_id")
    .notNull()
    .references(() => contactos.id, { onDelete: "cascade" }),
  role: text("role"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Leads Marcas
export const leadsMarcas = pgTable("leads_marcas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  marcaId: varchar("marca_id")
    .notNull()
    .references(() => marcas.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leadFollowers = pgTable(
  "lead_followers",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    empresaId: varchar("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    leadId: varchar("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    odooPartnerId: varchar("odoo_partner_id"),
    source: varchar("source", { length: 20 }).notNull().default("odoo"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("lead_followers_lead_user_unique").on(
      table.leadId,
      table.userId,
    ),
    index("lead_followers_empresa_user_idx").on(
      table.empresaId,
      table.userId,
    ),
  ],
);

export const leadApprovalRequests = pgTable(
  "lead_approval_requests",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    empresaId: varchar("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    leadId: varchar("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    requestedByUserId: varchar("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestType: varchar("request_type", { length: 20 }).notNull(),
    proposedChanges: jsonb("proposed_changes").notNull(),
    baseOdooWriteDate: varchar("base_odoo_write_date"),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    reviewerUserId: varchar("reviewer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewComment: text("review_comment"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    adminSeenAt: timestamp("admin_seen_at", { withTimezone: true }),
    agentSeenAt: timestamp("agent_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("lead_approval_empresa_status_idx").on(
      table.empresaId,
      table.status,
      table.createdAt,
    ),
    index("lead_approval_requester_idx").on(
      table.requestedByUserId,
      table.createdAt,
    ),
  ],
);

export const leadsRelations = relations(leads, ({ one, many }) => ({
  empresa: one(empresas, {
    fields: [leads.empresaId],
    references: [empresas.id],
  }),
  entidade: one(entidades, {
    fields: [leads.entidadeId],
    references: [entidades.id],
  }),
  contacto: one(contactos, {
    fields: [leads.contactoId],
    references: [contactos.id],
  }),
  visita: one(visitas, {
    fields: [leads.visitaId],
    references: [visitas.id],
  }),
  contactosAssociados: many(leadsContactos),
  marcasAssociadas: many(leadsMarcas),
}));

export const leadsContactosRelations = relations(
  leadsContactos,
  ({ one }) => ({
    lead: one(leads, {
      fields: [leadsContactos.leadId],
      references: [leads.id],
    }),
    contacto: one(contactos, {
      fields: [leadsContactos.contactoId],
      references: [contactos.id],
    }),
  }),
);

export const leadsMarcasRelations = relations(leadsMarcas, ({ one }) => ({
  lead: one(leads, {
    fields: [leadsMarcas.leadId],
    references: [leads.id],
  }),
  marca: one(marcas, {
    fields: [leadsMarcas.marcaId],
    references: [marcas.id],
  }),
}));

export const insertLeadSchema = createInsertSchema(leads)
  .omit({
    id: true,
    empresaId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    titulo: z.string().min(1, "Título obrigatório"),
    entidadeId: z.string().uuid("ID entidade inválido").optional().nullable(),
    contactoId: z.string().uuid("ID contacto inválido").optional().nullable(),
    visitaId: z.string().uuid().optional().nullable(),
    descricao: z.string().optional().nullable(),
    descricaoHtml: z.string().optional().nullable(),
    tipoLead: z.string().optional().nullable(),
    marca: z.string().optional().nullable(),
    estado: z.string().default("novo"),
    valorPrevisto: z.string().or(z.number()).optional().nullable(),
    moeda: z.string().length(3).default("EUR"),
    responsavelUserId: z.string().optional().nullable(),
    odooLeadId: z.string().optional().nullable(),
    contactosIds: z.array(z.string().uuid()).optional(),
    marcasIds: z.array(z.string().uuid()).optional(),
  });

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export const insertLeadsContactosSchema = createInsertSchema(
  leadsContactos,
).omit({
  id: true,
  createdAt: true,
});
export type InsertLeadsContactos = z.infer<
  typeof insertLeadsContactosSchema
>;
export type LeadsContactos = typeof leadsContactos.$inferSelect;

export const insertLeadsMarcasSchema = createInsertSchema(leadsMarcas).omit({
  id: true,
  createdAt: true,
});
export type InsertLeadsMarcas = z.infer<typeof insertLeadsMarcasSchema>;
export type LeadsMarcas = typeof leadsMarcas.$inferSelect;

// Visitas Marcas
export const visitasMarcas = pgTable("visitas_marcas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitaId: varchar("visita_id")
    .notNull()
    .references(() => visitas.id, { onDelete: "cascade" }),
  marcaId: varchar("marca_id")
    .notNull()
    .references(() => marcas.id, { onDelete: "cascade" }),
  empresaId: varchar("empresa_id")
    .notNull()
    .references(() => empresas.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const visitasMarcasRelations = relations(
  visitasMarcas,
  ({ one }) => ({
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
  }),
);

// Visitas Audio
export const visitasAudio = pgTable("visitas_audio", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitaId: varchar("visita_id")
    .notNull()
    .references(() => visitas.id, { onDelete: "cascade" }),
  empresaId: varchar("empresa_id")
    .notNull()
    .references(() => empresas.id, { onDelete: "cascade" }),
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

// Visitas Contactos
export const visitasContactos = pgTable("visitas_contactos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id")
    .notNull()
    .references(() => empresas.id, { onDelete: "cascade" }),
  visitaId: varchar("visita_id")
    .notNull()
    .references(() => visitas.id, { onDelete: "cascade" }),
  contactoId: varchar("contacto_id")
    .notNull()
    .references(() => contactos.id, { onDelete: "cascade" }),
  role: text("role"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const visitasContactosRelations = relations(
  visitasContactos,
  ({ one }) => ({
    empresa: one(empresas, {
      fields: [visitasContactos.empresaId],
      references: [empresas.id],
    }),
    visita: one(visitas, {
      fields: [visitasContactos.visitaId],
      references: [visitas.id],
    }),
    contacto: one(contactos, {
      fields: [visitasContactos.contactoId],
      references: [contactos.id],
    }),
  }),
);

export const insertVisitasContactosSchema = createInsertSchema(
  visitasContactos,
).omit({
  id: true,
  empresaId: true,
  createdAt: true,
});

export type InsertVisitasContactos = z.infer<
  typeof insertVisitasContactosSchema
>;
export type VisitasContactos = typeof visitasContactos.$inferSelect;

// Tarefas
export const tarefas = pgTable("tarefas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id")
    .notNull()
    .references(() => empresas.id, { onDelete: "cascade" }),
  titulo: varchar("titulo", { length: 500 }).notNull(),
  descricao: text("descricao"),
  visitaId: varchar("visita_id").references(() => visitas.id, {
    onDelete: "set null",
  }),
  entidadeId: varchar("entidade_id").references(() => entidades.id, {
    onDelete: "set null",
  }),
  createdByUserId: varchar("created_by_user_id", { length: 255 }).notNull(),
  assignedUserId: varchar("assigned_user_id", { length: 255 }),
  dueDate: timestamp("due_date"),
  repeatInterval: taskRepeatEnum("repeat_interval")
    .default("none")
    .notNull(),
  status: taskStatusEnum("status").default("pending").notNull(),
  odooTaskId: integer("odoo_task_id"),
  needsSync: boolean("needs_sync").default(false).notNull(),
  syncStatus: syncStatusEnum("sync_status").default("never"),
  lastSyncAt: timestamp("last_sync_at"),
  syncError: text("sync_error"),
  plannerTaskId: varchar("planner_task_id", { length: 255 }),
  plannerPlanId: varchar("planner_plan_id", { length: 255 }),
  plannerBucketId: varchar("planner_bucket_id", { length: 255 }),
  lastPlannerSyncAt: timestamp("last_planner_sync_at"),
  todoTaskId: varchar("todo_task_id", { length: 255 }),
  lastTodoSyncAt: timestamp("last_todo_sync_at"),
  microsoftUserId: varchar("microsoft_user_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("tarefas_empresa_due_idx").on(table.empresaId, table.dueDate),
]);

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

export const insertTarefaSchema = createInsertSchema(tarefas)
  .omit({
    id: true,
    empresaId: true,
    createdByUserId: true,
    assignedUserId: true,
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
  })
  .extend({
    descricao: z.string().trim().nullable().optional(),
    dueDate: z
      .union([
        z.date(),
        z.string().transform((str) => new Date(str)),
      ])
      .optional()
      .nullable(),
  });

export type InsertTarefa = z.infer<typeof insertTarefaSchema>;
export type Tarefa = typeof tarefas.$inferSelect;

// Lembretes
export const lembretes = pgTable("lembretes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id")
    .notNull()
    .references(() => empresas.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  entidadeId: varchar("entidade_id").references(() => entidades.id, {
    onDelete: "cascade",
  }),
  visitaId: varchar("visita_id").references(() => visitas.id, {
    onDelete: "cascade",
  }),
  tarefaId: varchar("tarefa_id").references(() => tarefas.id, {
    onDelete: "cascade",
  }),
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

// Microsoft Tokens
export const microsoftTokens = pgTable("microsoft_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  scopes: text("scopes").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const microsoftTokensRelations = relations(
  microsoftTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [microsoftTokens.userId],
      references: [users.id],
    }),
  }),
);

export const insertMicrosoftTokenSchema = createInsertSchema(
  microsoftTokens,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMicrosoftToken = z.infer<
  typeof insertMicrosoftTokenSchema
>;
export type MicrosoftToken = typeof microsoftTokens.$inferSelect;

// Microsoft Connections
export const microsoftConnections = pgTable("microsoft_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  msAccountId: text("ms_account_id").notNull(),
  email: text("email"),
  displayName: text("display_name"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const microsoftConnectionsRelations = relations(
  microsoftConnections,
  ({ one }) => ({
    user: one(users, {
      fields: [microsoftConnections.userId],
      references: [users.id],
    }),
  }),
);

export const insertMicrosoftConnectionSchema = createInsertSchema(
  microsoftConnections,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMicrosoftConnection = z.infer<
  typeof insertMicrosoftConnectionSchema
>;
export type MicrosoftConnection = typeof microsoftConnections.$inferSelect;

// Google Connections
export const googleConnections = pgTable("google_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  googleUserId: text("google_user_id").notNull(),
  email: text("email"),
  name: text("name"),
  picture: text("picture"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export const googleConnectionsRelations = relations(
  googleConnections,
  ({ one }) => ({
    user: one(users, {
      fields: [googleConnections.userId],
      references: [users.id],
    }),
  }),
);

export const insertGoogleConnectionSchema = createInsertSchema(
  googleConnections,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGoogleConnection = z.infer<
  typeof insertGoogleConnectionSchema
>;
export type GoogleConnection = typeof googleConnections.$inferSelect;

// Odoo Connections
export const odooConnections = pgTable("odoo_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id", { length: 255 })
    .notNull()
    .references(() => empresas.id, { onDelete: "cascade" }),
  baseUrl: varchar("base_url", { length: 500 }).notNull(),
  dbName: varchar("db_name", { length: 255 }).notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  apiKey: text("api_key").notNull(),
  environment: varchar("environment", { length: 50 })
    .default("test")
    .notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export const odooConnectionsRelations = relations(
  odooConnections,
  ({ one }) => ({
    empresa: one(empresas, {
      fields: [odooConnections.empresaId],
      references: [empresas.id],
    }),
  }),
);

export const insertOdooConnectionSchema = createInsertSchema(
  odooConnections,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOdooConnection = z.infer<
  typeof insertOdooConnectionSchema
>;
export type OdooConnection = typeof odooConnections.$inferSelect;

// Odoo Contact Requests
export const odooContactRequests = pgTable("odoo_contact_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  empresaId: varchar("empresa_id")
    .notNull()
    .references(() => empresas.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  contactoId: varchar("contacto_id").references(() => contactos.id, {
    onDelete: "set null",
  }),
  entidadeId: varchar("entidade_id").references(() => entidades.id, {
    onDelete: "set null",
  }),
  tipo: text("tipo").notNull(),
  mensagem: text("mensagem"),
  estado: text("estado").notNull().default("pendente"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  userSeenAt: timestamp("user_seen_at", { withTimezone: true }),
});

export const odooContactRequestsRelations = relations(
  odooContactRequests,
  ({ one }) => ({
    empresa: one(empresas, {
      fields: [odooContactRequests.empresaId],
      references: [empresas.id],
    }),
    user: one(users, {
      fields: [odooContactRequests.userId],
      references: [users.id],
    }),
    contacto: one(contactos, {
      fields: [odooContactRequests.contactoId],
      references: [contactos.id],
    }),
    entidade: one(entidades, {
      fields: [odooContactRequests.entidadeId],
      references: [entidades.id],
    }),
  }),
);

export const insertOdooContactRequestSchema = createInsertSchema(
  odooContactRequests,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOdooContactRequest = z.infer<
  typeof insertOdooContactRequestSchema
>;
export type OdooContactRequest = typeof odooContactRequests.$inferSelect;

// Extended types
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
  entidadeTipo?: EntidadeTipo | null;
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
  visitasPosteriores?: VisitaWithRelations[];
  contactosPresentes?: Contacto[];
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
