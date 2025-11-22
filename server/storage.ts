import {
  empresas,
  users,
  entidades,
  contactos,
  visitas,
  tarefas,
  marcas,
  lembretes,
  type Empresa,
  type InsertEmpresa,
  type User,
  type UpsertUser,
  type Entidade,
  type InsertEntidade,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, gte, sql, or, and } from "drizzle-orm";

export interface IStorage {
  // Empresas (Multi-tenant)
  getEmpresa(id: string): Promise<Empresa | undefined>;
  createEmpresa(empresa: InsertEmpresa): Promise<Empresa>;
  getAllEmpresas(): Promise<Empresa[]>;

  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Entidades (Universal Entities)
  getEntidades(userId: string, userRole: 'admin' | 'agent'): Promise<Entidade[]>;
  getEntidade(id: string, userId: string, userRole: 'admin' | 'agent'): Promise<EntidadeWithRelations | undefined>;
  findEntidadeByNome(nome: string, userId: string, userRole: 'admin' | 'agent'): Promise<Entidade | undefined>;
  findEntidadeByDomain(domain: string, userId: string, userRole: 'admin' | 'agent'): Promise<Entidade | undefined>;
  createEntidade(entidade: InsertEntidade): Promise<Entidade>;
  updateEntidade(id: string, entidade: Partial<InsertEntidade>, userId?: string, userRole?: 'admin' | 'agent'): Promise<Entidade | undefined>;
  deleteEntidade(id: string, userId?: string, userRole?: 'admin' | 'agent'): Promise<void>;
  checkEntidadeHasRelations(id: string): Promise<boolean>;
  
  // Contactos
  getContactos(userId: string, userRole: 'admin' | 'agent'): Promise<ContactoWithRelations[]>;
  getContacto(id: string, userId: string, userRole: 'admin' | 'agent'): Promise<ContactoWithRelations | undefined>;
  createContacto(contacto: InsertContacto): Promise<Contacto>;
  updateContacto(id: string, contacto: Partial<InsertContacto>, userId?: string, userRole?: 'admin' | 'agent'): Promise<Contacto | undefined>;
  deleteContacto(id: string, userId?: string, userRole?: 'admin' | 'agent'): Promise<void>;
  
  // Visitas
  getVisitas(userId: string, userRole: 'admin' | 'agent'): Promise<VisitaWithRelations[]>;
  getVisita(id: string, userId: string, userRole: 'admin' | 'agent'): Promise<VisitaWithRelations | undefined>;
  createVisita(visita: InsertVisita): Promise<Visita>;
  updateVisita(id: string, visita: Partial<Visita>, userId?: string, userRole?: 'admin' | 'agent'): Promise<Visita | undefined>;
  deleteVisita(id: string, userId?: string, userRole?: 'admin' | 'agent'): Promise<void>;
  
  // Tarefas
  getTarefas(userId: string, userRole: 'admin' | 'agent', filters?: { status?: string; assignedUserId?: string; entidadeId?: string; overdue?: boolean }): Promise<TarefaWithRelations[]>;
  getTarefa(id: string, userId: string, userRole: 'admin' | 'agent'): Promise<TarefaWithRelations | undefined>;
  createTarefa(tarefa: InsertTarefa): Promise<Tarefa>;
  updateTarefa(id: string, tarefa: Partial<InsertTarefa>, userId?: string, userRole?: 'admin' | 'agent'): Promise<Tarefa | undefined>;
  deleteTarefa(id: string, userId?: string, userRole?: 'admin' | 'agent'): Promise<void>;
  getTarefasByVisitaId(visitaId: string, userId: string, userRole: 'admin' | 'agent'): Promise<TarefaWithRelations[]>;
  getTarefasByEntidadeId(entidadeId: string, userId: string, userRole: 'admin' | 'agent'): Promise<TarefaWithRelations[]>;
  getTarefasInPeriod(startDate: Date, endDate: Date, userId: string, userRole: 'admin' | 'agent'): Promise<TarefaWithRelations[]>;
  
  // Visitas helpers
  getVisitasByEntidade(entidadeId: string, userId: string, userRole: 'admin' | 'agent'): Promise<VisitaWithRelations[]>;
  getVisitasInPeriod(startDate: Date, endDate: Date, userId: string, userRole: 'admin' | 'agent'): Promise<VisitaWithRelations[]>;
  
  // Entidades helpers
  getAllEntidades(userId: string, userRole: 'admin' | 'agent'): Promise<EntidadeWithRelations[]>;
  
  // Marcas (by empresa)
  getMarcasByEmpresa(empresaId: string): Promise<Marca[]>;
  getMarcasByEmpresaAtiva(empresaId: string): Promise<Marca[]>;
  getMarca(id: string): Promise<Marca | undefined>;
  createMarca(marca: InsertMarca): Promise<Marca>;
  
  // Legacy Marcas (deprecated - for migration)
  getMarcas(): Promise<Marca[]>;
  
  // Dashboard stats
  getDashboardStats(userId: string, userRole: 'admin' | 'agent'): Promise<{
    totalEntidades: number;
    totalContactos: number;
    totalVisitas: number;
    visitasEstesMes: number;
    marcasMaisEntregues: { marca: string; count: number }[];
    proximasVisitas: VisitaWithRelations[];
  }>;

  // Analytics
  getAnalytics(userId: string, userRole: 'admin' | 'agent', filters?: {
    period?: number; // days
    agente?: string; // user id
    tipoEntidade?: string;
  }): Promise<{
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
      entities_with_visits_count: { id: string; nome: string; count: number }[];
    };
    brands: {
      brand_frequency: { marca: string; count: number }[];
    };
  }>;
}

export class DatabaseStorage implements IStorage {
  // Empresas
  async getEmpresa(id: string): Promise<Empresa | undefined> {
    const [empresa] = await db.select().from(empresas).where(eq(empresas.id, id));
    return empresa;
  }

  async createEmpresa(empresaData: InsertEmpresa): Promise<Empresa> {
    const [empresa] = await db
      .insert(empresas)
      .values(empresaData)
      .returning();
    return empresa;
  }

  async getAllEmpresas(): Promise<Empresa[]> {
    return db.select().from(empresas).orderBy(empresas.nome);
  }

  // User operations
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

  // Entidades (Universal Entities)
  async getEntidades(userId: string, userRole: 'admin' | 'agent'): Promise<EntidadeWithRelations[]> {
    // Admin sees all entidades, agents see only their created/assigned ones
    let whereClause;
    if (userRole === 'agent') {
      whereClause = or(
        eq(entidades.createdByUserId, userId),
        eq(entidades.assignedUserId, userId)
      );
    }
    
    return db.query.entidades.findMany({
      where: whereClause,
      orderBy: desc(entidades.createdAt),
      with: {
        assignedUser: true,
        createdByUser: true,
      },
    });
  }

  async getEntidade(id: string, userId: string, userRole: 'admin' | 'agent'): Promise<EntidadeWithRelations | undefined> {
    // Build the where clause based on role
    let whereClause;
    if (userRole === 'admin') {
      whereClause = eq(entidades.id, id);
    } else {
      whereClause = and(
        eq(entidades.id, id),
        or(
          eq(entidades.createdByUserId, userId),
          eq(entidades.assignedUserId, userId)
        )
      );
    }
    
    const [entidade] = await db.query.entidades.findMany({
      where: whereClause,
      with: {
        contactos: true,
        visitas: {
          orderBy: desc(visitas.dataVisita),
          limit: 10,
        },
      },
    });
    return entidade;
  }

  async findEntidadeByNome(nome: string, userId: string, userRole: 'admin' | 'agent'): Promise<Entidade | undefined> {
    // Build the where clause based on role
    let whereClause;
    if (userRole === 'admin') {
      whereClause = sql`LOWER(${entidades.nome}) = LOWER(${nome})`;
    } else {
      whereClause = and(
        sql`LOWER(${entidades.nome}) = LOWER(${nome})`,
        or(
          eq(entidades.createdByUserId, userId),
          eq(entidades.assignedUserId, userId)
        )
      );
    }
    
    const [entidade] = await db
      .select()
      .from(entidades)
      .where(whereClause)
      .limit(1);
    
    return entidade;
  }

  async findEntidadeByDomain(domain: string, userId: string, userRole: 'admin' | 'agent'): Promise<Entidade | undefined> {
    // Build the where clause based on role
    let whereClause;
    if (userRole === 'admin') {
      whereClause = sql`LOWER(${entidades.domain}) = LOWER(${domain})`;
    } else {
      whereClause = and(
        sql`LOWER(${entidades.domain}) = LOWER(${domain})`,
        or(
          eq(entidades.createdByUserId, userId),
          eq(entidades.assignedUserId, userId)
        )
      );
    }
    
    const [entidade] = await db
      .select()
      .from(entidades)
      .where(whereClause)
      .limit(1);
    
    return entidade;
  }

  async createEntidade(entidadeData: InsertEntidade): Promise<Entidade> {
    const [entidade] = await db
      .insert(entidades)
      .values({ ...entidadeData, updatedAt: new Date() })
      .returning();
    return entidade;
  }

  async updateEntidade(id: string, entidadeData: Partial<InsertEntidade>, userId?: string, userRole?: 'admin' | 'agent'): Promise<Entidade | undefined> {
    // Build where clause: admin or no auth = id only, agent = id + ownership
    const whereClause = (userId && userRole === 'agent')
      ? and(
          eq(entidades.id, id),
          or(
            eq(entidades.createdByUserId, userId),
            eq(entidades.assignedUserId, userId)
          )
        )
      : eq(entidades.id, id);
    
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

  async deleteEntidade(id: string, userId?: string, userRole?: 'admin' | 'agent'): Promise<void> {
    // Build where clause: admin or no auth = id only, agent = id + ownership
    const whereClause = (userId && userRole === 'agent')
      ? and(
          eq(entidades.id, id),
          or(
            eq(entidades.createdByUserId, userId),
            eq(entidades.assignedUserId, userId)
          )
        )
      : eq(entidades.id, id);
    
    await db.delete(entidades).where(whereClause);
  }

  // Contactos
  async getContactos(userId: string, userRole: 'admin' | 'agent'): Promise<ContactoWithRelations[]> {
    // Admin sees all contactos, agents see only their created/assigned ones
    let whereClause;
    if (userRole === 'agent') {
      whereClause = or(
        eq(contactos.createdByUserId, userId),
        eq(contactos.assignedUserId, userId)
      );
    }
    
    return db.query.contactos.findMany({
      where: whereClause,
      orderBy: desc(contactos.createdAt),
      with: {
        entidade: true,
        assignedUser: true,
        createdByUser: true,
      },
    });
  }

  async getContacto(id: string, userId: string, userRole: 'admin' | 'agent'): Promise<ContactoWithRelations | undefined> {
    // Build the where clause based on role
    let whereClause;
    if (userRole === 'admin') {
      whereClause = eq(contactos.id, id);
    } else {
      whereClause = and(
        eq(contactos.id, id),
        or(
          eq(contactos.createdByUserId, userId),
          eq(contactos.assignedUserId, userId)
        )
      );
    }
    
    return db.query.contactos.findFirst({
      where: whereClause,
      with: {
        entidade: true,
      },
    });
  }

  async createContacto(contacto: InsertContacto): Promise<Contacto> {
    const [newContacto] = await db
      .insert(contactos)
      .values(contacto)
      .returning();
    return newContacto;
  }

  async updateContacto(id: string, contacto: Partial<InsertContacto>, userId?: string, userRole?: 'admin' | 'agent'): Promise<Contacto | undefined> {
    // Build where clause: admin or no auth = id only, agent = id + ownership
    const whereClause = (userId && userRole === 'agent')
      ? and(
          eq(contactos.id, id),
          or(
            eq(contactos.createdByUserId, userId),
            eq(contactos.assignedUserId, userId)
          )
        )
      : eq(contactos.id, id);
    
    const [updated] = await db
      .update(contactos)
      .set(contacto)
      .where(whereClause)
      .returning();
    return updated;
  }

  async deleteContacto(id: string, userId?: string, userRole?: 'admin' | 'agent'): Promise<void> {
    // Build where clause: admin or no auth = id only, agent = id + ownership
    const whereClause = (userId && userRole === 'agent')
      ? and(
          eq(contactos.id, id),
          or(
            eq(contactos.createdByUserId, userId),
            eq(contactos.assignedUserId, userId)
          )
        )
      : eq(contactos.id, id);
    
    await db.delete(contactos).where(whereClause);
  }

  // Visitas
  async getVisitas(userId: string, userRole: 'admin' | 'agent'): Promise<VisitaWithRelations[]> {
    // Admin sees all visitas, agents see only their created/assigned ones
    let whereClause;
    if (userRole === 'agent') {
      whereClause = or(
        eq(visitas.createdByUserId, userId),
        eq(visitas.assignedUserId, userId),
        eq(visitas.userId, userId) // Fallback to legacy userId field for historical data
      );
    }
    
    return db.query.visitas.findMany({
      where: whereClause,
      orderBy: desc(visitas.dataVisita),
      with: {
        entidade: true,
        contacto: true,
        user: true,
        assignedUser: true,
        createdByUser: true,
      },
    });
  }

  async getVisita(id: string, userId: string, userRole: 'admin' | 'agent'): Promise<VisitaWithRelations | undefined> {
    // Build the where clause based on role
    let whereClause;
    if (userRole === 'admin') {
      whereClause = eq(visitas.id, id);
    } else {
      whereClause = and(
        eq(visitas.id, id),
        or(
          eq(visitas.createdByUserId, userId),
          eq(visitas.assignedUserId, userId),
          eq(visitas.userId, userId) // Fallback to legacy userId field for historical data
        )
      );
    }
    
    return db.query.visitas.findFirst({
      where: whereClause,
      with: {
        entidade: true,
        contacto: true,
        user: true,
      },
    });
  }

  async createVisita(visita: InsertVisita): Promise<Visita> {
    const [newVisita] = await db
      .insert(visitas)
      .values(visita)
      .returning();
    return newVisita;
  }

  async updateVisita(id: string, visita: Partial<Visita>, userId?: string, userRole?: 'admin' | 'agent'): Promise<Visita | undefined> {
    // Build where clause: admin or no auth = id only, agent = id + ownership (including legacy userId)
    const whereClause = (userId && userRole === 'agent')
      ? and(
          eq(visitas.id, id),
          or(
            eq(visitas.createdByUserId, userId),
            eq(visitas.assignedUserId, userId),
            eq(visitas.userId, userId) // Fallback to legacy userId field
          )
        )
      : eq(visitas.id, id);
    
    const [updated] = await db
      .update(visitas)
      .set(visita)
      .where(whereClause)
      .returning();
    return updated;
  }

  async deleteVisita(id: string, userId?: string, userRole?: 'admin' | 'agent'): Promise<void> {
    // Build where clause: admin or no auth = id only, agent = id + ownership (including legacy userId)
    const whereClause = (userId && userRole === 'agent')
      ? and(
          eq(visitas.id, id),
          or(
            eq(visitas.createdByUserId, userId),
            eq(visitas.assignedUserId, userId),
            eq(visitas.userId, userId) // Fallback to legacy userId field
          )
        )
      : eq(visitas.id, id);
    
    await db.delete(visitas).where(whereClause);
  }

  // Tarefas (Tasks)
  async getTarefas(userId: string, userRole: 'admin' | 'agent', filters?: { status?: string; assignedUserId?: string; entidadeId?: string; overdue?: boolean }): Promise<TarefaWithRelations[]> {
    // Build where clauses for role-based filtering
    const conditions: any[] = [];
    
    // Role-based access: admin sees all, agent sees only created/assigned
    if (userRole === 'agent') {
      conditions.push(
        or(
          eq(tarefas.createdByUserId, userId),
          eq(tarefas.assignedUserId, userId)
        )
      );
    }
    
    // Apply filters
    if (filters?.status) {
      conditions.push(eq(tarefas.status, filters.status as any));
    }
    if (filters?.assignedUserId) {
      conditions.push(eq(tarefas.assignedUserId, filters.assignedUserId));
    }
    if (filters?.entidadeId) {
      conditions.push(eq(tarefas.entidadeId, filters.entidadeId));
    }
    if (filters?.overdue) {
      conditions.push(
        and(
          eq(tarefas.status, 'pending'),
          sql`${tarefas.dueDate} < NOW()`
        )
      );
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    return db.query.tarefas.findMany({
      where: whereClause,
      orderBy: [desc(tarefas.createdAt)],
      with: {
        visita: true,
        entidade: true,
        assignedUser: true,
        createdByUser: true,
      },
    });
  }

  async getTarefa(id: string, userId: string, userRole: 'admin' | 'agent'): Promise<TarefaWithRelations | undefined> {
    // Build where clause based on role
    let whereClause;
    if (userRole === 'agent') {
      whereClause = and(
        eq(tarefas.id, id),
        or(
          eq(tarefas.createdByUserId, userId),
          eq(tarefas.assignedUserId, userId)
        )
      );
    } else {
      whereClause = eq(tarefas.id, id);
    }
    
    return db.query.tarefas.findFirst({
      where: whereClause,
      with: {
        visita: true,
        entidade: true,
        assignedUser: true,
        createdByUser: true,
      },
    });
  }

  async createTarefa(tarefaData: InsertTarefa): Promise<Tarefa> {
    const [tarefa] = await db
      .insert(tarefas)
      .values({ ...tarefaData, updatedAt: new Date() })
      .returning();
    return tarefa;
  }

  async updateTarefa(id: string, tarefaData: Partial<InsertTarefa>, userId?: string, userRole?: 'admin' | 'agent'): Promise<Tarefa | undefined> {
    // Build where clause: admin or no auth = id only, agent = id + ownership
    const whereClause = (userId && userRole === 'agent')
      ? and(
          eq(tarefas.id, id),
          or(
            eq(tarefas.createdByUserId, userId),
            eq(tarefas.assignedUserId, userId)
          )
        )
      : eq(tarefas.id, id);
    
    const [tarefa] = await db
      .update(tarefas)
      .set({ ...tarefaData, updatedAt: new Date() })
      .where(whereClause)
      .returning();
    return tarefa;
  }

  async deleteTarefa(id: string, userId?: string, userRole?: 'admin' | 'agent'): Promise<void> {
    // Build where clause: admin or no auth = id only, agent = id + ownership
    const whereClause = (userId && userRole === 'agent')
      ? and(
          eq(tarefas.id, id),
          or(
            eq(tarefas.createdByUserId, userId),
            eq(tarefas.assignedUserId, userId)
          )
        )
      : eq(tarefas.id, id);
    
    await db.delete(tarefas).where(whereClause);
  }

  async getTarefasByVisitaId(visitaId: string, userId: string, userRole: 'admin' | 'agent'): Promise<TarefaWithRelations[]> {
    // SQL-level filtering with RBAC
    const baseQuery = db.select().from(tarefas)
      .where(eq(tarefas.visitaId, visitaId));
    
    const whereClause = userRole === 'agent'
      ? and(
          eq(tarefas.visitaId, visitaId),
          or(
            eq(tarefas.createdByUserId, userId),
            eq(tarefas.assignedUserId, userId)
          )
        )
      : eq(tarefas.visitaId, visitaId);
    
    const results = await db.select().from(tarefas)
      .leftJoin(entidades, eq(tarefas.entidadeId, entidades.id))
      .where(whereClause)
      .orderBy(desc(tarefas.createdAt));
    
    return results.map(row => ({
      ...row.tarefas,
      entidade: row.entidades || undefined,
    }));
  }

  async getTarefasByEntidadeId(entidadeId: string, userId: string, userRole: 'admin' | 'agent'): Promise<TarefaWithRelations[]> {
    // SQL-level filtering with RBAC
    const whereClause = userRole === 'agent'
      ? and(
          eq(tarefas.entidadeId, entidadeId),
          or(
            eq(tarefas.createdByUserId, userId),
            eq(tarefas.assignedUserId, userId)
          )
        )
      : eq(tarefas.entidadeId, entidadeId);
    
    const results = await db.select().from(tarefas)
      .leftJoin(entidades, eq(tarefas.entidadeId, entidades.id))
      .where(whereClause)
      .orderBy(desc(tarefas.createdAt));
    
    return results.map(row => ({
      ...row.tarefas,
      entidade: row.entidades || undefined,
    }));
  }

  async getTarefasInPeriod(startDate: Date, endDate: Date, userId: string, userRole: 'admin' | 'agent'): Promise<TarefaWithRelations[]> {
    // SQL-level filtering with RBAC and date range
    const whereClause = userRole === 'agent'
      ? and(
          or(
            eq(tarefas.createdByUserId, userId),
            eq(tarefas.assignedUserId, userId)
          ),
          sql`${tarefas.dueDate} >= ${startDate}`,
          sql`${tarefas.dueDate} <= ${endDate}`
        )
      : and(
          sql`${tarefas.dueDate} >= ${startDate}`,
          sql`${tarefas.dueDate} <= ${endDate}`
        );
    
    const results = await db.select().from(tarefas)
      .leftJoin(entidades, eq(tarefas.entidadeId, entidades.id))
      .where(whereClause)
      .orderBy(desc(tarefas.dueDate));
    
    return results.map(row => ({
      ...row.tarefas,
      entidade: row.entidades || undefined,
    }));
  }

  async getVisitasByEntidade(entidadeId: string, userId: string, userRole: 'admin' | 'agent'): Promise<VisitaWithRelations[]> {
    // SQL-level filtering with RBAC
    const whereClause = userRole === 'agent'
      ? and(
          eq(visitas.entidadeId, entidadeId),
          eq(visitas.createdByUserId, userId)
        )
      : eq(visitas.entidadeId, entidadeId);
    
    const results = await db.select().from(visitas)
      .leftJoin(entidades, eq(visitas.entidadeId, entidades.id))
      .where(whereClause)
      .orderBy(desc(visitas.dataVisita));
    
    return results.map(row => ({
      ...row.visitas,
      entidade: row.entidades || undefined,
    }));
  }

  async getVisitasInPeriod(startDate: Date, endDate: Date, userId: string, userRole: 'admin' | 'agent'): Promise<VisitaWithRelations[]> {
    // SQL-level filtering with RBAC and date range
    const whereClause = userRole === 'agent'
      ? and(
          eq(visitas.createdByUserId, userId),
          sql`${visitas.dataVisita} >= ${startDate}`,
          sql`${visitas.dataVisita} <= ${endDate}`
        )
      : and(
          sql`${visitas.dataVisita} >= ${startDate}`,
          sql`${visitas.dataVisita} <= ${endDate}`
        );
    
    const results = await db.select().from(visitas)
      .leftJoin(entidades, eq(visitas.entidadeId, entidades.id))
      .where(whereClause)
      .orderBy(desc(visitas.dataVisita));
    
    return results.map(row => ({
      ...row.visitas,
      entidade: row.entidades || undefined,
    }));
  }

  async getAllEntidades(userId: string, userRole: 'admin' | 'agent'): Promise<EntidadeWithRelations[]> {
    return this.getEntidades(userId, userRole);
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
    }
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
    }
  ): Promise<Visita | undefined> {
    const [visita] = await db
      .update(visitas)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(visitas.id, id))
      .returning();
    return visita;
  }

  // Marcas (by empresa)
  async getMarcasByEmpresa(empresaId: string): Promise<Marca[]> {
    return db.select().from(marcas)
      .where(eq(marcas.empresaId, empresaId))
      .orderBy(marcas.nome);
  }

  async getMarcasByEmpresaAtiva(empresaId: string): Promise<Marca[]> {
    return db.select().from(marcas)
      .where(and(eq(marcas.empresaId, empresaId), eq(marcas.ativa, true)))
      .orderBy(marcas.nome);
  }

  async getMarca(id: string): Promise<Marca | undefined> {
    const [marca] = await db.select().from(marcas).where(eq(marcas.id, id));
    return marca;
  }

  async createMarca(marca: InsertMarca): Promise<Marca> {
    const [newMarca] = await db
      .insert(marcas)
      .values(marca)
      .returning();
    return newMarca;
  }

  // Legacy Marcas (deprecated - for migration purposes)
  async getMarcas(): Promise<Marca[]> {
    return db.select().from(marcas).orderBy(marcas.nome);
  }

  // Dashboard stats
  async getDashboardStats(userId: string, userRole: 'admin' | 'agent') {
    // Build where clause based on role
    let visitasWhereClause;
    if (userRole === 'agent') {
      visitasWhereClause = or(
        eq(visitas.createdByUserId, userId),
        eq(visitas.assignedUserId, userId)
      );
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
    const visitasEstesMes = allVisitas.filter(v => new Date(v.dataVisita) >= startOfMonth).length;

    // Count entidades based on role
    let entidadesCount;
    if (userRole === 'admin') {
      entidadesCount = await db.select({ count: sql<number>`count(distinct ${entidades.id})` })
        .from(entidades);
    } else {
      entidadesCount = await db.select({ count: sql<number>`count(distinct ${entidades.id})` })
        .from(entidades)
        .where(or(
          eq(entidades.createdByUserId, userId),
          eq(entidades.assignedUserId, userId)
        ));
    }
    const totalEntidades = Number(entidadesCount[0]?.count || 0);

    // Count contactos based on role
    let contactosCount;
    if (userRole === 'admin') {
      contactosCount = await db.select({ count: sql<number>`count(*)` })
        .from(contactos);
    } else {
      contactosCount = await db.select({ count: sql<number>`count(*)` })
        .from(contactos)
        .where(or(
          eq(contactos.createdByUserId, userId),
          eq(contactos.assignedUserId, userId)
        ));
    }
    const totalContactos = Number(contactosCount[0]?.count || 0);

    // Count marca occurrences
    const marcasMap = new Map<string, number>();
    allVisitas.forEach(visita => {
      visita.marcasEntregues?.forEach(marca => {
        marcasMap.set(marca, (marcasMap.get(marca) || 0) + 1);
      });
    });
    
    const marcasMaisEntregues = Array.from(marcasMap.entries())
      .map(([marca, count]) => ({ marca, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const proximasVisitas = allVisitas
      .filter(v => v.proximaVisita && new Date(v.proximaVisita) >= now)
      .sort((a, b) => new Date(a.proximaVisita!).getTime() - new Date(b.proximaVisita!).getTime())
      .slice(0, 5);

    return {
      totalEntidades,
      totalContactos,
      totalVisitas,
      visitasEstesMes,
      marcasMaisEntregues,
      proximasVisitas,
    };
  }

  // Analytics
  async getAnalytics(userId: string, userRole: 'admin' | 'agent', filters?: {
    period?: number;
    agente?: string;
    tipoEntidade?: string;
  }) {
    const periodDays = filters?.period || 365;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    // Build RBAC where clauses
    let visitasWhereClause;
    let tarefasWhereClause;
    let entidadesWhereClause;

    if (userRole === 'agent') {
      // Agents see only their created/assigned data
      visitasWhereClause = or(
        eq(visitas.createdByUserId, userId),
        eq(visitas.assignedUserId, userId)
      );
      tarefasWhereClause = or(
        eq(tarefas.createdByUserId, userId),
        eq(tarefas.assignedUserId, userId)
      );
      entidadesWhereClause = or(
        eq(entidades.createdByUserId, userId),
        eq(entidades.assignedUserId, userId)
      );
    }

    // Apply additional filters
    if (filters?.agente && userRole === 'admin') {
      visitasWhereClause = or(
        eq(visitas.createdByUserId, filters.agente),
        eq(visitas.assignedUserId, filters.agente)
      );
      tarefasWhereClause = or(
        eq(tarefas.createdByUserId, filters.agente),
        eq(tarefas.assignedUserId, filters.agente)
      );
    }

    // Fetch all visitas with relations
    const allVisitas = await db.query.visitas.findMany({
      where: visitasWhereClause,
      with: {
        entidade: true,
        contacto: true,
      },
    });

    // Filter by entity type if specified
    let filteredVisitas = allVisitas;
    if (filters?.tipoEntidade) {
      filteredVisitas = allVisitas.filter(v => 
        v.entidade?.tipoEntidade === filters.tipoEntidade
      );
    }

    // Fetch all tarefas
    const allTarefas = await db.query.tarefas.findMany({
      where: tarefasWhereClause,
      with: {
        entidade: true,
        visita: true,
      },
    });

    // Fetch all entidades
    const allEntidades = await db.query.entidades.findMany({
      where: entidadesWhereClause,
    });

    // === VISITS ANALYTICS ===
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const total_visits = filteredVisitas.length;
    const visits_last_7_days = filteredVisitas.filter(v => 
      new Date(v.dataVisita) >= sevenDaysAgo
    ).length;
    const visits_last_30_days = filteredVisitas.filter(v => 
      new Date(v.dataVisita) >= thirtyDaysAgo
    ).length;

    // Visits by agent
    const visitsByAgentMap = new Map<string, number>();
    const userCache = new Map<string, User>();
    
    for (const visita of filteredVisitas) {
      const agentId = visita.createdByUserId || visita.userId || 'Desconhecido';
      visitsByAgentMap.set(agentId, (visitsByAgentMap.get(agentId) || 0) + 1);
      
      if (agentId !== 'Desconhecido' && !userCache.has(agentId)) {
        const user = await this.getUser(agentId);
        if (user) userCache.set(agentId, user);
      }
    }

    const visits_by_agent = Array.from(visitsByAgentMap.entries())
      .map(([agentId, count]) => {
        const user = userCache.get(agentId);
        const agentName = user ? `${user.firstName} ${user.lastName}` : 'Desconhecido';
        return { agent: agentName, count };
      })
      .sort((a, b) => b.count - a.count);

    // Visits by entity type
    const visitsByEntityTypeMap = new Map<string, number>();
    filteredVisitas.forEach(v => {
      const tipo = v.entidade?.tipoEntidade || 'Desconhecido';
      visitsByEntityTypeMap.set(tipo, (visitsByEntityTypeMap.get(tipo) || 0) + 1);
    });

    const visits_by_entity_type = Array.from(visitsByEntityTypeMap.entries())
      .map(([tipo, count]) => ({ tipo, count }))
      .sort((a, b) => b.count - a.count);

    // Visits by month (last 12 months)
    const visitsByMonthMap = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = date.toLocaleDateString('pt-PT', { year: 'numeric', month: 'short' });
      visitsByMonthMap.set(key, 0);
    }

    filteredVisitas.forEach(v => {
      const date = new Date(v.dataVisita);
      const key = date.toLocaleDateString('pt-PT', { year: 'numeric', month: 'short' });
      if (visitsByMonthMap.has(key)) {
        visitsByMonthMap.set(key, (visitsByMonthMap.get(key) || 0) + 1);
      }
    });

    const visits_by_month = Array.from(visitsByMonthMap.entries())
      .map(([month, count]) => ({ month, count }));

    // Most visited entities
    const entityVisitCountMap = new Map<string, { id: string; nome: string; count: number }>();
    filteredVisitas.forEach(v => {
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

    // GPS heatmap
    const gps_heatmap = filteredVisitas
      .filter(v => v.latitude && v.longitude)
      .map(v => ({
        lat: parseFloat(v.latitude!),
        lon: parseFloat(v.longitude!),
        date: new Date(v.dataVisita).toISOString(),
      }));

    // === TASKS ANALYTICS ===
    const tasks_pending = allTarefas.filter(t => t.status === 'pending').length;
    const tasks_overdue = allTarefas.filter(t => 
      t.status === 'pending' && t.dueDate && new Date(t.dueDate) < now
    ).length;
    const tasks_completed_this_week = allTarefas.filter(t => 
      t.status === 'done' && t.updatedAt && new Date(t.updatedAt) >= startOfWeek
    ).length;

    // Tasks by agent
    const tasksByAgentMap = new Map<string, number>();
    for (const tarefa of allTarefas) {
      const agentId = tarefa.createdByUserId || 'Desconhecido';
      tasksByAgentMap.set(agentId, (tasksByAgentMap.get(agentId) || 0) + 1);
      
      if (agentId !== 'Desconhecido' && !userCache.has(agentId)) {
        const user = await this.getUser(agentId);
        if (user) userCache.set(agentId, user);
      }
    }

    const tasks_by_agent = Array.from(tasksByAgentMap.entries())
      .map(([agentId, count]) => {
        const user = userCache.get(agentId);
        const agentName = user ? `${user.firstName} ${user.lastName}` : 'Desconhecido';
        return { agent: agentName, count };
      })
      .sort((a, b) => b.count - a.count);

    // Tasks by status
    const tasksByStatusMap = new Map<string, number>();
    allTarefas.forEach(t => {
      const status = t.status === 'pending' ? 'Pendente' : 'Concluída';
      tasksByStatusMap.set(status, (tasksByStatusMap.get(status) || 0) + 1);
    });

    const tasks_by_status = Array.from(tasksByStatusMap.entries())
      .map(([status, count]) => ({ status, count }));

    // Tasks by repeat interval
    const tasksByRepeatMap = new Map<string, number>();
    allTarefas.forEach(t => {
      const interval = t.repeatInterval === 'none' ? 'Sem repetição' : t.repeatInterval || 'Sem repetição';
      tasksByRepeatMap.set(interval, (tasksByRepeatMap.get(interval) || 0) + 1);
    });

    const tasks_by_repeat_interval = Array.from(tasksByRepeatMap.entries())
      .map(([interval, count]) => ({ interval, count }));

    // === ENTITIES ANALYTICS ===
    const entityTypeMap = new Map<string, number>();
    allEntidades.forEach(e => {
      const tipo = e.tipoEntidade || 'Desconhecido';
      entityTypeMap.set(tipo, (entityTypeMap.get(tipo) || 0) + 1);
    });

    const entities_by_type = Array.from(entityTypeMap.entries())
      .map(([tipo, count]) => ({ tipo, count }))
      .sort((a, b) => b.count - a.count);

    const entities_created_last_30_days = allEntidades.filter(e => 
      e.createdAt && new Date(e.createdAt) >= thirtyDaysAgo
    ).length;

    const entities_with_visits_count = most_visited_entities;

    // === BRANDS ANALYTICS ===
    const brandFrequencyMap = new Map<string, number>();
    filteredVisitas.forEach(v => {
      v.marcasEntregues?.forEach(marca => {
        brandFrequencyMap.set(marca, (brandFrequencyMap.get(marca) || 0) + 1);
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
}

export const storage = new DatabaseStorage();
