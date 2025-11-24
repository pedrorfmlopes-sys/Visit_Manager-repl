CREATE TYPE "public"."lembrete_tipo" AS ENUM('visita_followup', 'tarefa_overdue', 'ai_suggestion');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('pending', 'synced', 'error', 'never');--> statement-breakpoint
CREATE TYPE "public"."task_repeat_interval" AS ENUM('none', 'daily', '2days', '3days', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'done');--> statement-breakpoint
CREATE TYPE "public"."tipo_entidade" AS ENUM('Gabinete', 'Distribuidor', 'Parceiro', 'Construtor');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'agent');--> statement-breakpoint
CREATE TABLE "contactos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" varchar NOT NULL,
	"nome" varchar(255) NOT NULL,
	"funcao" varchar(255),
	"telemovel" varchar(50),
	"email" varchar(255),
	"entidade_id" varchar,
	"gabinete_id" varchar,
	"observacoes" text,
	"foto_url" varchar(500),
	"created_by_user_id" varchar(255),
	"assigned_user_id" varchar(255),
	"odoo_contact_id" integer,
	"needs_sync" boolean DEFAULT false NOT NULL,
	"sync_status" "sync_status" DEFAULT 'never',
	"last_sync_at" timestamp,
	"sync_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"nif" varchar(50),
	"email" varchar(255),
	"telefone" varchar(50),
	"logo_url" varchar(500),
	"mostrar_marcas_em_visitas" boolean DEFAULT false NOT NULL,
	"mostrar_gps" boolean DEFAULT false NOT NULL,
	"theme" varchar(50) DEFAULT 'light-business' NOT NULL,
	"ui_settings" jsonb DEFAULT '{
    "mostrarGPS": false,
    "mostrarMarcasEmVisitas": false,
    "enableIA": true,
    "enableAudio": true,
    "enableAudioTranscription": true,
    "enableFollowups": true,
    "enableAlertRibbon": true,
    "enableBadges": true,
    "refreshInterval": 60
  }',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "entidades" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" varchar NOT NULL,
	"tipo_entidade" "tipo_entidade" DEFAULT 'Gabinete' NOT NULL,
	"nome" varchar(255) NOT NULL,
	"morada" text,
	"cidade" varchar(100),
	"codigo_postal" varchar(20),
	"email" varchar(255),
	"telefone" varchar(50),
	"website" varchar(500),
	"notas" text,
	"latitude" varchar(50),
	"longitude" varchar(50),
	"nif" varchar(50),
	"logo_url" varchar(500),
	"domain" varchar(255),
	"industry" varchar(255),
	"descricao" text,
	"linkedin_url" varchar(500),
	"facebook_url" varchar(500),
	"twitter_url" varchar(500),
	"instagram_url" varchar(500),
	"x_url" varchar(500),
	"last_enriched_at" timestamp,
	"enrichment_source" varchar(50),
	"pending_enrichment" boolean DEFAULT false,
	"created_by_user_id" varchar(255),
	"assigned_user_id" varchar(255),
	"odoo_entity_id" integer,
	"needs_sync" boolean DEFAULT false NOT NULL,
	"sync_status" "sync_status" DEFAULT 'never',
	"last_sync_at" timestamp,
	"sync_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gabinetes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"morada" text,
	"codigo_postal" varchar(20),
	"cidade" varchar(100),
	"telefone" varchar(50),
	"email" varchar(255),
	"website" varchar(500),
	"marcas" text[],
	"observacoes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lembretes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" varchar NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"entidade_id" varchar,
	"visita_id" varchar,
	"tarefa_id" varchar,
	"tipo" "lembrete_tipo" NOT NULL,
	"mensagem" text NOT NULL,
	"data_criacao" timestamp DEFAULT now() NOT NULL,
	"data_vencimento" timestamp,
	"snoozed_until" timestamp,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "marcas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" varchar NOT NULL,
	"nome" varchar(255) NOT NULL,
	"codigo" varchar(100),
	"descricao" text,
	"logo_url" varchar(500),
	"ativa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "microsoft_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"scopes" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "microsoft_tokens_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarefas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" varchar NOT NULL,
	"titulo" varchar(500) NOT NULL,
	"descricao" text,
	"visita_id" varchar,
	"entidade_id" varchar,
	"created_by_user_id" varchar(255) NOT NULL,
	"assigned_user_id" varchar(255),
	"due_date" timestamp,
	"repeat_interval" "task_repeat_interval" DEFAULT 'none' NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"odoo_task_id" integer,
	"needs_sync" boolean DEFAULT false NOT NULL,
	"sync_status" "sync_status" DEFAULT 'never',
	"last_sync_at" timestamp,
	"sync_error" text,
	"planner_task_id" varchar(255),
	"planner_plan_id" varchar(255),
	"planner_bucket_id" varchar(255),
	"last_planner_sync_at" timestamp,
	"todo_task_id" varchar(255),
	"last_todo_sync_at" timestamp,
	"microsoft_user_id" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" "user_role" DEFAULT 'agent' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"empresa_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "visitas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" varchar NOT NULL,
	"entidade_id" varchar,
	"gabinete_id" varchar,
	"contacto_id" varchar,
	"user_id" varchar NOT NULL,
	"data_visita" timestamp NOT NULL,
	"notas" text,
	"marcas_entregues" text[],
	"audio_url" varchar(500),
	"media_urls" text[],
	"proxima_visita" timestamp,
	"proxima_visita_status" varchar(50) DEFAULT 'agendada',
	"proxima_visita_status_data" timestamp,
	"visita_anterior_id" varchar,
	"link_visita" varchar(100),
	"resumo_ia" text,
	"pontos_chave_ia" text,
	"tarefas_sugeridas_ia" text,
	"ia_last_generated_at" timestamp,
	"transcricao_audio" text,
	"latitude" varchar(50),
	"longitude" varchar(50),
	"location_accuracy" varchar(50),
	"created_by_user_id" varchar(255),
	"assigned_user_id" varchar(255),
	"odoo_activity_id" integer,
	"needs_sync" boolean DEFAULT false NOT NULL,
	"sync_status" "sync_status" DEFAULT 'never',
	"last_sync_at" timestamp,
	"sync_error" text,
	"outlook_event_id" varchar(255),
	"last_calendar_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "visitas_link_visita_unique" UNIQUE("link_visita")
);
--> statement-breakpoint
CREATE TABLE "visitas_audio" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visita_id" varchar NOT NULL,
	"empresa_id" varchar NOT NULL,
	"file_url" varchar(500) NOT NULL,
	"transcricao" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "visitas_marcas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visita_id" varchar NOT NULL,
	"marca_id" varchar NOT NULL,
	"empresa_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "contactos" ADD CONSTRAINT "contactos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contactos" ADD CONSTRAINT "contactos_entidade_id_entidades_id_fk" FOREIGN KEY ("entidade_id") REFERENCES "public"."entidades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contactos" ADD CONSTRAINT "contactos_gabinete_id_gabinetes_id_fk" FOREIGN KEY ("gabinete_id") REFERENCES "public"."gabinetes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entidades" ADD CONSTRAINT "entidades_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_entidade_id_entidades_id_fk" FOREIGN KEY ("entidade_id") REFERENCES "public"."entidades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_tarefa_id_tarefas_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marcas" ADD CONSTRAINT "marcas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "microsoft_tokens" ADD CONSTRAINT "microsoft_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_entidade_id_entidades_id_fk" FOREIGN KEY ("entidade_id") REFERENCES "public"."entidades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_entidade_id_entidades_id_fk" FOREIGN KEY ("entidade_id") REFERENCES "public"."entidades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_gabinete_id_gabinetes_id_fk" FOREIGN KEY ("gabinete_id") REFERENCES "public"."gabinetes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_contacto_id_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."contactos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_visita_anterior_id_visitas_id_fk" FOREIGN KEY ("visita_anterior_id") REFERENCES "public"."visitas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas_audio" ADD CONSTRAINT "visitas_audio_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas_audio" ADD CONSTRAINT "visitas_audio_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas_marcas" ADD CONSTRAINT "visitas_marcas_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas_marcas" ADD CONSTRAINT "visitas_marcas_marca_id_marcas_id_fk" FOREIGN KEY ("marca_id") REFERENCES "public"."marcas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas_marcas" ADD CONSTRAINT "visitas_marcas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");