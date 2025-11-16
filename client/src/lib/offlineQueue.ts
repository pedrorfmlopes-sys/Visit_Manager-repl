import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface VCardQueueItem {
  id: string;
  timestamp: number;
  vcardData: {
    name: string;
    organization?: string;
    email?: string;
    phone?: string;
    title?: string;
    address?: string;
    url?: string;
    domain?: string;
  };
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

interface OfflineQueueDB extends DBSchema {
  vcardQueue: {
    key: string;
    value: VCardQueueItem;
    indexes: { 'by-status': string };
  };
}

let db: IDBPDatabase<OfflineQueueDB> | null = null;

async function getDB() {
  if (db) return db;

  db = await openDB<OfflineQueueDB>('offline-queue', 1, {
    upgrade(upgradeDb) {
      const store = upgradeDb.createObjectStore('vcardQueue', { keyPath: 'id' });
      store.createIndex('by-status', 'status');
    },
  });

  return db;
}

export async function queueVCardImport(vcardData: VCardQueueItem['vcardData']): Promise<string> {
  const database = await getDB();
  const id = `vcard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const item: VCardQueueItem = {
    id,
    timestamp: Date.now(),
    vcardData,
    status: 'pending',
  };

  await database.add('vcardQueue', item);
  return id;
}

export async function getPendingVCardImports(): Promise<VCardQueueItem[]> {
  const database = await getDB();
  // Get both pending and failed items for retry
  const pending = await database.getAllFromIndex('vcardQueue', 'by-status', 'pending');
  const failed = await database.getAllFromIndex('vcardQueue', 'by-status', 'failed');
  return [...pending, ...failed];
}

export async function updateVCardImportStatus(
  id: string,
  status: VCardQueueItem['status'],
  error?: string
): Promise<void> {
  const database = await getDB();
  const item = await database.get('vcardQueue', id);
  
  if (item) {
    item.status = status;
    if (error) item.error = error;
    await database.put('vcardQueue', item);
  }
}

export async function deleteVCardImport(id: string): Promise<void> {
  const database = await getDB();
  await database.delete('vcardQueue', id);
}

export async function clearCompletedVCardImports(): Promise<void> {
  const database = await getDB();
  const completed = await database.getAllFromIndex('vcardQueue', 'by-status', 'completed');
  
  for (const item of completed) {
    await database.delete('vcardQueue', item.id);
  }
}

export async function getAllVCardImports(): Promise<VCardQueueItem[]> {
  const database = await getDB();
  return database.getAll('vcardQueue');
}
