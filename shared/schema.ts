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
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Marcas (Brands) table
export const marcas = pgTable("marcas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  logoUrl: varchar("logo_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMarcaSchema = createInsertSchema(marcas).omit({
  id: true,
  createdAt: true,
});

export type InsertMarca = z.infer<typeof insertMarcaSchema>;
export type Marca = typeof marcas.$inferSelect;

// Tipo de Entidade enum
export const tipoEntidadeEnum = pgEnum('tipo_entidade', [
  'Gabinete',
  'Cliente',
  'Distribuidor',
  'Obra',
  'Parceiro',
  'Outro'
]);

// Odoo Sync Status enum
export const syncStatusEnum = pgEnum('sync_status', [
  'pending',
  'synced',
  'error',
  'never'
]);

// Entidades (Universal Entities) table - replaces Gabinetes
export const entidades = pgTable("entidades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  // Odoo Integration Fields
  odooEntityId: integer("odoo_entity_id"),
  syncStatus: syncStatusEnum("sync_status").default('never'),
  lastSyncAt: timestamp("last_sync_at"),
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEntidadeSchema = createInsertSchema(entidades).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  odooEntityId: true,
  syncStatus: true,
  lastSyncAt: true,
  syncError: true,
}).extend({
  // Add validation for coordinates (empty string treated as null)
  latitude: z.string().regex(/^-?([0-9]{1,2}|1[0-7][0-9]|180)(\.[0-9]+)?$/).or(z.literal("")).optional().nullable(),
  longitude: z.string().regex(/^-?([0-9]{1,2}|1[0-7][0-9]|180)(\.[0-9]+)?$/).or(z.literal("")).optional().nullable(),
  // NIF validation (Portuguese tax number - 9 digits, empty string treated as null)
  nif: z.string().regex(/^[0-9]{9}$/).or(z.literal("")).optional().nullable(),
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
  nome: varchar("nome", { length: 255 }).notNull(),
  funcao: varchar("funcao", { length: 255 }),
  telemovel: varchar("telemovel", { length: 50 }),
  email: varchar("email", { length: 255 }),
  entidadeId: varchar("entidade_id").references(() => entidades.id, { onDelete: 'set null' }),
  gabineteId: varchar("gabinete_id").references(() => gabinetes.id, { onDelete: 'set null' }), // DEPRECATED
  observacoes: text("observacoes"),
  fotoUrl: varchar("foto_url", { length: 500 }),
  // Odoo Integration Fields
  odooContactId: integer("odoo_contact_id"),
  syncStatus: syncStatusEnum("sync_status").default('never'),
  lastSyncAt: timestamp("last_sync_at"),
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contactosRelations = relations(contactos, ({ one }) => ({
  entidade: one(entidades, {
    fields: [contactos.entidadeId],
    references: [entidades.id],
  }),
  gabinete: one(gabinetes, { // DEPRECATED
    fields: [contactos.gabineteId],
    references: [gabinetes.id],
  }),
}));

export const entidadesRelations = relations(entidades, ({ many }) => ({
  contactos: many(contactos),
  visitas: many(visitas),
}));

export const gabinetesRelations = relations(gabinetes, ({ many }) => ({
  contactos: many(contactos),
  visitas: many(visitas),
}));

export const insertContactoSchema = createInsertSchema(contactos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  gabineteId: true, // DEPRECATED - use entidadeId
  odooContactId: true,
  syncStatus: true,
  lastSyncAt: true,
  syncError: true,
});

export type InsertContacto = z.infer<typeof insertContactoSchema>;
export type Contacto = typeof contactos.$inferSelect;

// Visitas (Visits) table
export const visitas = pgTable("visitas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entidadeId: varchar("entidade_id").references(() => entidades.id, { onDelete: 'set null' }),
  gabineteId: varchar("gabinete_id").references(() => gabinetes.id, { onDelete: 'set null' }), // DEPRECATED
  contactoId: varchar("contacto_id").references(() => contactos.id, { onDelete: 'set null' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  // Odoo Integration Fields
  odooActivityId: integer("odoo_activity_id"),
  syncStatus: syncStatusEnum("sync_status").default('never'),
  lastSyncAt: timestamp("last_sync_at"),
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const visitasRelations = relations(visitas, ({ one }) => ({
  entidade: one(entidades, {
    fields: [visitas.entidadeId],
    references: [entidades.id],
  }),
  gabinete: one(gabinetes, { // DEPRECATED
    fields: [visitas.gabineteId],
    references: [gabinetes.id],
  }),
  contacto: one(contactos, {
    fields: [visitas.contactoId],
    references: [contactos.id],
  }),
  user: one(users, {
    fields: [visitas.userId],
    references: [users.id],
  }),
}));

export const insertVisitaSchema = createInsertSchema(visitas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  linkVisita: true,
  resumoIa: true,
  transcricaoAudio: true,
  gabineteId: true, // DEPRECATED - use entidadeId
  odooActivityId: true,
  syncStatus: true,
  lastSyncAt: true,
  syncError: true,
});

export type InsertVisita = z.infer<typeof insertVisitaSchema>;
export type Visita = typeof visitas.$inferSelect;

// Extended types for relations
export type EntidadeWithRelations = Entidade & {
  contactos?: Contacto[];
  visitas?: Visita[];
};

export type GabineteWithRelations = Gabinete & {
  contactos?: Contacto[];
  visitas?: Visita[];
};

export type ContactoWithRelations = Contacto & {
  entidade?: Entidade | null;
  gabinete?: Gabinete | null;
};

export type VisitaWithRelations = Visita & {
  entidade?: Entidade | null;
  gabinete?: Gabinete | null;
  contacto?: Contacto | null;
  user?: User;
};
