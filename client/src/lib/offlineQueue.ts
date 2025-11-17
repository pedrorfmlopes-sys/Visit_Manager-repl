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

interface EnrichmentQueueItem {
  id: string;
  timestamp: number;
  entityId: string;
  enrichmentData: {
    nome: string;
    existingEntityId?: string;
  };
  status: 'pending' | 'syncing' | 'completed' | 'failed' | 'dead';
  error?: string;
  retryCount?: number;
}

interface OfflineQueueDB extends DBSchema {
  vcardQueue: {
    key: string;
    value: VCardQueueItem;
    indexes: { 'by-status': string };
  };
  enrichmentQueue: {
    key: string;
    value: EnrichmentQueueItem;
    indexes: { 'by-status': string; 'by-entity': string };
  };
}

let db: IDBPDatabase<OfflineQueueDB> | null = null;

async function getDB() {
  if (db) return db;

  db = await openDB<OfflineQueueDB>('offline-queue', 2, {
    upgrade(upgradeDb, oldVersion) {
      // Version 1: vCard queue
      if (oldVersion < 1) {
        const vcardStore = upgradeDb.createObjectStore('vcardQueue', { keyPath: 'id' });
        vcardStore.createIndex('by-status', 'status');
      }
      
      // Version 2: Enrichment queue
      if (oldVersion < 2) {
        const enrichmentStore = upgradeDb.createObjectStore('enrichmentQueue', { keyPath: 'id' });
        enrichmentStore.createIndex('by-status', 'status');
        enrichmentStore.createIndex('by-entity', 'entityId');
      }
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

// ============================================
// ENRICHMENT QUEUE FUNCTIONS
// ============================================

/**
 * Queue an enrichment request for offline processing
 */
export async function queueEnrichmentRequest(
  entityId: string,
  enrichmentData: EnrichmentQueueItem['enrichmentData']
): Promise<string> {
  const database = await getDB();
  const id = `enrichment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const item: EnrichmentQueueItem = {
    id,
    timestamp: Date.now(),
    entityId,
    enrichmentData,
    status: 'pending',
    retryCount: 0,
  };

  await database.add('enrichmentQueue', item);
  console.log(`[Enrichment Queue] Queued enrichment for entity ${entityId}`);
  return id;
}

/**
 * Get pending enrichment requests (including retryable failed items)
 */
export async function getPendingEnrichmentRequests(): Promise<EnrichmentQueueItem[]> {
  const database = await getDB();
  const pending = await database.getAllFromIndex('enrichmentQueue', 'by-status', 'pending');
  const failed = await database.getAllFromIndex('enrichmentQueue', 'by-status', 'failed');
  
  // Filter out items that have exceeded max retries
  const retryableItems = failed.filter(item => (item.retryCount || 0) < MAX_RETRIES);
  
  return [...pending, ...retryableItems];
}

/**
 * Update enrichment request status
 */
export async function updateEnrichmentRequestStatus(
  id: string,
  status: EnrichmentQueueItem['status'],
  error?: string
): Promise<void> {
  const database = await getDB();
  const item = await database.get('enrichmentQueue', id);
  
  if (item) {
    // Delete and reinsert to ensure index update
    await database.delete('enrichmentQueue', id);
    
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
    
    // Reinsert with updated status
    await database.add('enrichmentQueue', item);
  }
}

/**
 * Clear completed enrichment requests
 */
export async function clearCompletedEnrichmentRequests(): Promise<void> {
  const database = await getDB();
  const completed = await database.getAllFromIndex('enrichmentQueue', 'by-status', 'completed');
  
  for (const item of completed) {
    await database.delete('enrichmentQueue', item.id);
  }
}

/**
 * Get all enrichment requests for a specific entity
 */
export async function getEnrichmentRequestsByEntity(entityId: string): Promise<EnrichmentQueueItem[]> {
  const database = await getDB();
  return database.getAllFromIndex('enrichmentQueue', 'by-entity', entityId);
}

/**
 * Get dead enrichment requests
 */
export async function getDeadEnrichmentRequests(): Promise<EnrichmentQueueItem[]> {
  const database = await getDB();
  return database.getAllFromIndex('enrichmentQueue', 'by-status', 'dead');
}

/**
 * Clear dead enrichment requests
 */
export async function clearDeadEnrichmentRequests(): Promise<number> {
  const database = await getDB();
  const deadItems = await getDeadEnrichmentRequests();
  
  for (const item of deadItems) {
    await database.delete('enrichmentQueue', item.id);
  }
  
  return deadItems.length;
}

/**
 * Retry a dead enrichment request
 */
export async function retryDeadEnrichmentRequest(id: string): Promise<void> {
  const database = await getDB();
  const item = await database.get('enrichmentQueue', id);
  
  if (item && item.status === 'dead') {
    // Delete the old record
    await database.delete('enrichmentQueue', id);
    
    // Create new record with updated status (ensures indices update)
    const retriedItem: EnrichmentQueueItem = {
      ...item,
      status: 'pending',
      retryCount: 0,
      error: undefined,
    };
    
    // Reinsert with updated status
    await database.add('enrichmentQueue', retriedItem);
  }
}

// ============================================
// PT-INTELLIGENT SEARCH SYNC FUNCTION
// ============================================

/**
 * Sync pending PT enrichment requests when online
 * Call this function when the app detects online connection
 * Returns { success: number, failed: number }
 */
export async function syncPTEnrichmentQueue(): Promise<{ success: number; failed: number }> {
  const pending = await getPendingEnrichmentRequests();
  
  if (pending.length === 0) {
    return { success: 0, failed: 0 };
  }
  
  console.log(`[PT Enrichment Sync] Processing ${pending.length} pending enrichment(s)`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const item of pending) {
    try {
      await updateEnrichmentRequestStatus(item.id, 'syncing');
      
      // Call PT-Intelligent Search endpoint
      const response = await fetch('/api/enrichment/pt-intelligent-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item.enrichmentData),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const enrichmentResult = await response.json();
      
      // Only update entity if we got valid enrichment data
      if (enrichmentResult && enrichmentResult.enrichmentSource !== 'none') {
        // Apply enrichment to entity
        const updateResponse = await fetch(`/api/entidades/${item.entityId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lastEnrichedAt: new Date().toISOString(),
            enrichmentSource: enrichmentResult.enrichmentSource,
            ...(enrichmentResult.fuzzyMatches?.[0] && {
              website: enrichmentResult.fuzzyMatches[0].website,
              telefone: enrichmentResult.fuzzyMatches[0].telefone,
              morada: enrichmentResult.fuzzyMatches[0].morada,
              cidade: enrichmentResult.fuzzyMatches[0].cidade,
              email: enrichmentResult.fuzzyMatches[0].email,
              nif: enrichmentResult.fuzzyMatches[0].nif,
            }),
            ...(enrichmentResult.webScanData && {
              website: enrichmentResult.webScanData.website || undefined,
              telefone: enrichmentResult.webScanData.telefone || undefined,
              morada: enrichmentResult.webScanData.morada || undefined,
              email: enrichmentResult.webScanData.email || undefined,
            }),
          }),
        });
        
        if (!updateResponse.ok) {
          throw new Error('Failed to update entity with enrichment data');
        }
      }
      
      await updateEnrichmentRequestStatus(item.id, 'completed');
      successCount++;
    } catch (error) {
      console.error(`[PT Enrichment Sync] Error syncing item ${item.id}:`, error);
      await updateEnrichmentRequestStatus(
        item.id,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
      failCount++;
    }
  }
  
  console.log(`[PT Enrichment Sync] Complete: ${successCount} success, ${failCount} failed`);
  
  return { success: successCount, failed: failCount };
}
