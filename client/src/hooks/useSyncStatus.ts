import { useState, useEffect } from 'react';
import { syncManager } from '@/lib/syncManager';
import { offlineStorage } from '@/lib/offlineStorage';
import { useOnlineStatus } from './useOnlineStatus';

export function useSyncStatus() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const loadPendingCount = async () => {
      const count = await syncManager.getPendingCount();
      setPendingCount(count);
    };

    loadPendingCount();

    const unsubscribe = syncManager.onSyncStatusChange((count) => {
      setPendingCount(count);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      setIsSyncing(true);
      syncManager.syncPendingItems().finally(() => {
        setIsSyncing(false);
      });
    }
  }, [isOnline, pendingCount]);

  return {
    pendingCount,
    isSyncing,
    isOnline,
  };
}
