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

// Gabinetes (Architecture Offices) table
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
  gabineteId: varchar("gabinete_id").notNull().references(() => gabinetes.id, { onDelete: 'cascade' }),
  observacoes: text("observacoes"),
  fotoUrl: varchar("foto_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contactosRelations = relations(contactos, ({ one }) => ({
  gabinete: one(gabinetes, {
    fields: [contactos.gabineteId],
    references: [gabinetes.id],
  }),
}));

export const gabinetesRelations = relations(gabinetes, ({ many }) => ({
  contactos: many(contactos),
  visitas: many(visitas),
}));

export const insertContactoSchema = createInsertSchema(contactos).omit({
  id: true,
  createdAt: true,
});

export type InsertContacto = z.infer<typeof insertContactoSchema>;
export type Contacto = typeof contactos.$inferSelect;

// Visitas (Visits) table
export const visitas = pgTable("visitas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gabineteId: varchar("gabinete_id").notNull().references(() => gabinetes.id, { onDelete: 'cascade' }),
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const visitasRelations = relations(visitas, ({ one }) => ({
  gabinete: one(gabinetes, {
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
  linkVisita: true,
  resumoIa: true,
  transcricaoAudio: true,
});

export type InsertVisita = z.infer<typeof insertVisitaSchema>;
export type Visita = typeof visitas.$inferSelect;

// Extended types for relations
export type GabineteWithRelations = Gabinete & {
  contactos?: Contacto[];
  visitas?: Visita[];
};

export type ContactoWithRelations = Contacto & {
  gabinete?: Gabinete;
};

export type VisitaWithRelations = Visita & {
  gabinete?: Gabinete;
  contacto?: Contacto;
  user?: User;
};
