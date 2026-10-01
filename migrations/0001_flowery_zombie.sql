CREATE TABLE "entidade_tipos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" varchar NOT NULL,
	"nome" varchar(255) NOT NULL,
	"cor" varchar(20),
	"icon" varchar(50) DEFAULT 'Building2',
	"ativo" boolean DEFAULT true NOT NULL,
	"ordem" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "google_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"google_user_id" text NOT NULL,
	"email" text,
	"name" text,
	"picture" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" varchar NOT NULL,
	"entidade_id" varchar,
	"contacto_id" varchar,
	"visita_id" varchar,
	"titulo" text NOT NULL,
	"descricao" text,
	"descricao_html" text,
	"tipo_lead" text,
	"marca" text,
	"estado" text DEFAULT 'novo' NOT NULL,
	"valor_previsto" numeric,
	"moeda" varchar(3) DEFAULT 'EUR',
	"responsavel_user_id" varchar,
	"odoo_lead_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads_contactos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"contacto_id" varchar NOT NULL,
	"role" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads_marcas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"marca_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "microsoft_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"ms_account_id" text NOT NULL,
	"email" text,
	"display_name" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odoo_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" varchar(255) NOT NULL,
	"base_url" varchar(500) NOT NULL,
	"db_name" varchar(255) NOT NULL,
	"username" varchar(255) NOT NULL,
	"api_key" text NOT NULL,
	"environment" varchar(50) DEFAULT 'test' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odoo_contact_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"contacto_id" varchar,
	"entidade_id" varchar,
	"tipo" text NOT NULL,
	"mensagem" text,
	"estado" text DEFAULT 'pendente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"user_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "visitas_contactos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" varchar NOT NULL,
	"visita_id" varchar NOT NULL,
	"contacto_id" varchar NOT NULL,
	"role" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "empresas" ALTER COLUMN "ui_settings" SET DEFAULT '{
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
  }';--> statement-breakpoint
ALTER TABLE "contactos" ADD COLUMN "odoo_partner_id" text;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "openai_api_key" text;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "odoo_crm_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "crm_leads_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "odoo_contacts_feature_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "odoo_contacts_admin_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "odoo_contacts_agents_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "odoo_contacts_no_permission_message" text;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "crm_visits_odoo_sync_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "entidades" ADD COLUMN "entidade_tipo_id" varchar;--> statement-breakpoint
ALTER TABLE "entidades" ADD COLUMN "odoo_partner_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "user_settings" jsonb DEFAULT '{
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
  }';--> statement-breakpoint
ALTER TABLE "visitas" ADD COLUMN "odoo_lead_id" text;--> statement-breakpoint
ALTER TABLE "entidade_tipos" ADD CONSTRAINT "entidade_tipos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_connections" ADD CONSTRAINT "google_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_entidade_id_entidades_id_fk" FOREIGN KEY ("entidade_id") REFERENCES "public"."entidades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_contacto_id_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."contactos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads_contactos" ADD CONSTRAINT "leads_contactos_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads_contactos" ADD CONSTRAINT "leads_contactos_contacto_id_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."contactos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads_marcas" ADD CONSTRAINT "leads_marcas_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads_marcas" ADD CONSTRAINT "leads_marcas_marca_id_marcas_id_fk" FOREIGN KEY ("marca_id") REFERENCES "public"."marcas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "microsoft_connections" ADD CONSTRAINT "microsoft_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odoo_connections" ADD CONSTRAINT "odoo_connections_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odoo_contact_requests" ADD CONSTRAINT "odoo_contact_requests_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odoo_contact_requests" ADD CONSTRAINT "odoo_contact_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odoo_contact_requests" ADD CONSTRAINT "odoo_contact_requests_contacto_id_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."contactos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odoo_contact_requests" ADD CONSTRAINT "odoo_contact_requests_entidade_id_entidades_id_fk" FOREIGN KEY ("entidade_id") REFERENCES "public"."entidades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas_contactos" ADD CONSTRAINT "visitas_contactos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas_contactos" ADD CONSTRAINT "visitas_contactos_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas_contactos" ADD CONSTRAINT "visitas_contactos_contacto_id_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."contactos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entidades" ADD CONSTRAINT "entidades_entidade_tipo_id_entidade_tipos_id_fk" FOREIGN KEY ("entidade_tipo_id") REFERENCES "public"."entidade_tipos"("id") ON DELETE set null ON UPDATE no action;