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
    const { endpoint, data, action } = item;

    switch (action) {
      case 'create':
        await apiRequest(endpoint, 'POST', data);
        break;
      case 'update':
        await apiRequest(endpoint, 'PATCH', data);
        break;
      case 'delete':
        await apiRequest(endpoint, 'DELETE');
        break;
    }
  }

  async queueVisitaCreation(data: any): Promise<void> {
    await offlineStorage.addPendingSync({
      type: 'visita',
      action: 'create',
      data,
      endpoint: '/api/visitas',
      timestamp: Date.now(),
      retryCount: 0,
    });

    const count = await offlineStorage.getPendingSyncCount();
    this.notifyCallbacks(count);

    if (navigator.onLine) {
      await this.syncPendingItems();
    }
  }

  async queueGabineteCreation(data: any): Promise<void> {
    await offlineStorage.addPendingSync({
      type: 'gabinete',
      action: 'create',
      data,
      endpoint: '/api/gabinetes',
      timestamp: Date.now(),
      retryCount: 0,
    });

    const count = await offlineStorage.getPendingSyncCount();
    this.notifyCallbacks(count);

    if (navigator.onLine) {
      await this.syncPendingItems();
    }
  }

  async queueContactoCreation(data: any): Promise<void> {
    await offlineStorage.addPendingSync({
      type: 'contacto',
      action: 'create',
      data,
      endpoint: '/api/contactos',
      timestamp: Date.now(),
      retryCount: 0,
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
