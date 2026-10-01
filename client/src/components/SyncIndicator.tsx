import { useEffect, useState } from "react";
import {
  WifiOff,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { syncManager } from "@/lib/syncManager";
import type { PendingSyncItem } from "@/lib/offlineStorage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function SyncIndicator() {
  const { pendingCount, isSyncing, isOnline } = useSyncStatus();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingSyncItem[]>([]);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);

  const loadPendingItems = async () => {
    setPendingItems(await syncManager.getPendingItems());
  };

  useEffect(() => {
    if (detailsOpen) {
      void loadPendingItems();
    }
  }, [detailsOpen, pendingCount]);

  const handleManualSync = async () => {
    if (isOnline) {
      await syncManager.syncPendingItems();
      await loadPendingItems();
    }
  };

  const handleRetry = async (item: PendingSyncItem) => {
    if (item.id === undefined) return;
    setBusyItemId(item.id);
    try {
      await syncManager.retryPendingItem(item.id);
      await loadPendingItems();
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDiscard = async (item: PendingSyncItem) => {
    if (item.id === undefined) return;
    setBusyItemId(item.id);
    try {
      await syncManager.discardPendingItem(item.id);
      await loadPendingItems();
    } finally {
      setBusyItemId(null);
    }
  };

  const blockedCount = pendingItems.filter(
    (item) => (item.retryCount ?? 0) >= 5,
  ).length;

  const detailsDialog = (
    <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
      <DialogContent className="max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Sincronizações pendentes</DialogTitle>
          <DialogDescription>
            Consulte alterações guardadas no dispositivo que ainda não chegaram
            ao servidor. Pode tentar novamente ou descartar uma alteração.
          </DialogDescription>
        </DialogHeader>

        <div
          className="max-h-[55vh] space-y-2 overflow-y-auto pr-1"
          data-testid="pending-sync-list"
        >
          {pendingItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Não existem sincronizações pendentes.
            </p>
          ) : (
            pendingItems.map((item) => {
              const blocked = (item.retryCount ?? 0) >= 5;
              const itemLabel = {
                visita: "Visita",
                entidade: "Entidade",
                contacto: "Contacto",
                tarefa: "Tarefa",
                gabinete: "Entidade antiga",
              }[item.type];
              const actionLabel = {
                create: "criar",
                update: "atualizar",
                delete: "eliminar",
              }[item.action];

              return (
                <div
                  key={item.id}
                  className="rounded-lg border p-3"
                  data-testid={`pending-sync-item-${item.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {itemLabel}: {actionLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString("pt-PT")}
                      </p>
                    </div>
                    {blocked && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Bloqueada
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tentativas falhadas: {item.retryCount ?? 0}
                  </p>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!isOnline || busyItemId === item.id}
                      onClick={() => handleRetry(item)}
                      data-testid={`retry-pending-sync-${item.id}`}
                    >
                      <RefreshCw className="mr-1 h-4 w-4" />
                      Tentar novamente
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busyItemId === item.id}
                      onClick={() => handleDiscard(item)}
                      data-testid={`discard-pending-sync-${item.id}`}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Descartar
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          {blockedCount > 1 && (
            <Button
              type="button"
              variant="outline"
              disabled={!isOnline || busyItemId !== null}
              onClick={async () => {
                await syncManager.retryAllBlockedItems();
                await loadPendingItems();
              }}
              data-testid="retry-all-blocked-sync"
            >
              Tentar todas novamente
            </Button>
          )}
          <Button type="button" onClick={() => setDetailsOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!isOnline) {
    return (
      <>
        <div className="fixed left-3 right-3 top-[4.75rem] z-30 flex flex-wrap items-center justify-end gap-2 md:bottom-4 md:left-auto md:right-4 md:top-auto md:z-50">
          <Badge variant="destructive" className="gap-2 px-3 py-2 text-sm" data-testid="badge-offline">
            <WifiOff className="h-4 w-4" />
            Offline
          </Badge>
          {pendingCount > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDetailsOpen(true)}
              data-testid="button-sync-details"
            >
              Ver pendentes
            </Button>
          )}
        </div>
        {detailsDialog}
      </>
    );
  }

  if (isSyncing) {
    return (
      <div className="pointer-events-none fixed right-16 top-3 z-40 md:bottom-4 md:right-4 md:top-auto md:z-50">
        <Badge
          className="flex h-10 w-10 items-center justify-center gap-2 bg-blue-500 p-0 text-sm text-white sm:h-auto sm:w-auto sm:px-3 sm:py-2"
          data-testid="badge-syncing"
          title="A sincronizar"
        >
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="hidden sm:inline">A sincronizar...</span>
        </Badge>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <>
        <div className="fixed left-3 right-3 top-[4.75rem] z-30 flex flex-wrap items-center justify-end gap-2 md:bottom-4 md:left-auto md:right-4 md:top-auto md:z-50">
          <button type="button" onClick={() => setDetailsOpen(true)}>
            <Badge variant="secondary" className="gap-2 px-3 py-2 text-sm" data-testid="badge-pending">
              <CloudOff className="h-4 w-4" />
              {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
            </Badge>
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDetailsOpen(true)}
            className="h-8"
            data-testid="button-sync-details"
          >
            Detalhes
          </Button>
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
        {detailsDialog}
      </>
    );
  }

  return (
    <div className="pointer-events-none fixed right-16 top-3 z-40 md:bottom-4 md:right-4 md:top-auto md:z-50">
      <Badge
        className="flex h-10 w-10 items-center justify-center gap-2 bg-green-500 p-0 text-sm text-white sm:h-auto sm:w-auto sm:px-3 sm:py-2"
        data-testid="badge-synced"
        title="Sincronizado"
      >
        <CheckCircle2 className="h-4 w-4" />
        <span className="hidden sm:inline">Sincronizado</span>
      </Badge>
    </div>
  );
}
