import { Link, useLocation } from "wouter";
import { LayoutDashboard, Building2, Users, CheckCircle2, Bell, Settings, LogOut, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useTodaySummary } from "@/hooks/use-today-summary";

const sidebarItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/entidades", icon: Building2, label: "Entidades" },
  { path: "/contactos", icon: Users, label: "Contactos" },
  { path: "/visitas", icon: Calendar, label: "Visitas" },
  { path: "/tarefas", icon: CheckCircle2, label: "Tarefas" },
  { path: "/lembretes", icon: Bell, label: "Lembretes" },
];

const adminSidebarItems = [
  { path: "/admin/empresa", icon: Settings, label: "Definições" },
];

export function AdminSidebar() {
  const [location] = useLocation();
  const { user, empresa } = useAuth();
  const { tarefasAtrasadas, tarefasHoje, visitasHoje } = useTodaySummary();

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
            
            // Determine badge count
            let badgeCount = 0;
            let badgeVariant: "default" | "destructive" = "default";
            let showBadge = false;
            
            if (item.label === "Tarefas") {
              if (tarefasAtrasadas > 0) {
                badgeCount = tarefasAtrasadas;
                badgeVariant = "destructive";
                showBadge = true;
              } else if (tarefasHoje > 0) {
                badgeCount = tarefasHoje;
                badgeVariant = "default";
                showBadge = true;
              }
            } else if (item.label === "Visitas" && visitasHoje > 0) {
              badgeCount = visitasHoje;
              badgeVariant = "default";
              showBadge = true;
            }
            
            return (
              <Link key={item.path} href={item.path}>
                <button
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm relative ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover-elevate"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                  {showBadge && (
                    <Badge
                      variant={badgeVariant}
                      className="ml-auto text-xs"
                      data-testid={`badge-sidebar-${item.label.toLowerCase()}`}
                    >
                      {Math.min(badgeCount, 9)}{badgeCount > 9 ? "+" : ""}
                    </Badge>
                  )}
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
        <Link href="/perfil">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover-elevate transition-colors"
            data-testid="button-admin-settings"
          >
            <Settings className="h-4 w-4" />
            Definições
          </button>
        </Link>
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
