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
        if ((item.retryCount ?? 0) >= 5) {
          continue;
        }
        try {
          await this.syncItem(item);
          if (item.id) {
            await offlineStorage.removePendingSync(item.id);
          }
        } catch (error) {
          console.error('Failed to sync item:', item, error);
          if (item.id !== undefined) {
            item.retryCount = (item.retryCount ?? 0) + 1;
            await offlineStorage.updatePendingSync(item);
          }
        }
      }

      const remainingCount = await offlineStorage.getPendingSyncCount();
      this.notifyCallbacks(remainingCount);
    } finally {
      this.isSyncing = false;
    }
  }

  async getPendingItems(): Promise<PendingSyncItem[]> {
    return offlineStorage.getPendingSync();
  }

  async retryPendingItem(id: number): Promise<void> {
    const item = (await offlineStorage.getPendingSync()).find(
      (pendingItem) => pendingItem.id === id,
    );
    if (!item) return;

    item.retryCount = 0;
    await offlineStorage.updatePendingSync(item);
    this.notifyCallbacks(await offlineStorage.getPendingSyncCount());
    await this.syncPendingItems();
  }

  async retryAllBlockedItems(): Promise<void> {
    const items = await offlineStorage.getPendingSync();
    const blockedItems = items.filter((item) => (item.retryCount ?? 0) >= 5);

    await Promise.all(
      blockedItems.map((item) =>
        offlineStorage.updatePendingSync({ ...item, retryCount: 0 }),
      ),
    );
    this.notifyCallbacks(items.length);
    await this.syncPendingItems();
  }

  async discardPendingItem(id: number): Promise<void> {
    const item = (await offlineStorage.getPendingSync()).find(
      (pendingItem) => pendingItem.id === id,
    );
    if (!item) return;

    await offlineStorage.removePendingSync(id);
    if (item.action === "create" && item.tempId) {
      await this.removeTemporaryItem(item);
    }
    this.notifyCallbacks(await offlineStorage.getPendingSyncCount());
  }

  private async removeTemporaryItem(item: PendingSyncItem): Promise<void> {
    if (!item.tempId) return;

    if (item.type === "visita") {
      await offlineStorage.deleteVisita(item.tempId);
    } else if (item.type === "entidade") {
      await offlineStorage.deleteEntidade(item.tempId);
    } else if (item.type === "contacto") {
      await offlineStorage.deleteContacto(item.tempId);
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
          } else if (type === 'tarefa') {
            await offlineStorage.deleteTarefa(tempId);
            await offlineStorage.saveTarefa(createdItem);
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

  async queueVisitaUpdate(id: string, data: any): Promise<void> {
    const existing = await offlineStorage.getVisita(id);
    await offlineStorage.saveVisita({
      ...(existing ?? {}),
      ...data,
      id,
      updatedAt: new Date().toISOString(),
    });

    await offlineStorage.addPendingSync({
      type: 'visita',
      action: 'update',
      data,
      endpoint: `/api/visitas/${id}`,
      timestamp: Date.now(),
      retryCount: 0,
    });

    const count = await offlineStorage.getPendingSyncCount();
    this.notifyCallbacks(count);
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

  async queueTarefaCreation(data: any): Promise<void> {
    // Generate temporary ID and save locally
    const tempId = `temp-${crypto.randomUUID()}`;
    const tarefaWithId = { ...data, id: tempId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    
    // Save to local IndexedDB so it appears in lists immediately
    await offlineStorage.saveTarefa(tarefaWithId);
    
    await offlineStorage.addPendingSync({
      type: 'tarefa',
      action: 'create',
      data,
      endpoint: '/api/tarefas',
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
