import { Link, useLocation } from "wouter";
import {
  Bell,
  Building2,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Target,
  UserRound,
  Users,
  CalendarRange,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useTodaySummary } from "@/hooks/use-today-summary";
import { BrandMark } from "@/components/BrandLogo";

export function TabletNavRail() {
  const [location] = useLocation();
  const { empresa, isAdmin, isModuleEnabled } = useAuth();
  const { tarefasAtrasadas, tarefasHoje, visitasHoje } = useTodaySummary();

  const items = [
    { path: "/", icon: LayoutDashboard, label: "Início" },
    { path: "/entidades", icon: Building2, label: "Entidades" },
    { path: "/contactos", icon: Users, label: "Contactos" },
    { path: "/visitas", icon: FileText, label: "Visitas", badge: visitasHoje },
    {
      path: "/tarefas",
      icon: CheckCircle2,
      label: "Tarefas",
      badge: tarefasAtrasadas || tarefasHoje,
      destructive: tarefasAtrasadas > 0,
    },
    { path: "/planeamento", icon: CalendarRange, label: "Plano" },
    ...(isModuleEnabled("leads")
      ? [
          {
            path: isAdmin ? "/admin/leads" : "/leads",
            icon: Target,
            label: "Leads",
          },
        ]
      : []),
    { path: "/lembretes", icon: Bell, label: "Lembretes" },
  ];

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-24 flex-col border-r border-card-border bg-card md:flex xl:hidden"
      data-testid="tablet-nav-rail"
    >
      <div className="flex h-20 flex-col items-center justify-center gap-1 border-b border-card-border px-2">
        <BrandMark className="h-11 w-11" title="Visit Manager" />
        <span className="max-w-full truncate text-[9px] font-medium text-muted-foreground">
          {empresa?.nome}
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label="Navegação tablet">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            location === item.path ||
            (item.path !== "/" && location.startsWith(item.path));

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              data-testid={`tablet-nav-${item.label.toLowerCase()}`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {!!item.badge && (
                  <Badge
                    variant={item.destructive ? "destructive" : "default"}
                    className="absolute -right-4 -top-3 flex h-5 min-w-5 items-center justify-center px-1 text-[10px]"
                  >
                    {item.badge > 9 ? "9+" : item.badge}
                  </Badge>
                )}
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-card-border p-2">
        <Link
          href="/perfil"
          className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          data-testid="tablet-nav-perfil"
        >
          <UserRound className="h-5 w-5" />
          <span>Perfil</span>
        </Link>
        {isAdmin && (
          <Link
            href="/admin/empresa"
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            data-testid="tablet-nav-settings"
          >
            <Settings className="h-5 w-5" />
            <span>Definições</span>
          </Link>
        )}
        <button
          type="button"
          className="flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            window.location.href = "/api/logout";
          }}
          data-testid="tablet-nav-logout"
        >
          <LogOut className="h-5 w-5" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
