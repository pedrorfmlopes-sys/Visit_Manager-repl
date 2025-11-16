import type { Visita, Gabinete, Contacto } from "@shared/schema";

const DB_NAME = 'VisitasDB';
const DB_VERSION = 1;

export interface PendingSyncItem {
  id?: number;
  type: 'visita' | 'gabinete' | 'contacto';
  action: 'create' | 'update' | 'delete';
  data: any;
  endpoint: string;
  timestamp: number;
  retryCount?: number;
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
