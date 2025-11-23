import { Link, useLocation } from "wouter";
import { LayoutDashboard, Building2, Users, FileText, CheckCircle2, Bell, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const sidebarItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/entidades", icon: Building2, label: "Entidades" },
  { path: "/contactos", icon: Users, label: "Contactos" },
  { path: "/visitas", icon: FileText, label: "Visitas" },
  { path: "/tarefas", icon: CheckCircle2, label: "Tarefas" },
  { path: "/lembretes", icon: Bell, label: "Lembretes" },
];

const adminSidebarItems = [
  { path: "/admin/empresa", icon: Building2, label: "Empresa" },
  { path: "/admin/utilizadores", icon: Users, label: "Utilizadores" },
  { path: "/admin/marcas", icon: FileText, label: "Marcas" },
];

export function AdminSidebar() {
  const [location] = useLocation();
  const { user, empresa } = useAuth();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-card-border flex flex-col z-40">
      {/* Header */}
      <div className="p-4 border-b border-card-border">
        {empresa?.logoUrl ? (
          <img 
            src={empresa.logoUrl} 
            alt={empresa.nome} 
            className="h-10 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <h2 className="font-semibold text-foreground truncate">{empresa?.nome}</h2>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        <div>
          <p className="px-2 text-xs font-semibold text-muted-foreground mb-2">NAVEGAÇÃO</p>
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            
            return (
              <Link key={item.path} href={item.path}>
                <button
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover-elevate"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              </Link>
            );
          })}
        </div>

        <div className="pt-2">
          <p className="px-2 text-xs font-semibold text-muted-foreground mb-2">ADMIN</p>
          {adminSidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            
            return (
              <Link key={item.path} href={item.path}>
                <button
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover-elevate"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-card-border space-y-2">
        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
