import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/layouts/MainLayout";
import { SyncIndicator } from "@/components/SyncIndicator";
import { ProximityAlert } from "@/components/ProximityAlert";
import { offlineStorage } from "@/lib/offlineStorage";
import { syncPTEnrichmentQueue } from "@/lib/offlineQueue";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useEffect as useRedirectEffect } from "react";
import type { EmpresaModuleId } from "@shared/modules";
import { BrandMark } from "@/components/BrandLogo";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

const isDev = import.meta.env.DEV;

const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/Landing"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const Entidades = lazy(() => import("@/pages/Entidades"));
const EntidadeForm = lazy(() => import("@/pages/EntidadeForm"));
const EntidadeDetail = lazy(() => import("@/pages/EntidadeDetail"));
const Contactos = lazy(() => import("@/pages/Contactos"));
const ContactoForm = lazy(() => import("@/pages/ContactoForm"));
const ContactoDetail = lazy(() => import("@/pages/ContactoDetail"));
const Visitas = lazy(() => import("@/pages/Visitas"));
const AdminVisitas = lazy(() => import("@/pages/AdminVisitas"));
const VisitaForm = lazy(() => import("@/pages/VisitaForm"));
const VisitaDetail = lazy(() => import("@/pages/VisitaDetail"));
const Tarefas = lazy(() => import("@/pages/Tarefas"));
const AdminTarefas = lazy(() => import("@/pages/AdminTarefas"));
const TarefaForm = lazy(() => import("@/pages/TarefaForm"));
const TarefaDetail = lazy(() => import("@/pages/TarefaDetail"));
const Lembretes = lazy(() => import("@/pages/Lembretes"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const QRScanner = lazy(() => import("@/pages/QRScanner"));
const AdminEmpresa = lazy(() => import("@/pages/AdminEmpresa"));
const AdminDebug = lazy(() => import("@/pages/AdminDebug"));
const Leads = lazy(() => import("@/pages/Leads"));
const AdminLeadsPage = lazy(() => import("@/pages/AdminLeadsPage"));
const AdminLeadDetailPage = lazy(() => import("@/pages/AdminLeadDetailPage"));
const AdminOdooContactRequestsPage = lazy(() => import("@/pages/AdminOdooContactRequestsPage"));
const OdooMyRequestsPage = lazy(() =>
  import("@/pages/OdooMyRequestsPage").then((module) => ({
    default: module.OdooMyRequestsPage,
  })),
);
const MicrosoftIntegration = lazy(() => import("@/pages/MicrosoftIntegration"));
const AgentMore = lazy(() => import("@/pages/AgentMore"));
const Perfil = lazy(() => import("@/pages/Perfil"));
const Planeamento = lazy(() => import("@/pages/Planeamento"));
const InvoiceIntegration = lazy(() => import("@/pages/InvoiceIntegration"));
const ContactAccess = lazy(() => import('@/pages/ContactAccess'));

function LegacyRedirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();

  useRedirectEffect(() => {
    setLocation(to, { replace: true });
  }, [setLocation, to]);

  return <RouteLoader />;
}

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <BrandMark className="h-16 w-16 animate-pulse" title="A carregar Visit Manager" />
    </div>
  );
}

// Rota protegida apenas para páginas que são mesmo só de admin
function AdminRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BrandMark className="h-16 w-16 animate-pulse" title="A carregar Visit Manager" />
      </div>
    );
  }

  if (!isAdmin) {
    return <NotFound />;
  }

      return (
        <Suspense fallback={<RouteLoader />}>
          <Component />
        </Suspense>
      );
}

function ModuleRoute({
  component: Component,
  moduleId,
  routeProps,
}: {
  component: React.ComponentType<any>;
  moduleId: EmpresaModuleId;
  routeProps?: any;
}) {
  const { isLoading, isModuleEnabled } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-primary rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!isModuleEnabled(moduleId)) {
    return <NotFound />;
  }

  return (
    <Suspense fallback={<RouteLoader />}>
      <Component {...routeProps} />
    </Suspense>
  );
}

function ModuleAdminRoute({
  component: Component,
  moduleId,
}: {
  component: React.ComponentType<any>;
  moduleId: EmpresaModuleId;
}) {
  const { isAdmin, isLoading, isModuleEnabled } = useAuth();

  if (isLoading) {
    return <RouteLoader />;
  }

  if (!isAdmin || !isModuleEnabled(moduleId)) {
    return <NotFound />;
  }

  return (
    <Suspense fallback={<RouteLoader />}>
      <Component />
    </Suspense>
  );
}

  function Router() {
    const { isAuthenticated, isLoading, isAdmin } = useAuth();

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <BrandMark className="h-16 w-16 animate-pulse" title="A carregar Visit Manager" />
        </div>
      );
    }

    // Não autenticado → rotas públicas (login/landing)
    if (!isAuthenticated) {
      return (
        <Suspense fallback={<RouteLoader />}>
        <Switch>
          {/* página principal de login/landing */}
          <Route path="/" component={Landing} />

          {/* aliases usados pelo backend / links antigos */}
          <Route path="/login" component={Landing} />
          <Route path="/api/login" component={Landing} />

          {/* qualquer outra rota pública desconhecida */}
          <Route component={NotFound} />
        </Switch>
        </Suspense>
      );
    }

  // Autenticado → layout principal
  return (
    <MainLayout>
      <Suspense fallback={<RouteLoader />}>
      <Switch>
        <Route path="/admin/invoice-integration"><AdminRoute component={InvoiceIntegration} /></Route>
        <Route path="/contact-access" component={ContactAccess} />
        {/* Dashboard: admin vs agente */}
        <Route path="/" component={isAdmin ? AdminDashboard : Dashboard} />

        {/* Entidades */}
        <Route path="/entidades" component={Entidades} />
        <Route path="/entidades/nova" component={EntidadeForm} />
        <Route path="/entidades/:id/editar" component={EntidadeForm} />
        <Route path="/entidades/:id" component={EntidadeDetail} />

        {/* Gabinetes (retrocompatibilidade) */}
        <Route path="/gabinetes" component={() => <LegacyRedirect to="/entidades" />} />
        <Route path="/gabinetes/novo" component={() => <LegacyRedirect to="/entidades/nova" />} />
        <Route path="/gabinetes/:id" component={(props: any) => <LegacyRedirect to={`/entidades/${props.id}`} />} />

        {/* Contactos */}
        <Route path="/contactos" component={Contactos} />
        <Route path="/contactos/novo" component={ContactoForm} />
        <Route path="/contactos/:id/detalhes" component={ContactoDetail} />
        <Route path="/contactos/:id/editar" component={ContactoForm} />
        <Route path="/contactos/:id" component={ContactoDetail} />

        {/* Leads – lista vista utilizador */}
        <Route
          path="/leads"
          component={(props: any) => (
            <ModuleRoute moduleId="leads" component={Leads} routeProps={props} />
          )}
        />

        {/* Leads “admin” (lista + detalhe) – agora acessíveis a QUALQUER utilizador autenticado */}
        <Route
          path="/admin/leads/:id"
          component={(props: any) => (
            <ModuleRoute moduleId="leads" component={AdminLeadDetailPage} routeProps={props} />
          )}
        />
        <Route
          path="/admin/leads"
          component={(props: any) => (
            <ModuleRoute moduleId="leads" component={AdminLeadsPage} routeProps={props} />
          )}
        />

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
        <Route path="/planeamento" component={Planeamento} />
        <Route
          path="/me/odoo-requests"
          component={(props: any) => (
            <ModuleRoute moduleId="odoo_contacts" component={OdooMyRequestsPage} routeProps={props} />
          )}
        />
        <Route path="/integracoes/microsoft" component={MicrosoftIntegration} />

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
            {isDev && (
              <Route
                path="/admin/debug"
                component={() => <AdminRoute component={AdminDebug} />}
              />
            )}
            <Route
              path="/admin/odoo-contact-requests"
              component={() => (
                <ModuleAdminRoute
                  moduleId="odoo_contacts"
                  component={AdminOdooContactRequestsPage}
                />
              )}
            />
          </>
        )}

        {/* Fallback */}
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </MainLayout>
  );
}

function AppContent() {
  const { isAuthenticated, empresa } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const prevOnlineStatus = useRef<boolean | null>(null);
  useLocation();

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
      {isAuthenticated && <ProximityAlert />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppErrorBoundary>
          <AppContent />
          <Toaster />
        </AppErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
