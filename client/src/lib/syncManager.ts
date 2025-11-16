import { offlineStorage, type PendingSyncItem } from './offlineStorage';
import { apiRequest } from './queryClient';

class SyncManager {
  private isSyncing = false;
  private syncCallbacks: Array<(count: number) => void> = [];

  onSyncStatusChange(callback: (count: number) => void) {
    this.syncCallbacks.push(callback);
    return () => {
      this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyCallbacks(count: number) {
    this.syncCallbacks.forEach(cb => cb(count));
  }

  async syncPendingItems(): Promise<void> {
    if (this.isSyncing || !navigator.onLine) {
      return;
    }

    this.isSyncing = true;

    try {
      const pendingItems = await offlineStorage.getPendingSync();
      
      for (const item of pendingItems) {
        try {
          await this.syncItem(item);
          if (item.id) {
            await offlineStorage.removePendingSync(item.id);
          }
        } catch (error) {
          console.error('Failed to sync item:', item, error);
          // Increment retry count
          if (item.retryCount && item.retryCount > 5) {
            console.warn('Item exceeded retry limit, removing:', item);
            if (item.id) {
              await offlineStorage.removePendingSync(item.id);
            }
          }
        }
      }

      const remainingCount = await offlineStorage.getPendingSyncCount();
      this.notifyCallbacks(remainingCount);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncItem(item: PendingSyncItem): Promise<void> {
    const { endpoint, data, action, type, tempId } = item;

    switch (action) {
      case 'create':
        const response = await apiRequest('POST', endpoint, data);
        const createdItem = await response.json();
        
        // Replace temporary item with real item in local storage
        if (tempId && createdItem.id) {
          await offlineStorage.init();
          
          // Remove temp item and save real item
          if (type === 'visita') {
            await offlineStorage.deleteVisita(tempId);
            await offlineStorage.saveVisita(createdItem);
          } else if (type === 'entidade') {
            await offlineStorage.deleteEntidade(tempId);
            await offlineStorage.saveEntidade(createdItem);
          } else if (type === 'gabinete') {
            await offlineStorage.deleteGabinete(tempId);
            await offlineStorage.saveGabinete(createdItem);
          } else if (type === 'contacto') {
            await offlineStorage.deleteContacto(tempId);
            await offlineStorage.saveContacto(createdItem);
          }
        }
        break;
      case 'update':
        await apiRequest('PATCH', endpoint, data);
        break;
      case 'delete':
        await apiRequest('DELETE', endpoint);
        break;
    }
  }

  async queueVisitaCreation(data: any): Promise<void> {
    // Generate temporary ID and save locally
    const tempId = `temp-${crypto.randomUUID()}`;
    const visitaWithId = { ...data, id: tempId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    
    // Save to local IndexedDB so it appears in lists immediately
    await offlineStorage.saveVisita(visitaWithId);
    
    await offlineStorage.addPendingSync({
      type: 'visita',
      action: 'create',
      data,
      endpoint: '/api/visitas',
      timestamp: Date.now(),
      retryCount: 0,
      tempId, // Track temporary ID for replacement after sync
    });

    const count = await offlineStorage.getPendingSyncCount();
    this.notifyCallbacks(count);

    if (navigator.onLine) {
      await this.syncPendingItems();
    }
  }

  async queueEntidadeCreation(data: any): Promise<void> {
    // Generate temporary ID and save locally
    const tempId = `temp-${crypto.randomUUID()}`;
    const entidadeWithId = { ...data, id: tempId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    
    // Save to local IndexedDB so it appears in lists immediately
    await offlineStorage.saveEntidade(entidadeWithId);
    
    await offlineStorage.addPendingSync({
      type: 'entidade',
      action: 'create',
      data,
      endpoint: '/api/entidades',
      timestamp: Date.now(),
      retryCount: 0,
      tempId, // Track temporary ID for replacement after sync
    });

    const count = await offlineStorage.getPendingSyncCount();
    this.notifyCallbacks(count);

    if (navigator.onLine) {
      await this.syncPendingItems();
    }
  }

  async queueGabineteCreation(data: any): Promise<void> {
    // Generate temporary ID and save locally
    const tempId = `temp-${crypto.randomUUID()}`;
    const gabineteWithId = { ...data, id: tempId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    
    // Save to local IndexedDB so it appears in lists immediately
    await offlineStorage.saveGabinete(gabineteWithId);
    
    await offlineStorage.addPendingSync({
      type: 'gabinete',
      action: 'create',
      data,
      endpoint: '/api/gabinetes',
      timestamp: Date.now(),
      retryCount: 0,
      tempId, // Track temporary ID for replacement after sync
    });

    const count = await offlineStorage.getPendingSyncCount();
    this.notifyCallbacks(count);

    if (navigator.onLine) {
      await this.syncPendingItems();
    }
  }

  async queueContactoCreation(data: any): Promise<void> {
    // Generate temporary ID and save locally
    const tempId = `temp-${crypto.randomUUID()}`;
    const contactoWithId = { ...data, id: tempId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    
    // Save to local IndexedDB so it appears in lists immediately
    await offlineStorage.saveContacto(contactoWithId);
    
    await offlineStorage.addPendingSync({
      type: 'contacto',
      action: 'create',
      data,
      endpoint: '/api/contactos',
      timestamp: Date.now(),
      retryCount: 0,
      tempId, // Track temporary ID for replacement after sync
    });

    const count = await offlineStorage.getPendingSyncCount();
    this.notifyCallbacks(count);

    if (navigator.onLine) {
      await this.syncPendingItems();
    }
  }

  async getPendingCount(): Promise<number> {
    return await offlineStorage.getPendingSyncCount();
  }
}

export const syncManager = new SyncManager();
