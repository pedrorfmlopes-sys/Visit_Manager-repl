import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Gabinetes from "@/pages/Gabinetes";
import GabineteForm from "@/pages/GabineteForm";
import Contactos from "@/pages/Contactos";
import ContactoForm from "@/pages/ContactoForm";
import Visitas from "@/pages/Visitas";
import VisitaForm from "@/pages/VisitaForm";

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
          <Route path="/gabinetes" component={Gabinetes} />
          <Route path="/gabinetes/novo" component={GabineteForm} />
          <Route path="/gabinetes/:id" component={GabineteForm} />
          <Route path="/contactos" component={Contactos} />
          <Route path="/contactos/novo" component={ContactoForm} />
          <Route path="/contactos/:id" component={ContactoForm} />
          <Route path="/visitas" component={Visitas} />
          <Route path="/visitas/nova" component={VisitaForm} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="relative">
      <Router />
      {isAuthenticated && <BottomNav />}
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
