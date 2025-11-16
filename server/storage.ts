import {
  users,
  entidades,
  gabinetes,
  contactos,
  visitas,
  marcas,
  type User,
  type UpsertUser,
  type Entidade,
  type InsertEntidade,
  type Gabinete,
  type InsertGabinete,
  type Contacto,
  type InsertContacto,
  type Visita,
  type InsertVisita,
  type Marca,
  type InsertMarca,
  type EntidadeWithRelations,
  type GabineteWithRelations,
  type ContactoWithRelations,
  type VisitaWithRelations,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, gte, sql, or, and } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Entidades (Universal Entities)
  getEntidades(userId: string, userRole: 'admin' | 'agent'): Promise<Entidade[]>;
  getEntidade(id: string, userId: string, userRole: 'admin' | 'agent'): Promise<EntidadeWithRelations | undefined>;
  createEntidade(entidade: InsertEntidade): Promise<Entidade>;
  updateEntidade(id: string, entidade: Partial<InsertEntidade>, userId?: string, userRole?: 'admin' | 'agent'): Promise<Entidade | undefined>;
  deleteEntidade(id: string, userId?: string, userRole?: 'admin' | 'agent'): Promise<void>;
  checkEntidadeHasRelations(id: string): Promise<boolean>;
  
  // Gabinetes (DEPRECATED - use Entidades)
  getGabinetes(): Promise<Gabinete[]>;
  getGabinete(id: string): Promise<GabineteWithRelations | undefined>;
  createGabinete(gabinete: InsertGabinete): Promise<Gabinete>;
  updateGabinete(id: string, gabinete: Partial<InsertGabinete>): Promise<Gabinete>;
  deleteGabinete(id: string): Promise<void>;
  
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
  
  // Marcas
  getMarcas(): Promise<Marca[]>;
  getMarca(id: string): Promise<Marca | undefined>;
  createMarca(marca: InsertMarca): Promise<Marca>;
  
  // Dashboard stats
  getDashboardStats(userId: string, userRole: 'admin' | 'agent'): Promise<{
    totalGabinetes: number;
    totalContactos: number;
    totalVisitas: number;
    visitasEstesMes: number;
    marcasMaisEntregues: { marca: string; count: number }[];
    proximasVisitas: VisitaWithRelations[];
  }>;
}

export class DatabaseStorage implements IStorage {
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
    return db.select().from(users).orderBy(users.name);
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

  // Gabinetes (DEPRECATED - use Entidades)
  async getGabinetes(): Promise<Gabinete[]> {
    return db.select().from(gabinetes).orderBy(desc(gabinetes.createdAt));
  }

  async getGabinete(id: string): Promise<GabineteWithRelations | undefined> {
    const [gabinete] = await db.query.gabinetes.findMany({
      where: eq(gabinetes.id, id),
      with: {
        contactos: true,
        visitas: {
          orderBy: desc(visitas.dataVisita),
          limit: 10,
        },
      },
    });
    return gabinete;
  }

  async createGabinete(gabinete: InsertGabinete): Promise<Gabinete> {
    const [newGabinete] = await db
      .insert(gabinetes)
      .values(gabinete)
      .returning();
    return newGabinete;
  }

  async updateGabinete(id: string, gabinete: Partial<InsertGabinete>): Promise<Gabinete> {
    const [updated] = await db
      .update(gabinetes)
      .set(gabinete)
      .where(eq(gabinetes.id, id))
      .returning();
    return updated;
  }

  async deleteGabinete(id: string): Promise<void> {
    await db.delete(gabinetes).where(eq(gabinetes.id, id));
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
        gabinete: true,
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
        gabinete: true,
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
        gabinete: true,
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
        gabinete: true,
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

  // Marcas
  async getMarcas(): Promise<Marca[]> {
    return db.select().from(marcas).orderBy(marcas.nome);
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
        gabinete: true,
        entidade: true,
        contacto: true,
      },
    });

    const totalVisitas = allVisitas.length;
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const visitasEstesMes = allVisitas.filter(v => new Date(v.dataVisita) >= startOfMonth).length;

    // Count gabinetes/entidades based on role
    let gabinetesCount;
    if (userRole === 'admin') {
      gabinetesCount = await db.select({ count: sql<number>`count(distinct ${entidades.id})` })
        .from(entidades);
    } else {
      gabinetesCount = await db.select({ count: sql<number>`count(distinct ${entidades.id})` })
        .from(entidades)
        .where(or(
          eq(entidades.createdByUserId, userId),
          eq(entidades.assignedUserId, userId)
        ));
    }
    const totalGabinetes = Number(gabinetesCount[0]?.count || 0);

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
      totalGabinetes,
      totalContactos,
      totalVisitas,
      visitasEstesMes,
      marcasMaisEntregues,
      proximasVisitas,
    };
  }
}

export const storage = new DatabaseStorage();
