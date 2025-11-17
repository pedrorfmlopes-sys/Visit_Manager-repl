import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { SyncIndicator } from "@/components/SyncIndicator";
import { offlineStorage } from "@/lib/offlineStorage";
import { syncPTEnrichmentQueue } from "@/lib/offlineQueue";
import { useEffect, useRef, useState } from "react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Gabinetes from "@/pages/Gabinetes";
import GabineteForm from "@/pages/GabineteForm";
import Entidades from "@/pages/Entidades";
import EntidadeForm from "@/pages/EntidadeForm";
import EntidadeDetail from "@/pages/EntidadeDetail";
import Contactos from "@/pages/Contactos";
import ContactoForm from "@/pages/ContactoForm";
import ContactoDetail from "@/pages/ContactoDetail";
import Visitas from "@/pages/Visitas";
import VisitaForm from "@/pages/VisitaForm";
import VisitaDetail from "@/pages/VisitaDetail";
import Tarefas from "@/pages/Tarefas";
import TarefaForm from "@/pages/TarefaForm";
import TarefaDetail from "@/pages/TarefaDetail";
import Lembretes from "@/pages/Lembretes";
import Analytics from "@/pages/Analytics";
import QRScanner from "@/pages/QRScanner";
import MicrosoftIntegration from "@/pages/MicrosoftIntegration";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-primary rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          {/* NEW: Entidades routes (Universal Entities) */}
          <Route path="/entidades" component={Entidades} />
          <Route path="/entidades/nova" component={EntidadeForm} />
          <Route path="/entidades/:id" component={EntidadeDetail} />
          <Route path="/entidades/:id/editar" component={EntidadeForm} />
          {/* LEGACY: Gabinetes routes (backward compatibility) */}
          <Route path="/gabinetes" component={Gabinetes} />
          <Route path="/gabinetes/novo" component={GabineteForm} />
          <Route path="/gabinetes/:id" component={GabineteForm} />
          <Route path="/contactos" component={Contactos} />
          <Route path="/contactos/novo" component={ContactoForm} />
          <Route path="/contactos/:id/detalhes" component={ContactoDetail} />
          <Route path="/contactos/:id" component={ContactoForm} />
          <Route path="/visitas" component={Visitas} />
          <Route path="/visitas/nova" component={VisitaForm} />
          <Route path="/visitas/:id" component={VisitaDetail} />
          <Route path="/tarefas" component={Tarefas} />
          <Route path="/tarefas/nova" component={TarefaForm} />
          <Route path="/tarefas/:id" component={TarefaDetail} />
          <Route path="/tarefas/:id/editar" component={TarefaForm} />
          <Route path="/lembretes" component={Lembretes} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/qr" component={QRScanner} />
          <Route path="/integracoes/microsoft" component={MicrosoftIntegration} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const prevOnlineStatus = useRef<boolean | null>(null);

  useEffect(() => {
    offlineStorage.init().catch(console.error);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && prevOnlineStatus.current === false && isAuthenticated) {
      console.log('[App] Connection restored, syncing PT enrichment queue...');
      syncPTEnrichmentQueue()
        .then(({ success, failed }) => {
          if (success > 0 || failed > 0) {
            console.log(`[App] PT Enrichment sync complete: ${success} success, ${failed} failed`);
            queryClient.invalidateQueries({ queryKey: ['/api/entidades'] });
          }
        })
        .catch(console.error);
    }
    prevOnlineStatus.current = isOnline;
  }, [isOnline, isAuthenticated]);

  return (
    <div className="relative">
      <Router />
      {isAuthenticated && <BottomNav />}
      {isAuthenticated && <SyncIndicator />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
