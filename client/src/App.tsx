import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/layouts/MainLayout";
import { SyncIndicator } from "@/components/SyncIndicator";
import { FABMenu } from "@/components/FABMenu";
import { offlineStorage } from "@/lib/offlineStorage";
import { syncPTEnrichmentQueue } from "@/lib/offlineQueue";
import { useEffect, useRef, useState } from "react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import Gabinetes from "@/pages/Gabinetes";
import GabineteForm from "@/pages/GabineteForm";
import Entidades from "@/pages/Entidades";
import EntidadeForm from "@/pages/EntidadeForm";
import EntidadeDetail from "@/pages/EntidadeDetail";
import Contactos from "@/pages/Contactos";
import ContactoForm from "@/pages/ContactoForm";
import ContactoDetail from "@/pages/ContactoDetail";
import Visitas from "@/pages/Visitas";
import AdminVisitas from "@/pages/AdminVisitas";
import VisitaForm from "@/pages/VisitaForm";
import VisitaDetail from "@/pages/VisitaDetail";
import Tarefas from "@/pages/Tarefas";
import AdminTarefas from "@/pages/AdminTarefas";
import TarefaForm from "@/pages/TarefaForm";
import TarefaDetail from "@/pages/TarefaDetail";
import Lembretes from "@/pages/Lembretes";
import Analytics from "@/pages/Analytics";
import QRScanner from "@/pages/QRScanner";
import AdminEmpresa from "@/pages/AdminEmpresa";
import AdminDebug from "@/pages/AdminDebug";
import Leads from "@/pages/Leads";
import AdminLeadsPage from "@/pages/AdminLeadsPage";
import AdminLeadDetailPage from "@/pages/AdminLeadDetailPage";
import AdminOdooContactRequestsPage from "@/pages/AdminOdooContactRequestsPage";
import { OdooMyRequestsPage } from "@/pages/OdooMyRequestsPage";
import AgentMore from "@/pages/AgentMore";
import Perfil from "@/pages/Perfil";

// Rota protegida apenas para páginas que são mesmo só de admin
function AdminRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-primary rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <NotFound />;
  }

  return <Component />;
}

  function Router() {
    const { isAuthenticated, isLoading, isAdmin } = useAuth();

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse">
            <div className="w-16 h-16 bg-primary rounded-2xl"></div>
          </div>
        </div>
      );
    }

    // Não autenticado → rotas públicas (login/landing)
    if (!isAuthenticated) {
      return (
        <Switch>
          {/* página principal de login/landing */}
          <Route path="/" component={Landing} />

          {/* aliases usados pelo backend / links antigos */}
          <Route path="/login" component={Landing} />
          <Route path="/api/login" component={Landing} />

          {/* qualquer outra rota pública desconhecida */}
          <Route component={NotFound} />
        </Switch>
      );
    }

  // Autenticado → layout principal
  return (
    <MainLayout>
      <Switch>
        {/* Dashboard: admin vs agente */}
        <Route path="/" component={isAdmin ? AdminDashboard : Dashboard} />

        {/* Entidades */}
        <Route path="/entidades" component={Entidades} />
        <Route path="/entidades/nova" component={EntidadeForm} />
        <Route path="/entidades/:id/editar" component={EntidadeForm} />
        <Route path="/entidades/:id" component={EntidadeDetail} />

        {/* Gabinetes (retrocompatibilidade) */}
        <Route path="/gabinetes" component={Gabinetes} />
        <Route path="/gabinetes/novo" component={GabineteForm} />
        <Route path="/gabinetes/:id" component={GabineteForm} />

        {/* Contactos */}
        <Route path="/contactos" component={Contactos} />
        <Route path="/contactos/novo" component={ContactoForm} />
        <Route path="/contactos/:id/detalhes" component={ContactoDetail} />
        <Route path="/contactos/:id/editar" component={ContactoForm} />
        <Route path="/contactos/:id" component={ContactoForm} />

        {/* Leads – lista vista utilizador */}
        <Route path="/leads" component={Leads} />

        {/* Leads “admin” (lista + detalhe) – agora acessíveis a QUALQUER utilizador autenticado */}
        <Route path="/admin/leads/:id" component={AdminLeadDetailPage} />
        <Route path="/admin/leads" component={AdminLeadsPage} />

        {/* Visitas */}
        <Route path="/visitas" component={Visitas} />
        <Route path="/visitas/nova" component={VisitaForm} />
        <Route path="/visitas/:id/editar" component={VisitaForm} />
        <Route path="/visitas/:id" component={VisitaDetail} />

        {/* Tarefas */}
        <Route path="/tarefas" component={Tarefas} />
        <Route path="/tarefas/nova" component={TarefaForm} />
        <Route path="/tarefas/:id" component={TarefaDetail} />
        <Route path="/tarefas/:id/editar" component={TarefaForm} />

        {/* Rotas de agente */}
        <Route path="/agente-mais" component={AgentMore} />
        <Route path="/perfil" component={Perfil} />
        <Route path="/me/odoo-requests" component={OdooMyRequestsPage} />

        {/* Lembretes e Analytics */}
        <Route path="/lembretes" component={Lembretes} />
        <Route path="/analytics" component={Analytics} />

        {/* QR Scanner */}
        <Route path="/qr" component={QRScanner} />
        <Route path="/qr-scanner" component={QRScanner} />

        {/* Rotas verdadeiramente só de admin */}
        {isAdmin && (
          <>
            <Route
              path="/admin/empresa"
              component={() => <AdminRoute component={AdminEmpresa} />}
            />
            <Route
              path="/admin/visitas"
              component={() => <AdminRoute component={AdminVisitas} />}
            />
            <Route
              path="/admin/tarefas"
              component={() => <AdminRoute component={AdminTarefas} />}
            />
            <Route
              path="/admin/debug"
              component={() => <AdminRoute component={AdminDebug} />}
            />
            <Route
              path="/admin/odoo-contact-requests"
              component={() => <AdminRoute component={AdminOdooContactRequestsPage} />}
            />
          </>
        )}

        {/* Fallback */}
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function AppContent() {
  const { isAuthenticated, empresa } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const prevOnlineStatus = useRef<boolean | null>(null);
  const [location] = useLocation();

  const mainPages = [
    "/",
    "/visitas",
    "/admin/visitas",
    "/tarefas",
    "/admin/tarefas",
    "/leads",
    "/entidades",
    "/contactos",
  ];
  const showFAB = mainPages.some(
    (page) => location === page || location.startsWith(page + "/")
  );

  const hideFABRoutes = [
    "/entidades/nova",
    "/entidades/:id/editar",
    "/contactos/novo",
    "/contactos/:id/editar",
    "/visitas/nova",
    "/visitas/:id/editar",
    "/tarefas/nova",
    "/tarefas/:id/editar",
  ];
  const isFABHidden = hideFABRoutes.some((route) => {
    if (route.includes(":id")) {
      const pattern = route.replace(":id", "[^/]+");
      return new RegExp(`^${pattern}$`).test(location);
    }
    return location === route;
  });

  useEffect(() => {
    offlineStorage.init().catch(console.error);
  }, []);

  // Tema da empresa
  useEffect(() => {
    if (isAuthenticated && empresa?.theme) {
      const root = document.documentElement;
      if (empresa.theme === "dark-pro") {
        root.classList.add("dark");
        root.setAttribute("data-theme", "dark-pro");
      } else if (empresa.theme === "light-business") {
        root.classList.remove("dark");
        root.setAttribute("data-theme", "light-business");
      }
    }
  }, [isAuthenticated, empresa?.theme]);

  // Online / offline + sync
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && prevOnlineStatus.current === false && isAuthenticated) {
      console.log("[App] Connection restored, syncing PT enrichment queue...");
      syncPTEnrichmentQueue()
        .then(({ success, failed }) => {
          if (success > 0 || failed > 0) {
            console.log(
              `[App] PT Enrichment sync complete: ${success} success, ${failed} failed`
            );
            queryClient.invalidateQueries({ queryKey: ["/api/entidades"] });
          }
        })
        .catch(console.error);
    }
    prevOnlineStatus.current = isOnline;
  }, [isOnline, isAuthenticated]);

  return (
    <>
      <Router />
      {isAuthenticated && <SyncIndicator />}
      {isAuthenticated && showFAB && !isFABHidden && <FABMenu />}
    </>
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
