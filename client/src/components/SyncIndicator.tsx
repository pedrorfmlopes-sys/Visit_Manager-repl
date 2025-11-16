import { WifiOff, CloudOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { syncManager } from "@/lib/syncManager";

export function SyncIndicator() {
  const { pendingCount, isSyncing, isOnline } = useSyncStatus();

  const handleManualSync = () => {
    if (isOnline) {
      syncManager.syncPendingItems();
    }
  };

  if (!isOnline) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Badge variant="destructive" className="gap-2 px-3 py-2 text-sm" data-testid="badge-offline">
          <WifiOff className="h-4 w-4" />
          Offline
        </Badge>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Badge className="gap-2 px-3 py-2 text-sm bg-blue-500 text-white" data-testid="badge-syncing">
          <RefreshCw className="h-4 w-4 animate-spin" />
          A sincronizar...
        </Badge>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <Badge variant="secondary" className="gap-2 px-3 py-2 text-sm" data-testid="badge-pending">
          <CloudOff className="h-4 w-4" />
          {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
        </Badge>
        <Button
          size="sm"
          onClick={handleManualSync}
          className="h-8"
          data-testid="button-sync"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Sincronizar
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <Badge className="gap-2 px-3 py-2 text-sm bg-green-500 text-white" data-testid="badge-synced">
        <CheckCircle2 className="h-4 w-4" />
        Sincronizado
      </Badge>
    </div>
  );
}
