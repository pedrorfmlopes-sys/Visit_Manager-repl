import { Link, useLocation } from "wouter";
import { LayoutDashboard, Building2, Users, FileText, CheckCircle2, Bell, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useTodaySummary } from "@/hooks/use-today-summary";
import {
  Drawer,
  DrawerContent,
  DrawerClose,
} from "@/components/ui/drawer";

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
  { path: "/admin/entidade-tipos", icon: Building2, label: "Tipos de Entidades" },
];

interface AdminDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminDrawerContent() {
  const [location] = useLocation();
  const { empresa } = useAuth();
  const { tarefasAtrasadas, tarefasHoje, visitasHoje } = useTodaySummary();

  const NavItem = ({ item }: { item: any }) => {
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
      <DrawerClose asChild>
        <Link href={item.path}>
          <button
            data-testid={`nav-drawer-${item.label.toLowerCase()}`}
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
                data-testid={`badge-drawer-${item.label.toLowerCase()}`}
              >
                {Math.min(badgeCount, 9)}{badgeCount > 9 ? "+" : ""}
              </Badge>
            )}
          </button>
        </Link>
      </DrawerClose>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with logo and close button */}
      <div className="p-4 border-b border-card-border flex items-center justify-between">
        <div className="flex-1">
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
        <DrawerClose asChild>
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-drawer-close"
          >
            <X className="h-5 w-5" />
          </Button>
        </DrawerClose>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        <div>
          <p className="px-2 text-xs font-semibold text-muted-foreground mb-2">NAVEGAÇÃO</p>
          {sidebarItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </div>

        <div className="pt-2">
          <p className="px-2 text-xs font-semibold text-muted-foreground mb-2">ADMIN</p>
          {adminSidebarItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </div>
      </nav>
    </div>
  );
}

export function AdminDrawerMenu({ open, onOpenChange }: AdminDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="left">
      <DrawerContent className="fixed inset-y-0 left-0 max-w-xs w-80 rounded-none border-r border-l-0">
        <AdminDrawerContent />
      </DrawerContent>
    </Drawer>
  );
}
