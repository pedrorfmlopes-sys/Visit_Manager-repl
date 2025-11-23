import { Link, useLocation } from "wouter";
import { LayoutDashboard, Building2, Users, FileText, CheckCircle2, QrCode, Bell, Settings, MoreHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Lembrete } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

type NavItem = {
  path: string;
  icon: typeof LayoutDashboard;
  label: string;
  showBadge?: boolean;
};

const agentNavItems: NavItem[] = [
  { path: "/", icon: LayoutDashboard, label: "Hoje" },
  { path: "/entidades", icon: Building2, label: "Entidades" },
  { path: "/contactos", icon: Users, label: "Contactos" },
  { path: "/visitas", icon: FileText, label: "Visitas" },
  { path: "/tarefas", icon: CheckCircle2, label: "Tarefas" },
  { path: "/agente-mais", icon: MoreHorizontal, label: "Mais" },
];

const adminNavItems: NavItem[] = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/entidades", icon: Building2, label: "Entidades" },
  { path: "/contactos", icon: Users, label: "Contactos" },
  { path: "/visitas", icon: FileText, label: "Visitas" },
  { path: "/tarefas", icon: CheckCircle2, label: "Tarefas" },
  { path: "/lembretes", icon: Bell, label: "Lembretes", showBadge: true },
];

export function BottomNav() {
  const [location] = useLocation();
  const { isAdmin } = useAuth();
  
  const navItems = isAdmin ? adminNavItems : agentNavItems;
  
  const { data: lembretes } = useQuery<Lembrete[]>({
    queryKey: ['/api/lembretes'],
    refetchInterval: 60000,
  });

  const lembretesCount = lembretes?.length || 0;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-card-border z-50 safe-bottom-nav">
      <div className="h-16 flex items-center justify-around max-w-2xl mx-auto px-2 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
          const showBadge = item.showBadge && lembretesCount > 0;
          
          return (
            <Link
              key={item.path}
              href={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <div className={`flex flex-col items-center gap-1 px-4 py-2 rounded-md transition-colors relative ${
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover-elevate"
              }`}>
                <div className="relative">
                  <Icon className="h-6 w-6" />
                  {showBadge && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                      data-testid="badge-reminders-count"
                    >
                      {lembretesCount}
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
