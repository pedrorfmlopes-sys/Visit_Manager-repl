import {
  empresas,
  users,
  entidades,
  entidadeTipos,
  contactos,
  visitas,
  tarefas,
  marcas,
  visitasMarcas,
  visitasAudio,
  visitasContactos,
  // lembretes,
  odooContactRequests,
  type Empresa,
  type InsertEmpresa,
  type User,
  type UpsertUser,
  type Entidade,
  type InsertEntidade,
  type EntidadeTipo,
  type InsertEntidadeTipo,
  type Contacto,
  type InsertContacto,
  type Visita,
  type InsertVisita,
  type Tarefa,
  type InsertTarefa,
  type Marca,
  type InsertMarca,
  type EntidadeWithRelations,
  type ContactoWithRelations,
  type VisitaWithRelations,
  type TarefaWithRelations,
  type VisitasAudio,
  // type InsertVisitasAudio,
  type InsertOdooContactRequest,
  type OdooContactRequest,
  insertOdooContactRequestSchema,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, or, and, inArray, ne, isNull } from "drizzle-orm";
import { haversineDistance } from "./distanceUtils";

// ============ ENTIDADES RBAC HELPER ============
function buildEntidadeAccessWhere(
  empresaId: string,
  userId: string,
  userRole: "admin" | "agent",
) {
  if (userRole === "admin") {
    return eq(entidades.empresaId, empresaId);
  }

  return and(
    eq(entidades.empresaId, empresaId),
    or(
      eq(entidades.createdByUserId, userId),
      eq(entidades.assignedUserId, userId),
    ),
  );
}

// ============ CONTACTOS RBAC HELPER ============
// function buildContactoAccessWhere(
//  empresaId: string,
//  userId: string,
//  userRole: "admin" | "agent",
//) {
//  if (userRole === "admin") {
//    return eq(contactos.empresaId, empresaId);
//  }
//
//  return and(
//    eq(contactos.empresaId, empresaId),
//    or(
//      eq(contactos.createdByUserId, userId),
//      eq(contactos.assignedUserId, userId),
//  ),
// );
// } 

export interface ListContactosParams {
  empresaId: string;
  entidadeId?: string;
  assignedUserId?: string;
  visitaId?: string | null;
}

export interface IStorage {
  // Empresas (Multi-tenant)
  getEmpresa(id: string): Promise<Empresa | undefined>;
  createEmpresa(empresa: InsertEmpresa): Promise<Empresa>;
  getAllEmpresas(): Promise<Empresa[]>;

  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Entidades
  getEntidades(
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<Entidade[]>;
  getEntidade(
    id: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<EntidadeWithRelations | undefined>;
  findEntidadeByNome(
    nome: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<Entidade | undefined>;
  findEntidadeByDomain(
    domain: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<Entidade | undefined>;
  createEntidade(entidade: InsertEntidade, empresaId: string): Promise<Entidade>;
  updateEntidade(
    id: string,
    entidade: Partial<InsertEntidade>,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<Entidade | undefined>;
  deleteEntidade(
    id: string,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<void>;
  checkEntidadeHasRelations(id: string): Promise<boolean>;

  // Contactos
  getContactos(params: ListContactosParams): Promise<ContactoWithRelations[]>;
  getContacto(
    id: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<ContactoWithRelations | undefined>;
  createContacto(contacto: InsertContacto, empresaId: string): Promise<Contacto>;
  updateContacto(
    id: string,
    contacto: Partial<InsertContacto>,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<Contacto | undefined>;
  deleteContacto(
    id: string,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<void>;

  // Visitas
  getVisitas(
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<VisitaWithRelations[]>;
  getVisita(
    id: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<VisitaWithRelations | undefined>;
  createVisita(visita: InsertVisita, empresaId: string): Promise<Visita>;
  updateVisita(
    id: string,
    visita: Partial<Visita>,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<Visita | undefined>;
  deleteVisita(
    id: string,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<void>;

  // Tarefas
  getTarefas(
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
    filters?: {
      status?: string;
      assignedUserId?: string;
      entidadeId?: string;
      visitaId?: string;
      overdue?: boolean;
    },
  ): Promise<TarefaWithRelations[]>;

  getTarefa(
    id: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<TarefaWithRelations | undefined>;

  createTarefa(
    tarefa: InsertTarefa,
    empresaId: string,
    createdByUserId: string,
  ): Promise<Tarefa>;

  updateTarefa(
    id: string,
    tarefa: Partial<InsertTarefa>,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<Tarefa | undefined>;

  deleteTarefa(
    id: string,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<void>;

  getTarefasByVisitaId(
    visitaId: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<TarefaWithRelations[]>;

  getTarefasByEntidadeId(
    entidadeId: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<TarefaWithRelations[]>;

  getTarefasInPeriod(
    startDate: Date,
    endDate: Date,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<TarefaWithRelations[]>;
  getUnplannedTarefas(
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<TarefaWithRelations[]>;

  // Visitas helpers
  getVisitasByEntidade(
    entidadeId: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<VisitaWithRelations[]>;
  getVisitasInPeriod(
    startDate: Date,
    endDate: Date,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<VisitaWithRelations[]>;

  // Entidades helpers
  getAllEntidades(
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<EntidadeWithRelations[]>;

  // Marcas
  getMarcasByEmpresa(empresaId: string): Promise<Marca[]>;
  getMarcasByEmpresaAtiva(empresaId: string): Promise<Marca[]>;
  getMarca(id: string): Promise<Marca | undefined>;
  createMarca(marca: InsertMarca): Promise<Marca>;
  updateMarca(
    id: string,
    marca: Partial<InsertMarca>,
    empresaId: string,
  ): Promise<Marca | undefined>;

  // Entity Types (Tipos de Entidades)
  getEntidadeTipos(empresaId: string): Promise<EntidadeTipo[]>;
  getEntidadeTiposAtivos(empresaId: string): Promise<EntidadeTipo[]>;
  getEntidadeTipo(id: string, empresaId: string): Promise<EntidadeTipo | undefined>;
  createEntidadeTipo(
    tipo: InsertEntidadeTipo,
    empresaId: string,
  ): Promise<EntidadeTipo>;
  updateEntidadeTipo(
    id: string,
    tipo: Partial<InsertEntidadeTipo>,
    empresaId: string,
  ): Promise<EntidadeTipo | undefined>;
  migrateEntidadeTipos(): Promise<{
    empresasProcessadas: number;
    entidadesMigradas: number;
    tiposCriados: number;
  }>;

  // Contactos em visitas
  addContactosToVisita(
    visitaId: string,
    contactosIds: string[],
    empresaId: string,
  ): Promise<void>;
  getContactosFromVisita(
    visitaId: string,
    empresaId: string,
  ): Promise<
    Array<{
      id: string;
      nome: string;
      email?: string | null;
      telefone?: string | null;
      role?: string | null;
    }>
  >;

  // Audio
  addAudioToVisita(
    visitaId: string,
    fileUrl: string,
    empresaId: string,
  ): Promise<VisitasAudio>;
  getVisitasAudio(
    visitaId: string,
    empresaId: string,
  ): Promise<VisitasAudio[]>;
  deleteVisitasAudio(audioId: string, empresaId: string): Promise<void>;
  updateVisitasAudioTranscription(
    audioId: string,
    transcricao: string,
  ): Promise<VisitasAudio | undefined>;

  // AI summary
  updateVisitaAISummary(
    visitaId: string,
    empresaId: string,
    data: {
      resumoIA: string;
      pontosChaveIA: string[];
      tarefasSugeridasIA: any[];
    },
  ): Promise<Visita | undefined>;

  // Empresa & Users
  updateEmpresa(
    id: string,
    empresa: Partial<InsertEmpresa>,
  ): Promise<Empresa | undefined>;
  getUtilizadoresByEmpresa(empresaId: string): Promise<User[]>;
  createUtilizador(userData: UpsertUser): Promise<User>;
  updateUtilizador(
    id: string,
    userData: Partial<UpsertUser>,
    empresaId: string,
  ): Promise<User | undefined>;

  // User settings
  getUserSettings(userId: string): Promise<User | undefined>;
  updateUserSettings(userId: string, settings: any): Promise<User | undefined>;

  // Legacy marcas
  getMarcas(): Promise<Marca[]>;

  // Dashboard stats (multi-tenant)
  getDashboardStats(
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<{
    totalEntidades: number;
    totalContactos: number;
    totalVisitas: number;
    visitasEstesMes: number;
    marcasMaisEntregues: { marca: string; count: number }[];
    proximasVisitas: VisitaWithRelations[];
  }>;

  // Analytics (multi-tenant)
  getAnalytics(
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
    filters?: {
      period?: number;
      agente?: string;
      tipoEntidade?: string;
    },
  ): Promise<{
    visits: {
      total_visits: number;
      visits_last_7_days: number;
      visits_last_30_days: number;
      visits_by_agent: { agent: string; count: number }[];
      visits_by_entity_type: { tipo: string; count: number }[];
      visits_by_month: { month: string; count: number }[];
      most_visited_entities: { id: string; nome: string; count: number }[];
      gps_heatmap: { lat: number; lon: number; date: string }[];
    };
    tasks: {
      tasks_pending: number;
      tasks_overdue: number;
      tasks_completed_this_week: number;
      tasks_by_agent: { agent: string; count: number }[];
      tasks_by_status: { status: string; count: number }[];
      tasks_by_repeat_interval: { interval: string; count: number }[];
    };
    entities: {
      entities_by_type: { tipo: string; count: number }[];
      entities_created_last_30_days: number;
      entities_with_visits_count: {
        id: string;
        nome: string;
        count: number;
      }[];
    };
    brands: {
      brand_frequency: { marca: string; count: number }[];
    };
  }>;

  // Microsoft sync helpers
  updateTarefaMicrosoftFields(
    id: string,
    fields: {
      plannerTaskId?: string;
      plannerPlanId?: string;
      plannerBucketId?: string;
      lastPlannerSyncAt?: Date;
      todoTaskId?: string;
      lastTodoSyncAt?: Date;
      microsoftUserId?: string;
    },
  ): Promise<Tarefa | undefined>;
  updateVisitaMicrosoftFields(
    id: string,
    fields: {
      outlookEventId?: string;
      lastCalendarSyncAt?: Date;
    },
  ): Promise<Visita | undefined>;

  // Odoo Contact Requests
  createOdooContactRequest(
    input: InsertOdooContactRequest,
  ): Promise<OdooContactRequest>;
  listOdooContactRequestsByEmpresa(
    empresaId: string,
  ): Promise<(OdooContactRequest & { userName?: string | null })[]>;
  updateOdooContactRequestStatus(
    empresaId: string,
    requestId: string,
    estado: "pendente" | "em_progresso" | "concluido",
  ): Promise<OdooContactRequest | null>;
}

export class DatabaseStorage implements IStorage {
  // Empresas
  async getEmpresa(id: string): Promise<Empresa | undefined> {
    const [empresa] = await db
      .select()
      .from(empresas)
      .where(eq(empresas.id, id));
    return empresa;
  }

  async createEmpresa(empresaData: InsertEmpresa): Promise<Empresa> {
    const [empresa] = await db.insert(empresas).values(empresaData).returning();
    return empresa;
  }

  async getAllEmpresas(): Promise<Empresa[]> {
    return db.select().from(empresas).orderBy(empresas.nome);
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.email);
  }

  // Entidades
  async getEntidades(
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<Entidade[]> {
    const baseWhere = buildEntidadeAccessWhere(empresaId, userId, userRole);

    return db.query.entidades.findMany({
      where: baseWhere,
      orderBy: desc(entidades.createdAt),
      with: {
        assignedUser: true,
        createdByUser: true,
        entidadeTipo: true,
      },
    }) as unknown as Entidade[];
  }

  async getEntidade(
    id: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<EntidadeWithRelations | undefined> {
    const baseWhere = buildEntidadeAccessWhere(empresaId, userId, userRole);
    const whereClause = and(eq(entidades.id, id), baseWhere);

    const [entidade] = await db.query.entidades.findMany({
      where: whereClause,
      with: {
        contactos: true,
        visitas: {
          orderBy: desc(visitas.dataVisita),
          limit: 10,
          with: {
            entidade: true,
            contactos: {
              with: {
                contacto: true,
              },
            },
          },
        },
        entidadeTipo: true,
      },
    });

    return entidade as unknown as EntidadeWithRelations | undefined;
  }

  async findEntidadeByNome(
    nome: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<Entidade | undefined> {
    let whereClause;
    if (userRole === "admin") {
      whereClause = and(
        sql`LOWER(${entidades.nome}) = LOWER(${nome})`,
        eq(entidades.empresaId, empresaId),
      );
    } else {
      whereClause = and(
        sql`LOWER(${entidades.nome}) = LOWER(${nome})`,
        eq(entidades.empresaId, empresaId),
        or(
          eq(entidades.createdByUserId, userId),
          eq(entidades.assignedUserId, userId),
        ),
      );
    }

    const [entidade] = await db
      .select()
      .from(entidades)
      .where(whereClause)
      .limit(1);

    return entidade;
  }

  async findEntidadeByDomain(
    domain: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<Entidade | undefined> {
    let whereClause;
    if (userRole === "admin") {
      whereClause = and(
        sql`LOWER(${entidades.domain}) = LOWER(${domain})`,
        eq(entidades.empresaId, empresaId),
      );
    } else {
      whereClause = and(
        sql`LOWER(${entidades.domain}) = LOWER(${domain})`,
        eq(entidades.empresaId, empresaId),
        or(
          eq(entidades.createdByUserId, userId),
          eq(entidades.assignedUserId, userId),
        ),
      );
    }

    const [entidade] = await db
      .select()
      .from(entidades)
      .where(whereClause)
      .limit(1);

    return entidade;
  }

  async createEntidade(
    entidadeData: InsertEntidade,
    empresaId: string,
  ): Promise<Entidade> {
    const [entidade] = await db
      .insert(entidades)
      .values({ ...entidadeData, empresaId, updatedAt: new Date() })
      .returning();
    return entidade;
  }

  async updateEntidade(
    id: string,
    entidadeData: Partial<InsertEntidade>,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<Entidade | undefined> {
    const whereClause =
      userId && userRole === "agent"
        ? and(
            eq(entidades.id, id),
            eq(entidades.empresaId, empresaId),
            or(
              eq(entidades.createdByUserId, userId),
              eq(entidades.assignedUserId, userId),
            ),
          )
        : and(eq(entidades.id, id), eq(entidades.empresaId, empresaId));

    const [entidade] = await db
      .update(entidades)
      .set({ ...entidadeData, updatedAt: new Date() })
      .where(whereClause)
      .returning();

    return entidade;
  }

  async checkEntidadeHasRelations(id: string): Promise<boolean> {
    const relatedContactos = await db
      .select()
      .from(contactos)
      .where(eq(contactos.entidadeId, id))
      .limit(1);

    const relatedVisitas = await db
      .select()
      .from(visitas)
      .where(eq(visitas.entidadeId, id))
      .limit(1);

    return relatedContactos.length > 0 || relatedVisitas.length > 0;
  }

  async deleteEntidade(
    id: string,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<void> {
    const whereClause =
      userId && userRole === "agent"
        ? and(
            eq(entidades.id, id),
            eq(entidades.empresaId, empresaId),
            or(
              eq(entidades.createdByUserId, userId),
              eq(entidades.assignedUserId, userId),
            ),
          )
        : and(eq(entidades.id, id), eq(entidades.empresaId, empresaId));

    await db.delete(entidades).where(whereClause);
  }

  // Contactos
  async getContactos(params: ListContactosParams): Promise<ContactoWithRelations[]> {
    const { empresaId, assignedUserId, entidadeId } = params;

    let whereClause: any = eq(contactos.empresaId, empresaId);

    if (entidadeId) {
      whereClause = and(whereClause, eq(contactos.entidadeId, entidadeId));
    }

    if (assignedUserId) {
      whereClause = and(whereClause, eq(contactos.assignedUserId, assignedUserId));
    }

    const result = await db.query.contactos.findMany({
      where: whereClause,
      orderBy: desc(contactos.createdAt),
      with: {
        entidade: true,
        assignedUser: true,
        createdByUser: true,
      },
    });

    return result as unknown as ContactoWithRelations[];
  }

  async getContacto(
    id: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<ContactoWithRelations | undefined> {
    let whereClause;
    if (userRole === "admin") {
      whereClause = and(
        eq(contactos.id, id),
        eq(contactos.empresaId, empresaId),
      );
    } else {
      whereClause = and(
        eq(contactos.id, id),
        eq(contactos.empresaId, empresaId),
        or(
          eq(contactos.createdByUserId, userId),
          eq(contactos.assignedUserId, userId),
        ),
      );
    }

    const contacto = await db.query.contactos.findFirst({
      where: whereClause,
      with: {
        entidade: true,
      },
    });

    return contacto as unknown as ContactoWithRelations | undefined;
  }

  async createContacto(
    contacto: InsertContacto,
    empresaId: string,
  ): Promise<Contacto> {
    const [newContacto] = await db
      .insert(contactos)
      .values({ ...contacto, empresaId })
      .returning();
    return newContacto;
  }

  async updateContacto(
    id: string,
    contacto: Partial<InsertContacto>,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<Contacto | undefined> {
    const whereClause =
      userId && userRole === "agent"
        ? and(
            eq(contactos.id, id),
            eq(contactos.empresaId, empresaId),
            or(
              eq(contactos.createdByUserId, userId),
              eq(contactos.assignedUserId, userId),
            ),
          )
        : and(eq(contactos.id, id), eq(contactos.empresaId, empresaId));

    const [updated] = await db
      .update(contactos)
      .set(contacto)
      .where(whereClause)
      .returning();
    return updated;
  }

  async deleteContacto(
    id: string,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<void> {
    const whereClause =
      userId && userRole === "agent"
        ? and(
            eq(contactos.id, id),
            eq(contactos.empresaId, empresaId),
            or(
              eq(contactos.createdByUserId, userId),
              eq(contactos.assignedUserId, userId),
            ),
          )
        : and(eq(contactos.id, id), eq(contactos.empresaId, empresaId));

    await db.delete(contactos).where(whereClause);
  }

  // Visitas
  async getVisitas(
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<VisitaWithRelations[]> {
    let whereClause;
    if (userRole === "agent") {
      whereClause = and(
        eq(visitas.empresaId, empresaId),
        or(
          eq(visitas.createdByUserId, userId),
          eq(visitas.assignedUserId, userId),
          eq(visitas.userId, userId),
        ),
      );
    } else {
      whereClause = eq(visitas.empresaId, empresaId);
    }

    const result = await db.query.visitas.findMany({
      where: whereClause,
      orderBy: desc(visitas.dataVisita),
      with: {
        entidade: true,
        contacto: true,
        user: true,
        assignedUser: true,
        createdByUser: true,
        marcas: {
          with: {
            marca: true,
          },
        },
        contactos: {
          with: {
            contacto: true,
          },
        },
      },
    });

    return result as unknown as VisitaWithRelations[];
  }

  async getVisita(
    id: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<VisitaWithRelations | undefined> {
    let whereClause;
    if (userRole === "admin") {
      whereClause = and(eq(visitas.id, id), eq(visitas.empresaId, empresaId));
    } else {
      whereClause = and(
        eq(visitas.id, id),
        eq(visitas.empresaId, empresaId),
        or(
          eq(visitas.createdByUserId, userId),
          eq(visitas.assignedUserId, userId),
          eq(visitas.userId, userId),
        ),
      );
    }

    const visita = await db.query.visitas.findFirst({
      where: whereClause,
      with: {
        entidade: true,
        contacto: true,
        user: true,
        assignedUser: true,
        createdByUser: true,
        marcas: {
          with: {
            marca: true,
          },
        },
        contactos: {
          with: {
            contacto: true,
          },
        },
      },
    });

    return visita as unknown as VisitaWithRelations | undefined;
  }

  async createVisita(
    visita: InsertVisita,
    empresaId: string,
  ): Promise<Visita> {
    const result = await db
      .insert(visitas)
      .values({ ...visita, empresaId })
      .returning();

    // TS acha que isto pode ser array ou QueryResult => normalizamos:
    const rows = Array.isArray(result) ? result : result.rows;

    const [newVisita] = rows as Visita[];
    return newVisita;
  }


  // Marcas em visitas
  async addMarcasToVisita(
    visitaId: string,
    marcasIds: string[],
    empresaId: string,
  ): Promise<void> {
    await db.delete(visitasMarcas).where(eq(visitasMarcas.visitaId, visitaId));

    if (!marcasIds || marcasIds.length === 0) return;

    const marcasData = marcasIds.map((marcaId) => ({
      visitaId,
      marcaId,
      empresaId,
    }));
    await db.insert(visitasMarcas).values(marcasData);
  }

  // Contactos em visitas
  async addContactosToVisita(
    visitaId: string,
    contactosIds: string[],
    empresaId: string,
  ): Promise<void> {
    await db
      .delete(visitasContactos)
      .where(eq(visitasContactos.visitaId, visitaId));

    if (!contactosIds || contactosIds.length === 0) return;

    const contactosData = contactosIds.map((contactoId) => ({
      visitaId,
      contactoId,
      empresaId,
    }));
    await db.insert(visitasContactos).values(contactosData);
  }

  async getContactosFromVisita(
    visitaId: string,
    empresaId: string,
  ): Promise<
    Array<{
      id: string;
      nome: string;
      email?: string | null;
      telefone?: string | null;
      role?: string | null;
    }>
  > {
    const records = await db.query.visitasContactos.findMany({
      where: and(
        eq(visitasContactos.visitaId, visitaId),
        eq(visitasContactos.empresaId, empresaId),
      ),
      with: {
        contacto: {
          columns: {
            id: true,
            nome: true,
            email: true,
            telemovel: true,
          },
        },
      },
    });

    return records.map((r) => ({
      id: (r as any).contacto.id,
      nome: (r as any).contacto.nome,
      email: (r as any).contacto.email || null,
      telefone: (r as any).contacto.telemovel || null,
      role: (r as any).role,
    }));
  }

  // Audio
  async addAudioToVisita(
    visitaId: string,
    fileUrl: string,
    empresaId: string,
  ): Promise<VisitasAudio> {
    const [newAudio] = await db
      .insert(visitasAudio)
      .values({
        visitaId,
        fileUrl,
        empresaId,
      })
      .returning();
    return newAudio;
  }

  async getVisitasAudio(
    visitaId: string,
    empresaId: string,
  ): Promise<VisitasAudio[]> {
    return db.query.visitasAudio.findMany({
      where: and(
        eq(visitasAudio.visitaId, visitaId),
        eq(visitasAudio.empresaId, empresaId),
      ),
      orderBy: desc(visitasAudio.createdAt),
    });
  }

  async deleteVisitasAudio(audioId: string, empresaId: string): Promise<void> {
    await db
      .delete(visitasAudio)
      .where(
        and(
          eq(visitasAudio.id, audioId),
          eq(visitasAudio.empresaId, empresaId),
        ),
      );
  }

  async updateVisitasAudioTranscription(
    audioId: string,
    transcricao: string,
  ): Promise<VisitasAudio | undefined> {
    const [updated] = await db
      .update(visitasAudio)
      .set({ transcricao })
      .where(eq(visitasAudio.id, audioId))
      .returning();
    return updated;
  }

  async updateVisitaAISummary(
    visitaId: string,
    empresaId: string,
    data: {
      resumoIA: string;
      pontosChaveIA: string[];
      tarefasSugeridasIA: any[];
    },
  ): Promise<Visita | undefined> {
    const [updated] = await db
      .update(visitas)
      .set({
        resumoIa: data.resumoIA,
        pontosChaveIA: JSON.stringify(data.pontosChaveIA),
        tarefasSugeridasIA: JSON.stringify(data.tarefasSugeridasIA),
        iaLastGeneratedAt: new Date(),
      })
      .where(and(eq(visitas.id, visitaId), eq(visitas.empresaId, empresaId)))
      .returning();
    return updated;
  }

  async updateVisita(
    id: string,
    visita: Partial<Visita>,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<Visita | undefined> {
    const whereClause =
      userId && userRole === "agent"
        ? and(
            eq(visitas.id, id),
            eq(visitas.empresaId, empresaId),
            or(
              eq(visitas.createdByUserId, userId),
              eq(visitas.assignedUserId, userId),
              eq(visitas.userId, userId),
            ),
          )
        : and(eq(visitas.id, id), eq(visitas.empresaId, empresaId));

    const [updated] = await db
      .update(visitas)
      .set(visita)
      .where(whereClause)
      .returning();
    return updated;
  }

  async deleteVisita(
    id: string,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<void> {
    const whereClause =
      userId && userRole === "agent"
        ? and(
            eq(visitas.id, id),
            eq(visitas.empresaId, empresaId),
            or(
              eq(visitas.createdByUserId, userId),
              eq(visitas.assignedUserId, userId),
              eq(visitas.userId, userId),
            ),
          )
        : and(eq(visitas.id, id), eq(visitas.empresaId, empresaId));

    await db.delete(visitas).where(whereClause);
  }

  // Tarefas
  async getTarefas(
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
    filters?: {
      status?: string;
      assignedUserId?: string;
      entidadeId?: string;
      visitaId?: string;
      overdue?: boolean;
    },
  ): Promise<TarefaWithRelations[]> {
    const conditions: any[] = [eq(tarefas.empresaId, empresaId)];

    if (userRole === "agent") {
      conditions.push(
        or(
          eq(tarefas.createdByUserId, userId),
          eq(tarefas.assignedUserId, userId),
        ),
      );
    }

    if (filters?.status) {
      conditions.push(eq(tarefas.status, filters.status as any));
    }
    if (filters?.assignedUserId) {
      conditions.push(eq(tarefas.assignedUserId, filters.assignedUserId));
    }
    if (filters?.entidadeId) {
      conditions.push(eq(tarefas.entidadeId, filters.entidadeId));
    }
    if (filters?.visitaId) {
      conditions.push(eq(tarefas.visitaId, filters.visitaId));
    }
    if (filters?.overdue) {
      conditions.push(
        and(
          eq(tarefas.status, "pending"),
          sql`${tarefas.dueDate} < NOW()`,
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db.query.tarefas.findMany({
      where: whereClause,
      orderBy: [desc(tarefas.createdAt)],
      with: {
        visita: true,
        entidade: true,
        assignedUser: true,
        createdByUser: true,
      },
    });

    return result as unknown as TarefaWithRelations[];
  }

  async getTarefa(
    id: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<TarefaWithRelations | undefined> {
    let whereClause;
    if (userRole === "agent") {
      whereClause = and(
        eq(tarefas.id, id),
        eq(tarefas.empresaId, empresaId),
        or(
          eq(tarefas.createdByUserId, userId),
          eq(tarefas.assignedUserId, userId),
        ),
      );
    } else {
      whereClause = and(eq(tarefas.id, id), eq(tarefas.empresaId, empresaId));
    }

    const tarefa = await db.query.tarefas.findFirst({
      where: whereClause,
      with: {
        visita: true,
        entidade: true,
        assignedUser: true,
        createdByUser: true,
      },
    });

    return tarefa as unknown as TarefaWithRelations | undefined;
  }

  async createTarefa(
    tarefaData: InsertTarefa,
    empresaId: string,
    createdByUserId: string,
  ): Promise<Tarefa> {
    const [tarefa] = await db
      .insert(tarefas)
      .values({
        ...tarefaData,
        empresaId,
        createdByUserId,
        updatedAt: new Date(),
      })
      .returning();

    return tarefa;
  }



  async updateTarefa(
    id: string,
    tarefaData: Partial<InsertTarefa>,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<Tarefa | undefined> {
    const whereClause =
      userId && userRole === "agent"
        ? and(
            eq(tarefas.id, id),
            eq(tarefas.empresaId, empresaId),
            or(
              eq(tarefas.createdByUserId, userId),
              eq(tarefas.assignedUserId, userId),
            ),
          )
        : and(eq(tarefas.id, id), eq(tarefas.empresaId, empresaId));

    const [tarefa] = await db
      .update(tarefas)
      .set({ ...tarefaData, updatedAt: new Date() })
      .where(whereClause)
      .returning();
    return tarefa;
  }

  async deleteTarefa(
    id: string,
    empresaId: string,
    userId?: string,
    userRole?: "admin" | "agent",
  ): Promise<void> {
    const whereClause =
      userId && userRole === "agent"
        ? and(
            eq(tarefas.id, id),
            eq(tarefas.empresaId, empresaId),
            or(
              eq(tarefas.createdByUserId, userId),
              eq(tarefas.assignedUserId, userId),
            ),
          )
        : and(eq(tarefas.id, id), eq(tarefas.empresaId, empresaId));

    await db.delete(tarefas).where(whereClause);
  }

  async getTarefasByVisitaId(
    visitaId: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<TarefaWithRelations[]> {
    const whereClause =
      userRole === "agent"
        ? and(
            eq(tarefas.visitaId, visitaId),
            eq(tarefas.empresaId, empresaId),
            or(
              eq(tarefas.createdByUserId, userId),
              eq(tarefas.assignedUserId, userId),
            ),
          )
        : and(eq(tarefas.visitaId, visitaId), eq(tarefas.empresaId, empresaId));

    const results = await db
      .select()
      .from(tarefas)
      .leftJoin(entidades, eq(tarefas.entidadeId, entidades.id))
      .where(whereClause)
      .orderBy(desc(tarefas.createdAt));

    return results.map((row: any) => ({
      ...(row.tarefas as any),
      entidade: (row.entidades as any) || undefined,
    })) as unknown as TarefaWithRelations[];
  }

  async getTarefasByEntidadeId(
    entidadeId: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<TarefaWithRelations[]> {
    const whereClause =
      userRole === "agent"
        ? and(
            eq(tarefas.entidadeId, entidadeId),
            eq(tarefas.empresaId, empresaId),
            or(
              eq(tarefas.createdByUserId, userId),
              eq(tarefas.assignedUserId, userId),
            ),
          )
        : and(
            eq(tarefas.entidadeId, entidadeId),
            eq(tarefas.empresaId, empresaId),
          );

    const results = await db
      .select()
      .from(tarefas)
      .leftJoin(entidades, eq(tarefas.entidadeId, entidades.id))
      .where(whereClause)
      .orderBy(desc(tarefas.createdAt));

    return results.map((row: any) => ({
      ...(row.tarefas as any),
      entidade: (row.entidades as any) || undefined,
    })) as unknown as TarefaWithRelations[];
  }

  async getTarefasInPeriod(
    startDate: Date,
    endDate: Date,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<TarefaWithRelations[]> {
    const whereClause =
      userRole === "agent"
        ? and(
            eq(tarefas.empresaId, empresaId),
            or(
              eq(tarefas.createdByUserId, userId),
              eq(tarefas.assignedUserId, userId),
            ),
            sql`${tarefas.dueDate} >= ${startDate}`,
            sql`${tarefas.dueDate} <= ${endDate}`,
          )
        : and(
            eq(tarefas.empresaId, empresaId),
            sql`${tarefas.dueDate} >= ${startDate}`,
            sql`${tarefas.dueDate} <= ${endDate}`,
          );

    const results = await db
      .select()
      .from(tarefas)
      .leftJoin(entidades, eq(tarefas.entidadeId, entidades.id))
      .where(whereClause)
      .orderBy(desc(tarefas.dueDate));

    return results.map((row: any) => ({
      ...(row.tarefas as any),
      entidade: (row.entidades as any) || undefined,
    })) as unknown as TarefaWithRelations[];
  }

  async getUnplannedTarefas(
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<TarefaWithRelations[]> {
    const accessClause =
      userRole === "agent"
        ? or(
            eq(tarefas.createdByUserId, userId),
            eq(tarefas.assignedUserId, userId),
          )
        : undefined;
    const whereClause = and(
      eq(tarefas.empresaId, empresaId),
      isNull(tarefas.dueDate),
      eq(tarefas.status, "pending"),
      accessClause,
    );

    const results = await db
      .select()
      .from(tarefas)
      .leftJoin(entidades, eq(tarefas.entidadeId, entidades.id))
      .where(whereClause)
      .orderBy(desc(tarefas.createdAt));

    return results.map((row: any) => ({
      ...(row.tarefas as any),
      entidade: (row.entidades as any) || undefined,
    })) as unknown as TarefaWithRelations[];
  }

  async getVisitasByEntidade(
    entidadeId: string,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<VisitaWithRelations[]> {
    const whereClause =
      userRole === "agent"
        ? and(
            eq(visitas.entidadeId, entidadeId),
            eq(visitas.empresaId, empresaId),
            eq(visitas.createdByUserId, userId),
          )
        : and(
            eq(visitas.entidadeId, entidadeId),
            eq(visitas.empresaId, empresaId),
          );

    const results = await db
      .select()
      .from(visitas)
      .leftJoin(entidades, eq(visitas.entidadeId, entidades.id))
      .where(whereClause)
      .orderBy(desc(visitas.dataVisita));

    return results.map((row: any) => ({
      ...(row.visitas as any),
      entidade: (row.entidades as any) || undefined,
    })) as unknown as VisitaWithRelations[];
  }

  async getVisitasInPeriod(
    startDate: Date,
    endDate: Date,
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<VisitaWithRelations[]> {
    const whereClause =
      userRole === "agent"
        ? and(
            eq(visitas.empresaId, empresaId),
            or(
              eq(visitas.createdByUserId, userId),
              eq(visitas.assignedUserId, userId),
              eq(visitas.userId, userId),
            ),
            sql`${visitas.dataVisita} >= ${startDate}`,
            sql`${visitas.dataVisita} <= ${endDate}`,
          )
        : and(
            eq(visitas.empresaId, empresaId),
            sql`${visitas.dataVisita} >= ${startDate}`,
            sql`${visitas.dataVisita} <= ${endDate}`,
          );

    const results = await db
      .select()
      .from(visitas)
      .leftJoin(entidades, eq(visitas.entidadeId, entidades.id))
      .where(whereClause)
      .orderBy(desc(visitas.dataVisita));

    return results.map((row: any) => ({
      ...(row.visitas as any),
      entidade: (row.entidades as any) || undefined,
    })) as unknown as VisitaWithRelations[];
  }

  async getAllEntidades(
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ): Promise<EntidadeWithRelations[]> {
    return (await this.getEntidades(
      empresaId,
      userId,
      userRole,
    )) as unknown as EntidadeWithRelations[];
  }

  async updateTarefaMicrosoftFields(
    id: string,
    fields: {
      plannerTaskId?: string;
      plannerPlanId?: string;
      plannerBucketId?: string;
      lastPlannerSyncAt?: Date;
      todoTaskId?: string;
      lastTodoSyncAt?: Date;
      microsoftUserId?: string;
    },
  ): Promise<Tarefa | undefined> {
    const [tarefa] = await db
      .update(tarefas)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(tarefas.id, id))
      .returning();
    return tarefa;
  }

  async updateVisitaMicrosoftFields(
    id: string,
    fields: {
      outlookEventId?: string;
      lastCalendarSyncAt?: Date;
    },
  ): Promise<Visita | undefined> {
    const [visita] = await db
      .update(visitas)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(visitas.id, id))
      .returning();
    return visita;
  }

  // Marcas
  async getMarcasByEmpresa(empresaId: string): Promise<Marca[]> {
    return db
      .select()
      .from(marcas)
      .where(eq(marcas.empresaId, empresaId))
      .orderBy(marcas.nome);
  }

  async getEntidadeTipos(empresaId: string): Promise<EntidadeTipo[]> {
    return db
      .select()
      .from(entidadeTipos)
      .where(eq(entidadeTipos.empresaId, empresaId))
      .orderBy(entidadeTipos.ordem, entidadeTipos.nome);
  }

  async getEntidadeTiposAtivos(empresaId: string): Promise<EntidadeTipo[]> {
    return db
      .select()
      .from(entidadeTipos)
      .where(
        and(
          eq(entidadeTipos.empresaId, empresaId),
          eq(entidadeTipos.ativo, true),
        ),
      )
      .orderBy(entidadeTipos.ordem, entidadeTipos.nome);
  }

  async getEntidadeTipo(
    id: string,
    empresaId: string,
  ): Promise<EntidadeTipo | undefined> {
    return db
      .select()
      .from(entidadeTipos)
      .where(and(eq(entidadeTipos.id, id), eq(entidadeTipos.empresaId, empresaId)))
      .then((res) => res[0]);
  }

  async createEntidadeTipo(
    tipo: InsertEntidadeTipo,
    empresaId: string,
  ): Promise<EntidadeTipo> {
    const result = await db
      .insert(entidadeTipos)
      .values({
        ...tipo,
        empresaId,
      })
      .returning();
    return result[0];
  }

  async updateEntidadeTipo(
    id: string,
    tipo: Partial<InsertEntidadeTipo>,
    empresaId: string,
  ): Promise<EntidadeTipo | undefined> {
    const result = await db
      .update(entidadeTipos)
      .set(tipo)
      .where(and(eq(entidadeTipos.id, id), eq(entidadeTipos.empresaId, empresaId)))
      .returning();
    return result[0];
  }

  async migrateEntidadeTipos(): Promise<{
    empresasProcessadas: number;
    entidadesMigradas: number;
    tiposCriados: number;
  }> {
    const empresas_list = await this.getAllEmpresas();
    let totalEntidadesMigradas = 0;
    let totalTiposCriados = 0;

    for (const empresa of empresas_list) {
      const distinct_tipos = await db
        .select({ tipoEntidade: entidades.tipoEntidade })
        .from(entidades)
        .where(
          and(
            eq(entidades.empresaId, empresa.id),
            sql`${entidades.tipoEntidade} IS NOT NULL AND ${entidades.tipoEntidade} != ''`,
          ),
        )
        .groupBy(entidades.tipoEntidade);

      for (const row of distinct_tipos) {
        const legacyTipo = (row as any).tipoEntidade as string | null;
        if (!legacyTipo) continue;

        let tipoId = await db
          .select({ id: entidadeTipos.id })
          .from(entidadeTipos)
          .where(
            and(
              eq(entidadeTipos.empresaId, empresa.id),
              eq(entidadeTipos.nome, legacyTipo),
            ),
          )
          .then((res) => res[0]?.id);

        if (!tipoId) {
          const newTipo = await db
            .insert(entidadeTipos)
            .values({
              empresaId: empresa.id,
              nome: legacyTipo,
              cor: "#808080",
              ativo: true,
              ordem: 0,
            })
            .returning()
            .then((res) => res[0]);
          tipoId = newTipo.id;
          totalTiposCriados++;
        }

        const updateResult = await db
          .update(entidades)
          .set({ entidadeTipoId: tipoId })
          .where(
            and(
              eq(entidades.empresaId, empresa.id),
              eq(entidades.tipoEntidade, legacyTipo as any),
              sql`${entidades.entidadeTipoId} IS NULL`,
            ),
          )
          .returning();

        totalEntidadesMigradas += updateResult.length;
      }
    }

    return {
      empresasProcessadas: empresas_list.length,
      entidadesMigradas: totalEntidadesMigradas,
      tiposCriados: totalTiposCriados,
    };
  }

  async getMarcasByEmpresaAtiva(empresaId: string): Promise<Marca[]> {
    return db
      .select()
      .from(marcas)
      .where(and(eq(marcas.empresaId, empresaId), eq(marcas.ativa, true)))
      .orderBy(marcas.nome);
  }

  async getMarca(id: string): Promise<Marca | undefined> {
    const [marca] = await db.select().from(marcas).where(eq(marcas.id, id));
    return marca;
  }

  async createMarca(marca: InsertMarca): Promise<Marca> {
    const result = await db.insert(marcas).values(marca as any).returning();
    if (!result[0]) {
      throw new Error(
        "Insert returned empty result - possible constraint violation",
      );
    }
    return result[0];
  }

  async updateMarca(
    id: string,
    marca: Partial<InsertMarca>,
    empresaId: string,
  ): Promise<Marca | undefined> {
    const [updated] = await db
      .update(marcas)
      .set({ ...marca, updatedAt: new Date() })
      .where(and(eq(marcas.id, id), eq(marcas.empresaId, empresaId)))
      .returning();
    return updated;
  }

  async updateEmpresa(
    id: string,
    empresa: Partial<InsertEmpresa>,
  ): Promise<Empresa | undefined> {
    const [updated] = await db
      .update(empresas)
      .set({ ...empresa, updatedAt: new Date() })
      .where(eq(empresas.id, id))
      .returning();
    return updated;
  }

  async getUtilizadoresByEmpresa(empresaId: string): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(eq(users.empresaId, empresaId))
      .orderBy(users.email);
  }

  async createUtilizador(userData: UpsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(userData).returning();
    return newUser;
  }

  async updateUtilizador(
    id: string,
    userData: Partial<UpsertUser>,
    empresaId: string,
  ): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.empresaId, empresaId)))
      .returning();
    return updated;
  }

  async getUserSettings(userId: string): Promise<User | undefined> {
    return await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
  }

  async updateUserSettings(
    userId: string,
    settings: any,
  ): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ userSettings: settings, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async getNearbyVisitSuggestions(
    empresaId: string,
    lat: number,
    lng: number,
    options: {
      userId?: string;
      userRole?: "admin" | "agent";
      inactivityDays?: number;
    } = {},
  ): Promise<any> {
    const entidades_list = await db.query.entidades.findMany({
      where: and(
        eq(entidades.empresaId, empresaId),
        and(
          sql`${entidades.latitude} IS NOT NULL`,
          sql`${entidades.longitude} IS NOT NULL`,
        ),
        options.userRole === "agent" && options.userId
          ? or(
              eq(entidades.assignedUserId, options.userId),
              eq(entidades.createdByUserId, options.userId),
            )
          : undefined,
      ),
      with: {
        visitas: {
          orderBy: desc(visitas.dataVisita),
          limit: 10,
        },
      },
    });

    const allWithDistance = entidades_list
      .filter(
        (entity: any) =>
          entity.proximityAlertsEnabled === true ||
          entity.visitas.some(
            (visit: any) => visit.proximityAlertsEnabled === true,
          ),
      )
      .map((e: any) => {
        const elat = parseFloat(e.latitude as any);
        const elng = parseFloat(e.longitude as any);
        const distance = haversineDistance(lat, lng, elat, elng);
        return { ...e, distance };
      })
      .filter((e) => Number.isFinite(e.distance));

    const entitiesWithinTwoKm = allWithDistance.filter(
      (entity) => entity.distance <= 2000,
    ).length;
    const radiusMeters =
      entitiesWithinTwoKm >= 20 ? 250 : entitiesWithinTwoKm >= 8 ? 600 : 2000;
    const entidadesWithDistance = allWithDistance
      .filter((e) => e.distance <= radiusMeters)
      .sort((a, b) => a.distance - b.distance);

    if (entidadesWithDistance.length === 0) {
      return { suggestions: [], radiusMeters, density: "none" };
    }

    const today = new Date();
    const candidateIds = entidadesWithDistance.map((entity) => entity.id);
    const overdueTasks = await db
      .select()
      .from(tarefas)
      .where(
        and(
          eq(tarefas.empresaId, empresaId),
          inArray(tarefas.entidadeId, candidateIds),
          ne(tarefas.status, "done"),
          sql`${tarefas.dueDate} IS NOT NULL AND ${tarefas.dueDate} < ${today}`,
          options.userRole === "agent" && options.userId
            ? or(
                eq(tarefas.assignedUserId, options.userId),
                eq(tarefas.createdByUserId, options.userId),
              )
            : undefined,
        ),
      );
    const tasksByEntity = new Map<string, typeof overdueTasks>();
    for (const task of overdueTasks) {
      if (!task.entidadeId) continue;
      tasksByEntity.set(task.entidadeId, [
        ...(tasksByEntity.get(task.entidadeId) ?? []),
        task,
      ]);
    }

    const inactivityDays = Math.max(7, options.inactivityDays ?? 60);
    const suggestions: any[] = [];
    for (const entity of entidadesWithDistance) {
      const task = entity.proximityAlertsEnabled
        ? tasksByEntity.get(entity.id)?.sort(
        (a, b) =>
          new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime(),
          )[0]
        : undefined;
      if (task) {
        suggestions.push({
          tipo: "tarefa_atrasada",
          entidadeId: entity.id,
          entidadeNome: entity.nome,
          tarefaId: task.id,
          tarefaTitulo: task.titulo,
          dataVencimento: task.dueDate?.toISOString().split("T")[0],
          distanciaMetros: Math.round(entity.distance),
        });
        continue;
      }

      const overdueVisit = entity.visitas.find(
        (visit: any) =>
          visit.proximityAlertsEnabled === true &&
          visit.proximaVisita &&
          new Date(visit.proximaVisita) < today &&
          visit.proximaVisitaStatus !== "realizada",
      );
      if (overdueVisit) {
        suggestions.push({
          tipo: "visita_atrasada",
          entidadeId: entity.id,
          entidadeNome: entity.nome,
          visitaId: overdueVisit.id,
          dataVisita: new Date(overdueVisit.proximaVisita)
            .toISOString()
            .split("T")[0],
          distanciaMetros: Math.round(entity.distance),
        });
        continue;
      }

      const lastVisita = entity.visitas[0];
      if (!entity.proximityAlertsEnabled) continue;
      if (!lastVisita) {
        suggestions.push({
          tipo: "nunca_visitada",
          entidadeId: entity.id,
          entidadeNome: entity.nome,
          distanciaMetros: Math.round(entity.distance),
        });
        continue;
      }
      const daysSinceLastVisit = Math.floor(
        (today.getTime() - new Date(lastVisita.dataVisita).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysSinceLastVisit >= inactivityDays) {
        suggestions.push({
          tipo: "sem_visita_recente",
          entidadeId: entity.id,
          entidadeNome: entity.nome,
          diasDesdeUltimaVisita: daysSinceLastVisit,
          distanciaMetros: Math.round(entity.distance),
        });
      }
    }

    return {
      suggestions: suggestions.slice(0, 5),
      radiusMeters,
      density:
        entitiesWithinTwoKm >= 20
          ? "urban"
          : entitiesWithinTwoKm >= 8
            ? "mixed"
            : "rural",
    };
  }

  async getMarcas(): Promise<Marca[]> {
    return db.select().from(marcas).orderBy(marcas.nome);
  }

  async getDashboardStats(
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
  ) {
    let visitasWhereClause;
    if (userRole === "agent") {
      visitasWhereClause = and(
        eq(visitas.empresaId, empresaId),
        or(
          eq(visitas.createdByUserId, userId),
          eq(visitas.assignedUserId, userId),
        ),
      );
    } else {
      visitasWhereClause = eq(visitas.empresaId, empresaId);
    }

    const allVisitas = await db.query.visitas.findMany({
      where: visitasWhereClause,
      with: {
        entidade: true,
        contacto: true,
      },
    });

    const totalVisitas = allVisitas.length;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const visitasEstesMes = allVisitas.filter(
      (v) => new Date(v.dataVisita) >= startOfMonth,
    ).length;

    let entidadesCount;
    if (userRole === "admin") {
      entidadesCount = await db
        .select({ count: sql<number>`count(distinct ${entidades.id})` })
        .from(entidades)
        .where(eq(entidades.empresaId, empresaId));
    } else {
      entidadesCount = await db
        .select({ count: sql<number>`count(distinct ${entidades.id})` })
        .from(entidades)
        .where(
          and(
            eq(entidades.empresaId, empresaId),
            or(
              eq(entidades.createdByUserId, userId),
              eq(entidades.assignedUserId, userId),
            ),
          ),
        );
    }
    const totalEntidades = Number(entidadesCount[0]?.count || 0);

    let contactosCount;
    if (userRole === "admin") {
      contactosCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(contactos)
        .where(eq(contactos.empresaId, empresaId));
    } else {
      contactosCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(contactos)
        .where(
          and(
            eq(contactos.empresaId, empresaId),
            or(
              eq(contactos.createdByUserId, userId),
              eq(contactos.assignedUserId, userId),
            ),
          ),
        );
    }
    const totalContactos = Number(contactosCount[0]?.count || 0);

    const marcasMap = new Map<string, number>();
    (allVisitas as any[]).forEach((visita: any) => {
      visita.marcasEntregues?.forEach((marca: string) => {
        marcasMap.set(marca, (marcasMap.get(marca) || 0) + 1);
      });
    });

    const marcasMaisEntregues = Array.from(marcasMap.entries())
      .map(([marca, count]) => ({ marca, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const proximasVisitas = (allVisitas as any[])
      .filter(
        (v: any) => v.proximaVisita && new Date(v.proximaVisita) >= now,
      )
      .sort(
        (a: any, b: any) =>
          new Date(a.proximaVisita!).getTime() -
          new Date(b.proximaVisita!).getTime(),
      )
      .slice(0, 5) as VisitaWithRelations[];

    return {
      totalEntidades,
      totalContactos,
      totalVisitas,
      visitasEstesMes,
      marcasMaisEntregues,
      proximasVisitas,
    };
  }

  async getAnalytics(
    empresaId: string,
    userId: string,
    userRole: "admin" | "agent",
    filters?: {
      period?: number;
      agente?: string;
      tipoEntidade?: string;
    },
  ) {
    const periodDays = filters?.period || 365;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    let visitasWhereClause: any;
    let tarefasWhereClause: any;
    let entidadesWhereClause: any;

    if (userRole === "agent") {
      visitasWhereClause = and(
        eq(visitas.empresaId, empresaId),
        or(
          eq(visitas.createdByUserId, userId),
          eq(visitas.assignedUserId, userId),
        ),
      );
      tarefasWhereClause = and(
        eq(tarefas.empresaId, empresaId),
        or(
          eq(tarefas.createdByUserId, userId),
          eq(tarefas.assignedUserId, userId),
        ),
      );
      entidadesWhereClause = and(
        eq(entidades.empresaId, empresaId),
        or(
          eq(entidades.createdByUserId, userId),
          eq(entidades.assignedUserId, userId),
        ),
      );
    } else {
      visitasWhereClause = eq(visitas.empresaId, empresaId);
      tarefasWhereClause = eq(tarefas.empresaId, empresaId);
      entidadesWhereClause = eq(entidades.empresaId, empresaId);
    }

    if (filters?.agente && userRole === "admin") {
      visitasWhereClause = and(
        eq(visitas.empresaId, empresaId),
        or(
          eq(visitas.createdByUserId, filters.agente),
          eq(visitas.assignedUserId, filters.agente),
        ),
      );
      tarefasWhereClause = and(
        eq(tarefas.empresaId, empresaId),
        or(
          eq(tarefas.createdByUserId, filters.agente),
          eq(tarefas.assignedUserId, filters.agente),
        ),
      );
    }

    let allVisitas = await db.query.visitas.findMany({
      where: visitasWhereClause,
      with: {
        entidade: true,
        contacto: true,
      },
    });

    allVisitas = allVisitas.filter(
      (v) => new Date(v.dataVisita) >= cutoffDate,
    );

    let filteredVisitas = allVisitas as VisitaWithRelations[];

    if (
      filters &&
      !Array.isArray(filters) &&
      'tipoEntidade' in filters &&
      filters.tipoEntidade
    ) {
      filteredVisitas = filteredVisitas.filter(
        (v) => v.entidade?.tipoEntidade === filters.tipoEntidade,
      );
    }


    const allTarefas = await db.query.tarefas.findMany({
      where: tarefasWhereClause,
      with: {
        entidade: true,
        visita: true,
      },
    });

    const allEntidades = await db.query.entidades.findMany({
      where: entidadesWhereClause,
    });

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const total_visits = filteredVisitas.length;
    const visits_last_7_days = filteredVisitas.filter(
      (v) => new Date(v.dataVisita) >= sevenDaysAgo,
    ).length;
    const visits_last_30_days = filteredVisitas.filter(
      (v) => new Date(v.dataVisita) >= thirtyDaysAgo,
    ).length;

    const visitsByAgentMap = new Map<string, number>();
    const userCache = new Map<string, User>();

    for (const visita of filteredVisitas as any[]) {
      const agentId =
        visita.createdByUserId || visita.userId || "Desconhecido";
      visitsByAgentMap.set(agentId, (visitsByAgentMap.get(agentId) || 0) + 1);

      if (agentId !== "Desconhecido" && !userCache.has(agentId)) {
        const user = await this.getUser(agentId);
        if (user) userCache.set(agentId, user);
      }
    }

    const visits_by_agent = Array.from(visitsByAgentMap.entries())
      .map(([agentId, count]) => {
        const user = userCache.get(agentId);
        const agentName = user
          ? `${user.firstName} ${user.lastName}`
          : "Desconhecido";
        return { agent: agentName, count };
      })
      .sort((a, b) => b.count - a.count);

    const visitsByEntityTypeMap = new Map<string, number>();
    (filteredVisitas as any[]).forEach((v: any) => {
      const tipo = v.entidade?.tipoEntidade || "Desconhecido";
      visitsByEntityTypeMap.set(tipo, (visitsByEntityTypeMap.get(tipo) || 0) + 1);
    });

    const visits_by_entity_type = Array.from(
      visitsByEntityTypeMap.entries(),
    ).map(([tipo, count]) => ({ tipo, count }));

    const visitsByMonthMap = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = date.toLocaleDateString("pt-PT", {
        year: "numeric",
        month: "short",
      });
      visitsByMonthMap.set(key, 0);
    }

    (filteredVisitas as any[]).forEach((v: any) => {
      const date = new Date(v.dataVisita);
      const key = date.toLocaleDateString("pt-PT", {
        year: "numeric",
        month: "short",
      });
      if (visitsByMonthMap.has(key)) {
        visitsByMonthMap.set(key, (visitsByMonthMap.get(key) || 0) + 1);
      }
    });

    const visits_by_month = Array.from(visitsByMonthMap.entries()).map(
      ([month, count]) => ({ month, count }),
    );

    const entityVisitCountMap = new Map<
      string,
      { id: string; nome: string; count: number }
    >();
    (filteredVisitas as any[]).forEach((v: any) => {
      if (v.entidade) {
        const key = v.entidade.id.toString();
        const existing = entityVisitCountMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          entityVisitCountMap.set(key, {
            id: v.entidade.id.toString(),
            nome: v.entidade.nome,
            count: 1,
          });
        }
      }
    });

    const most_visited_entities = Array.from(entityVisitCountMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const gps_heatmap = (filteredVisitas as any[])
      .filter((v: any) => v.latitude && v.longitude)
      .map((v: any) => ({
        lat: parseFloat(v.latitude),
        lon: parseFloat(v.longitude),
        date: new Date(v.dataVisita).toISOString(),
      }));

    const tasks_pending = allTarefas.filter((t) => t.status === "pending").length;
    const tasks_overdue = allTarefas.filter(
      (t) =>
        t.status === "pending" &&
        t.dueDate &&
        new Date(t.dueDate) < now,
    ).length;
    const tasks_completed_this_week = allTarefas.filter(
      (t) =>
        t.status === "done" &&
        t.updatedAt &&
        new Date(t.updatedAt) >= startOfWeek,
    ).length;

    const tasksByAgentMap = new Map<string, number>();
    for (const tarefa of allTarefas as any[]) {
      const agentId = tarefa.createdByUserId || "Desconhecido";
      tasksByAgentMap.set(agentId, (tasksByAgentMap.get(agentId) || 0) + 1);

      if (agentId !== "Desconhecido" && !userCache.has(agentId)) {
        const user = await this.getUser(agentId);
        if (user) userCache.set(agentId, user);
      }
    }

    const tasks_by_agent = Array.from(tasksByAgentMap.entries())
      .map(([agentId, count]) => {
        const user = userCache.get(agentId);
        const agentName = user
          ? `${user.firstName} ${user.lastName}`
          : "Desconhecido";
        return { agent: agentName, count };
      })
      .sort((a, b) => b.count - a.count);

    const tasksByStatusMap = new Map<string, number>();
    allTarefas.forEach((t) => {
      const status = t.status === "pending" ? "Pendente" : "Concluída";
      tasksByStatusMap.set(status, (tasksByStatusMap.get(status) || 0) + 1);
    });

    const tasks_by_status = Array.from(tasksByStatusMap.entries()).map(
      ([status, count]) => ({ status, count }),
    );

    const tasksByRepeatMap = new Map<string, number>();
    allTarefas.forEach((t) => {
      const interval =
        t.repeatInterval === "none"
          ? "Sem repetição"
          : t.repeatInterval || "Sem repetição";
      tasksByRepeatMap.set(interval, (tasksByRepeatMap.get(interval) || 0) + 1);
    });

    const tasks_by_repeat_interval = Array.from(
      tasksByRepeatMap.entries(),
    ).map(([interval, count]) => ({ interval, count }));

    const entityTypeMap = new Map<string, number>();
    allEntidades.forEach((e: any) => {
      const tipo = e.tipoEntidade || "Desconhecido";
      entityTypeMap.set(tipo, (entityTypeMap.get(tipo) || 0) + 1);
    });

    const entities_by_type = Array.from(entityTypeMap.entries())
      .map(([tipo, count]) => ({ tipo, count }))
      .sort((a, b) => b.count - a.count);

    const entities_created_last_30_days = allEntidades.filter(
      (e) => e.createdAt && new Date(e.createdAt) >= thirtyDaysAgo,
    ).length;

    const entities_with_visits_count = most_visited_entities;

    const brandFrequencyMap = new Map<string, number>();
    (filteredVisitas as any[]).forEach((v: any) => {
      v.marcasEntregues?.forEach((marca: string) => {
        brandFrequencyMap.set(
          marca,
          (brandFrequencyMap.get(marca) || 0) + 1,
        );
      });
    });

    const brand_frequency = Array.from(brandFrequencyMap.entries())
      .map(([marca, count]) => ({ marca, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      visits: {
        total_visits,
        visits_last_7_days,
        visits_last_30_days,
        visits_by_agent,
        visits_by_entity_type,
        visits_by_month,
        most_visited_entities,
        gps_heatmap,
      },
      tasks: {
        tasks_pending,
        tasks_overdue,
        tasks_completed_this_week,
        tasks_by_agent,
        tasks_by_status,
        tasks_by_repeat_interval,
      },
      entities: {
        entities_by_type,
        entities_created_last_30_days,
        entities_with_visits_count,
      },
      brands: {
        brand_frequency,
      },
    };
  }

  // ODOO CONTACT REQUESTS
  async createOdooContactRequest(
    input: InsertOdooContactRequest,
  ): Promise<OdooContactRequest> {
    const data = insertOdooContactRequestSchema.parse(input);

    const filters: any[] = [
      eq(odooContactRequests.empresaId, data.empresaId),
      eq(odooContactRequests.tipo, data.tipo),
      or(
        eq(odooContactRequests.estado, "pendente"),
        eq(odooContactRequests.estado, "em_progresso"),
      ),
    ];

    if (data.tipo === "contacto" && data.contactoId) {
      filters.push(eq(odooContactRequests.contactoId, data.contactoId));
    }

    if (data.tipo === "entidade" && data.entidadeId) {
      filters.push(eq(odooContactRequests.entidadeId, data.entidadeId));
    }

    if (filters.length > 3) {
      const existing = await db
        .select({ id: odooContactRequests.id })
        .from(odooContactRequests)
        .where(and(...filters))
        .limit(1);

      if (existing.length > 0) {
        throw new Error(
          data.tipo === "contacto"
            ? "Já existe um pedido de CRM pendente ou em progresso para este contacto."
            : "Já existe um pedido de CRM pendente ou em progresso para esta entidade.",
        );
      }
    }

    const [created] = await db
      .insert(odooContactRequests)
      .values(data)
      .returning();

    return created;
  }

  async listOdooContactRequestsByEmpresa(
    empresaId: string,
  ): Promise<(OdooContactRequest & { userName?: string | null })[]> {
    const rows = await db
      .select({
        request: odooContactRequests,
        user: users,
      })
      .from(odooContactRequests)
      .leftJoin(users, eq(odooContactRequests.userId, users.id))
      .where(eq(odooContactRequests.empresaId, empresaId))
      .orderBy(desc(odooContactRequests.createdAt));

    return rows.map(({ request, user }) => {
      let userName: string | null = null;

      if (user) {
        const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
        userName = fullName || user.email || null;
      }

      return {
        ...(request as any),
        userName,
      };
    });
  }

  async updateOdooContactRequestStatus(
    empresaId: string,
    requestId: string,
    estado: "pendente" | "em_progresso" | "concluido",
  ): Promise<OdooContactRequest | null> {
    const [updated] = await db
      .update(odooContactRequests)
      .set({ estado })
      .where(
        and(
          eq(odooContactRequests.id, requestId),
          eq(odooContactRequests.empresaId, empresaId),
        ),
      )
      .returning();

    return updated ?? null;
  }
}

export const storage = new DatabaseStorage();
