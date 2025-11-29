import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  CheckCircle2,
  QrCode,
  Bell,
  Settings,
  MoreHorizontal,
  Target, // ícone para Leads
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Lembrete } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useTodaySummary } from "@/hooks/use-today-summary";

type NavItem = {
  path: string;
  icon: typeof LayoutDashboard;
  label: string;
  showBadge?: string; // "lembretes" | "tarefas" | "visitas"
};

const agentNavItems: NavItem[] = [
  { path: "/", icon: LayoutDashboard, label: "Hoje" },
  { path: "/entidades", icon: Building2, label: "Entidades" },
  { path: "/contactos", icon: Users, label: "Contactos" },
  { path: "/leads", icon: Target, label: "Leads" }, // Leads para agente
  { path: "/visitas", icon: FileText, label: "Visitas", showBadge: "visitas" },
  { path: "/tarefas", icon: CheckCircle2, label: "Tarefas", showBadge: "tarefas" },
  { path: "/agente-mais", icon: MoreHorizontal, label: "Mais" },
];

const adminNavItems: NavItem[] = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/entidades", icon: Building2, label: "Entidades" },
  { path: "/contactos", icon: Users, label: "Contactos" },
  { path: "/leads", icon: Target, label: "Leads" }, // Leads para admin
  { path: "/visitas", icon: FileText, label: "Visitas", showBadge: "visitas" },
  { path: "/tarefas", icon: CheckCircle2, label: "Tarefas", showBadge: "tarefas" },
  { path: "/lembretes", icon: Bell, label: "Lembretes", showBadge: "lembretes" },
];

export function BottomNav() {
  const [location] = useLocation();
  const { isAdmin, empresa } = useAuth();
  const { tarefasAtrasadas, tarefasHoje, visitasHoje } = useTodaySummary();

  // NOVO: decidir se Leads está ativo para esta empresa
  const leadsEnabled =
    empresa?.features && typeof empresa.features.leadsEnabled === "boolean"
      ? empresa.features.leadsEnabled
      : true; // default: ativo se não estiver definido

  const baseNavItems = isAdmin ? adminNavItems : agentNavItems;

  // Se leadsEnabled === false, removemos o item "/leads" do menu
  const navItems = leadsEnabled
    ? baseNavItems
    : baseNavItems.filter((item) => item.path !== "/leads");

  const { data: lembretes } = useQuery<Lembrete[]>({
    queryKey: ["/api/lembretes"],
    refetchInterval: 60000,
  });

  const lembretesCount = lembretes?.length || 0;

  const getBadgeInfo = (
    badgeType?: string
  ): { count: number; variant: "default" | "destructive"; testId: string } | null => {
    if (!badgeType) return null;

    if (badgeType === "lembretes") {
      return lembretesCount > 0
        ? {
            count: lembretesCount,
            variant: "default",
            testId: "badge-reminders-count",
          }
        : null;
    }

    if (badgeType === "tarefas") {
      const count = tarefasAtrasadas || tarefasHoje;
      return count > 0
        ? {
            count: Math.min(count, 9),
            variant: tarefasAtrasadas > 0 ? "destructive" : "default",
            testId:
              tarefasAtrasadas > 0
                ? "badge-tasks-overdue"
                : "badge-tasks-today",
          }
        : null;
    }

    if (badgeType === "visitas") {
      return visitasHoje > 0
        ? {
            count: Math.min(visitasHoje, 9),
            variant: "default",
            testId: "badge-visits-today",
          }
        : null;
    }

    return null;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-card-border z-50 safe-bottom-nav">
      <div className="h-16 flex items-center justify-around max-w-2xl mx-auto px-2 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location === item.path ||
            (item.path !== "/" && location.startsWith(item.path));

          const badgeInfo = getBadgeInfo(item.showBadge);

          return (
            <Link
              key={item.path}
              href={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <div
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-md transition-colors relative ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover-elevate"
                }`}
              >
                <div className="relative">
                  <Icon className="h-6 w-6" />
                  {badgeInfo && (
                    <Badge
                      variant={badgeInfo.variant}
                      className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                      data-testid={badgeInfo.testId}
                    >
                      {badgeInfo.count > 9 ? "9+" : badgeInfo.count}
                    </Badge>
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
