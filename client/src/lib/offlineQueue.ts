import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface VCardQueueItem {
  id: string;
  timestamp: number;
  type: 'vcard' | 'vision';
  vcardData?: {
    name: string;
    organization?: string;
    email?: string;
    phone?: string;
    title?: string;
    address?: string;
    url?: string;
    domain?: string;
  };
  visionData?: {
    base64Image: string;
  };
  status: 'pending' | 'syncing' | 'completed' | 'failed' | 'dead';
  error?: string;
  retryCount?: number; // Track number of retries
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

export async function queueVCardImport(vcardData: NonNullable<VCardQueueItem['vcardData']>): Promise<string> {
  const database = await getDB();
  const id = `vcard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const item: VCardQueueItem = {
    id,
    timestamp: Date.now(),
    type: 'vcard',
    vcardData,
    status: 'pending',
  };

  await database.add('vcardQueue', item);
  return id;
}

export async function queueVisionCardImport(base64Image: string): Promise<string> {
  const database = await getDB();
  const id = `vision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const item: VCardQueueItem = {
    id,
    timestamp: Date.now(),
    type: 'vision',
    visionData: { base64Image },
    status: 'pending',
  };

  await database.add('vcardQueue', item);
  return id;
}

const MAX_RETRIES = 3; // Maximum number of retry attempts

export async function getPendingVCardImports(): Promise<VCardQueueItem[]> {
  const database = await getDB();
  // Get both pending and failed items for retry
  const pending = await database.getAllFromIndex('vcardQueue', 'by-status', 'pending');
  const failed = await database.getAllFromIndex('vcardQueue', 'by-status', 'failed');
  
  // Filter out items that have exceeded max retries
  const retryableItems = failed.filter(item => (item.retryCount || 0) < MAX_RETRIES);
  
  return [...pending, ...retryableItems];
}

export async function updateVCardImportStatus(
  id: string,
  status: VCardQueueItem['status'],
  error?: string
): Promise<void> {
  const database = await getDB();
  const item = await database.get('vcardQueue', id);
  
  if (item) {
    // Increment retry count on failures
    if (status === 'failed') {
      item.retryCount = (item.retryCount || 0) + 1;
      
      // Move to 'dead' status if max retries exceeded
      if (item.retryCount >= MAX_RETRIES) {
        item.status = 'dead';
        item.error = `Max retries (${MAX_RETRIES}) exceeded. ${error || ''}`;
      } else {
        item.status = status;
        if (error) item.error = error;
      }
    } else {
      item.status = status;
      if (error) item.error = error;
      
      // Reset retry count on success
      if (status === 'completed') {
        item.retryCount = 0;
      }
    }
    
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

export async function getDeadVCardImports(): Promise<VCardQueueItem[]> {
  const database = await getDB();
  return database.getAllFromIndex('vcardQueue', 'by-status', 'dead');
}

export async function clearDeadVCardImports(): Promise<number> {
  const database = await getDB();
  const deadItems = await getDeadVCardImports();
  
  for (const item of deadItems) {
    await database.delete('vcardQueue', item.id);
  }
  
  return deadItems.length;
}

/**
 * Retry a dead queue item (works for BOTH vCard and vision types)
 * Resets the item status to 'pending' and clears retry count and errors
 * After calling this, the item will be picked up by syncOfflineQueue()
 * 
 * IMPORTANT: We delete and reinsert to ensure IndexedDB indices update correctly
 */
export async function retryDeadVCardImport(id: string): Promise<void> {
  const database = await getDB();
  const item = await database.get('vcardQueue', id);
  
  if (item && item.status === 'dead') {
    // Delete the old record
    await database.delete('vcardQueue', id);
    
    // Create new record with updated status (ensures indices update)
    const retriedItem: VCardQueueItem = {
      ...item,
      status: 'pending',
      retryCount: 0,
      error: undefined,
    };
    
    // Reinsert with updated status
    await database.add('vcardQueue', retriedItem);
  }
}
