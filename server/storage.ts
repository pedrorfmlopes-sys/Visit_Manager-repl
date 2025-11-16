import {
  users,
  gabinetes,
  contactos,
  visitas,
  marcas,
  type User,
  type UpsertUser,
  type Gabinete,
  type InsertGabinete,
  type Contacto,
  type InsertContacto,
  type Visita,
  type InsertVisita,
  type Marca,
  type InsertMarca,
  type GabineteWithRelations,
  type ContactoWithRelations,
  type VisitaWithRelations,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, gte, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Gabinetes
  getGabinetes(): Promise<Gabinete[]>;
  getGabinete(id: string): Promise<GabineteWithRelations | undefined>;
  createGabinete(gabinete: InsertGabinete): Promise<Gabinete>;
  updateGabinete(id: string, gabinete: Partial<InsertGabinete>): Promise<Gabinete>;
  deleteGabinete(id: string): Promise<void>;
  
  // Contactos
  getContactos(): Promise<ContactoWithRelations[]>;
  getContacto(id: string): Promise<ContactoWithRelations | undefined>;
  createContacto(contacto: InsertContacto): Promise<Contacto>;
  updateContacto(id: string, contacto: Partial<InsertContacto>): Promise<Contacto>;
  deleteContacto(id: string): Promise<void>;
  
  // Visitas
  getVisitas(): Promise<VisitaWithRelations[]>;
  getVisita(id: string): Promise<VisitaWithRelations | undefined>;
  createVisita(visita: InsertVisita): Promise<Visita>;
  updateVisita(id: string, visita: Partial<Visita>): Promise<Visita>;
  deleteVisita(id: string): Promise<void>;
  
  // Marcas
  getMarcas(): Promise<Marca[]>;
  getMarca(id: string): Promise<Marca | undefined>;
  createMarca(marca: InsertMarca): Promise<Marca>;
  
  // Dashboard stats
  getDashboardStats(userId: string): Promise<{
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

  // Gabinetes
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
  async getContactos(): Promise<ContactoWithRelations[]> {
    return db.query.contactos.findMany({
      orderBy: desc(contactos.createdAt),
      with: {
        gabinete: true,
      },
    });
  }

  async getContacto(id: string): Promise<ContactoWithRelations | undefined> {
    return db.query.contactos.findFirst({
      where: eq(contactos.id, id),
      with: {
        gabinete: true,
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

  async updateContacto(id: string, contacto: Partial<InsertContacto>): Promise<Contacto> {
    const [updated] = await db
      .update(contactos)
      .set(contacto)
      .where(eq(contactos.id, id))
      .returning();
    return updated;
  }

  async deleteContacto(id: string): Promise<void> {
    await db.delete(contactos).where(eq(contactos.id, id));
  }

  // Visitas
  async getVisitas(userId?: string): Promise<VisitaWithRelations[]> {
    return db.query.visitas.findMany({
      where: userId ? eq(visitas.userId, userId) : undefined,
      orderBy: desc(visitas.dataVisita),
      with: {
        gabinete: true,
        contacto: true,
        user: true,
      },
    });
  }

  async getVisita(id: string): Promise<VisitaWithRelations | undefined> {
    return db.query.visitas.findFirst({
      where: eq(visitas.id, id),
      with: {
        gabinete: true,
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

  async updateVisita(id: string, visita: Partial<Visita>): Promise<Visita> {
    const [updated] = await db
      .update(visitas)
      .set(visita)
      .where(eq(visitas.id, id))
      .returning();
    return updated;
  }

  async deleteVisita(id: string): Promise<void> {
    await db.delete(visitas).where(eq(visitas.id, id));
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
  async getDashboardStats(userId: string) {
    const allVisitas = await db.query.visitas.findMany({
      where: eq(visitas.userId, userId),
      with: {
        gabinete: true,
        contacto: true,
      },
    });

    const totalVisitas = allVisitas.length;
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const visitasEstesMes = allVisitas.filter(v => new Date(v.dataVisita) >= startOfMonth).length;

    const gabinetesCount = await db.select({ count: sql<number>`count(distinct ${gabinetes.id})` })
      .from(gabinetes);
    const totalGabinetes = Number(gabinetesCount[0]?.count || 0);

    const contactosCount = await db.select({ count: sql<number>`count(*)` })
      .from(contactos);
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
