import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Building2,
  Users,
  CheckCircle2,
  Bell,
  Settings,
  LogOut,
  Calendar,
  Flag,
  CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useTodaySummary } from "@/hooks/use-today-summary";
import type { EmpresaModuleId } from "@shared/modules";
import { BrandLogo } from "@/components/BrandLogo";
import { useQuery } from "@tanstack/react-query";

const sidebarItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/entidades", icon: Building2, label: "Entidades" },
  { path: "/contactos", icon: Users, label: "Contactos" },
  { path: "/visitas", icon: Calendar, label: "Visitas" },
  { path: "/tarefas", icon: CheckCircle2, label: "Tarefas" },
  { path: "/planeamento", icon: CalendarRange, label: "Planeamento" },
  { path: "/admin/leads", icon: Flag, label: "Leads", moduleId: "leads" as EmpresaModuleId },
  { path: "/lembretes", icon: Bell, label: "Lembretes" },
];

export function AdminSidebar() {
  const [location, setLocation] = useLocation();
  const { user, empresa, isAdmin, isModuleEnabled } = useAuth();
  const { tarefasAtrasadas, tarefasHoje, visitasHoje } = useTodaySummary();
  const { data: leadApprovals } = useQuery<{
    requests: Array<{ id: string }>;
  }>({
    queryKey: ["/api/crm/leads/approvals", "pending"],
    queryFn: async () => {
      const response = await fetch(
        "/api/crm/leads/approvals?status=pending",
        { credentials: "include" },
      );
      if (!response.ok) return { requests: [] };
      return response.json();
    },
    enabled: isAdmin && isModuleEnabled("leads"),
    refetchInterval: 30_000,
  });

  const visibleSidebarItems = sidebarItems.filter(
    (item) => !item.moduleId || isModuleEnabled(item.moduleId),
  );

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-card-border bg-card"
      data-testid="desktop-sidebar"
    >
      <div className="space-y-3 border-b border-card-border p-4">
        <BrandLogo markClassName="h-9 w-9" wordmarkClassName="text-base" />
        <div className="flex min-h-7 items-center border-t border-card-border pt-3">
          {empresa?.logoUrl ? (
            <img
              src={empresa.logoUrl}
              alt={empresa.nome}
              className="max-h-7 max-w-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <p className="truncate text-xs font-medium text-muted-foreground">{empresa?.nome}</p>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        <div>
          <p className="mb-2 px-2 text-xs font-semibold text-muted-foreground">NAVEGAÇÃO</p>
          {visibleSidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location === item.path || (item.path !== "/" && location.startsWith(item.path));

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
                showBadge = true;
              }
            } else if (item.label === "Visitas" && visitasHoje > 0) {
              badgeCount = visitasHoje;
              showBadge = true;
            } else if (
              item.label === "Leads" &&
              (leadApprovals?.requests.length ?? 0) > 0
            ) {
              badgeCount = leadApprovals?.requests.length ?? 0;
              badgeVariant = "destructive";
              showBadge = true;
            }

            return (
              <Link key={item.path} href={item.path}>
                <button
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  className={`relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover-elevate hover:text-foreground"
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
                      {Math.min(badgeCount, 9)}
                      {badgeCount > 9 ? "+" : ""}
                    </Badge>
                  )}
                </button>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="space-y-2 border-t border-card-border p-4">
        <div className="flex flex-col gap-1">
          {user?.firstName && user?.lastName ? (
            <>
              <p className="truncate text-xs font-medium text-foreground">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </>
          ) : (
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          )}
        </div>

        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs hover-elevate"
            onClick={() => setLocation("/admin/empresa")}
            data-testid="button-settings"
          >
            <Settings className="mr-2 h-4 w-4" />
            Definições
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
