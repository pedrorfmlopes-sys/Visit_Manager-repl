import type { Visita, Gabinete, Contacto, Entidade } from "@shared/schema";

const DB_NAME = 'VisitasDB';
const DB_VERSION = 2; // Incremented for entidades migration

export interface PendingSyncItem {
  id?: number;
  type: 'visita' | 'gabinete' | 'contacto' | 'entidade';
  action: 'create' | 'update' | 'delete';
  data: any;
  endpoint: string;
  timestamp: number;
  retryCount?: number;
  tempId?: string; // Temporary ID for offline-created items
}

class OfflineStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        if (!db.objectStoreNames.contains('pendingSync')) {
          const pendingStore = db.createObjectStore('pendingSync', { keyPath: 'id', autoIncrement: true });
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
          pendingStore.createIndex('type', 'type', { unique: false });
        }

        if (!db.objectStoreNames.contains('visits')) {
          db.createObjectStore('visits', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('gabinetes')) {
          db.createObjectStore('gabinetes', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('contactos')) {
          db.createObjectStore('contactos', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('marcas')) {
          db.createObjectStore('marcas', { keyPath: 'id' });
        }

        // Version 2: Add entidades store
        if (oldVersion < 2 && !db.objectStoreNames.contains('entidades')) {
          db.createObjectStore('entidades', { keyPath: 'id' });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  async saveVisita(visita: Visita): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction('visits', 'readwrite');
    await tx.objectStore('visits').put(visita);
  }

  async getVisitas(): Promise<Visita[]> {
    const db = await this.ensureDB();
    const tx = db.transaction('visits', 'readonly');
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('visits').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getVisita(id: string): Promise<Visita | null> {
    const db = await this.ensureDB();
    const tx = db.transaction('visits', 'readonly');
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('visits').get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteVisita(id: string): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction('visits', 'readwrite');
    await tx.objectStore('visits').delete(id);
  }

  async saveGabinete(gabinete: Gabinete): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction('gabinetes', 'readwrite');
    await tx.objectStore('gabinetes').put(gabinete);
  }

  async getGabinetes(): Promise<Gabinete[]> {
    const db = await this.ensureDB();
    const tx = db.transaction('gabinetes', 'readonly');
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('gabinetes').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getGabinete(id: string): Promise<Gabinete | null> {
    const db = await this.ensureDB();
    const tx = db.transaction('gabinetes', 'readonly');
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('gabinetes').get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteGabinete(id: string): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction('gabinetes', 'readwrite');
    await tx.objectStore('gabinetes').delete(id);
  }

  // Entidades methods
  async saveEntidade(entidade: Entidade): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction('entidades', 'readwrite');
    await tx.objectStore('entidades').put(entidade);
  }

  async getEntidades(): Promise<Entidade[]> {
    const db = await this.ensureDB();
    const tx = db.transaction('entidades', 'readonly');
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('entidades').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getEntidade(id: string): Promise<Entidade | null> {
    const db = await this.ensureDB();
    const tx = db.transaction('entidades', 'readonly');
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('entidades').get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteEntidade(id: string): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction('entidades', 'readwrite');
    await tx.objectStore('entidades').delete(id);
  }

  async saveContacto(contacto: Contacto): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction('contactos', 'readwrite');
    await tx.objectStore('contactos').put(contacto);
  }

  async getContactos(): Promise<Contacto[]> {
    const db = await this.ensureDB();
    const tx = db.transaction('contactos', 'readonly');
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('contactos').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getContacto(id: string): Promise<Contacto | null> {
    const db = await this.ensureDB();
    const tx = db.transaction('contactos', 'readonly');
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('contactos').get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteContacto(id: string): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction('contactos', 'readwrite');
    await tx.objectStore('contactos').delete(id);
  }

  async addPendingSync(item: Omit<PendingSyncItem, 'id'>): Promise<number> {
    const db = await this.ensureDB();
    const tx = db.transaction('pendingSync', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('pendingSync').add(item);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingSync(): Promise<PendingSyncItem[]> {
    const db = await this.ensureDB();
    const tx = db.transaction('pendingSync', 'readonly');
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('pendingSync').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removePendingSync(id: number): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction('pendingSync', 'readwrite');
    await tx.objectStore('pendingSync').delete(id);
  }

  async clearPendingSync(): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction('pendingSync', 'readwrite');
    await tx.objectStore('pendingSync').clear();
  }

  async getPendingSyncCount(): Promise<number> {
    const db = await this.ensureDB();
    const tx = db.transaction('pendingSync', 'readonly');
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('pendingSync').count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineStorage = new OfflineStorage();
