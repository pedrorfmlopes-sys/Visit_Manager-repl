import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Bell,
  Building2,
  CalendarPlus2,
  CheckCircle2,
  ContactRound,
  FileText,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Plus,
  Settings,
  Target,
  UserRound,
  Users,
  CalendarRange,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useAuth } from "@/hooks/useAuth";
import { useTodaySummary } from "@/hooks/use-today-summary";

type DrawerMode = "create" | "more" | null;

type DrawerItem = {
  path: string;
  icon: typeof Building2;
  label: string;
  badge?: number;
  destructive?: boolean;
  testId: string;
};

function DrawerNavigationItem({ item }: { item: DrawerItem }) {
  const Icon = item.icon;

  return (
    <DrawerClose asChild>
      <Link href={item.path}>
        <button
          type="button"
          className="flex min-h-14 w-full items-center gap-4 rounded-xl border border-transparent px-3 py-2 text-left text-foreground transition-colors hover:border-border hover:bg-muted/70"
          data-testid={item.testId}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <span className="flex-1 text-sm font-medium">{item.label}</span>
          {!!item.badge && (
            <Badge
              variant={item.destructive ? "destructive" : "default"}
              className="min-w-6 justify-center"
            >
              {item.badge > 9 ? "9+" : item.badge}
            </Badge>
          )}
        </button>
      </Link>
    </DrawerClose>
  );
}

export function BottomNav() {
  const [location] = useLocation();
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const { isAdmin, isModuleEnabled } = useAuth();
  const { tarefasAtrasadas, tarefasHoje, visitasHoje } = useTodaySummary();
  const taskCount = tarefasAtrasadas || tarefasHoje;
  const isHomeActive = location === "/";
  const isEntitiesActive = location.startsWith("/entidades");
  const isVisitsActive = location.startsWith("/visitas");
  const isMoreActive = [
    "/contactos",
    "/tarefas",
    "/planeamento",
    "/leads",
    "/admin/leads",
    "/lembretes",
    "/perfil",
    "/admin/empresa",
  ].some((path) => location.startsWith(path));

  const createItems: DrawerItem[] = [
    {
      path: "/entidades/nova",
      icon: Building2,
      label: "Nova entidade",
      testId: "mobile-create-entidade",
    },
    {
      path: "/contactos/novo",
      icon: ContactRound,
      label: "Novo contacto",
      testId: "mobile-create-contacto",
    },
    {
      path: "/visitas/nova",
      icon: CalendarPlus2,
      label: "Nova visita",
      testId: "mobile-create-visita",
    },
    {
      path: "/tarefas/nova",
      icon: CheckCircle2,
      label: "Nova tarefa",
      testId: "mobile-create-tarefa",
    },
  ];

  const moreItems: DrawerItem[] = [
    {
      path: "/planeamento",
      icon: CalendarRange,
      label: "Planeamento",
      testId: "mobile-more-planeamento",
    },
    {
      path: "/contactos",
      icon: Users,
      label: "Contactos",
      testId: "mobile-more-contactos",
    },
    {
      path: "/tarefas",
      icon: CheckCircle2,
      label: "Tarefas",
      badge: taskCount,
      destructive: tarefasAtrasadas > 0,
      testId: "mobile-more-tarefas",
    },
    ...(isModuleEnabled("leads")
      ? [
          {
            path: isAdmin ? "/admin/leads" : "/leads",
            icon: Target,
            label: "Leads",
            testId: "mobile-more-leads",
          },
        ]
      : []),
    {
      path: "/lembretes",
      icon: Bell,
      label: "Lembretes",
      testId: "mobile-more-lembretes",
    },
    {
      path: "/perfil",
      icon: UserRound,
      label: "Perfil",
      testId: "mobile-more-perfil",
    },
    ...(isAdmin
      ? [
          {
            path: "/admin/empresa",
            icon: Settings,
            label: "Definições",
            testId: "mobile-more-settings",
          },
        ]
      : []),
  ];

  const navClass = (active: boolean) =>
    `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors ${
      active ? "text-primary" : "text-muted-foreground"
    }`;

  return (
    <>
      <nav
        className="safe-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-card-border bg-card/95 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden"
        aria-label="Navegação principal"
        data-testid="mobile-bottom-nav"
      >
        <div className="mx-auto flex h-[4.5rem] max-w-lg items-stretch px-2">
          <Link href="/" className={navClass(isHomeActive)} data-testid="nav-início">
            <LayoutDashboard className="h-5 w-5" />
            <span>Início</span>
          </Link>

          <Link
            href="/entidades"
            className={navClass(isEntitiesActive)}
            data-testid="nav-entidades"
          >
            <Building2 className="h-5 w-5" />
            <span>Entidades</span>
          </Link>

          <button
            type="button"
            className="relative flex min-w-[4.5rem] flex-col items-center justify-end pb-2 text-[11px] font-semibold text-primary"
            onClick={() => setDrawerMode("create")}
            data-testid="mobile-nav-create"
            aria-label="Criar novo registo"
          >
            <span className="absolute -top-5 flex h-14 w-14 items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(15,23,42,0.22)]">
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </span>
            <span>Criar</span>
          </button>

          <Link
            href="/visitas"
            className={navClass(isVisitsActive)}
            data-testid="nav-visitas"
          >
            <span className="relative">
              <FileText className="h-5 w-5" />
              {visitasHoje > 0 && (
                <Badge className="absolute -right-3 -top-2 flex h-5 min-w-5 items-center justify-center px-1 text-[10px]">
                  {visitasHoje > 9 ? "9+" : visitasHoje}
                </Badge>
              )}
            </span>
            <span>Visitas</span>
          </Link>

          <button
            type="button"
            className={navClass(isMoreActive)}
            onClick={() => setDrawerMode("more")}
            data-testid="mobile-nav-more"
          >
            <span className="relative">
              <MoreHorizontal className="h-5 w-5" />
              {taskCount > 0 && (
                <span
                  className={`absolute -right-2 -top-1 h-2.5 w-2.5 rounded-full border-2 border-card ${
                    tarefasAtrasadas > 0 ? "bg-destructive" : "bg-primary"
                  }`}
                />
              )}
            </span>
            <span>Mais</span>
          </button>
        </div>
      </nav>

      <Drawer
        open={drawerMode !== null}
        onOpenChange={(open) => {
          if (!open) setDrawerMode(null);
        }}
      >
        <DrawerContent className="max-h-[85dvh] rounded-t-3xl">
          <div className="mx-auto w-full max-w-lg overflow-y-auto safe-bottom">
            <DrawerHeader className="px-5 pb-2 text-left">
              <DrawerTitle>
                {drawerMode === "create" ? "O que pretende criar?" : "Mais opções"}
              </DrawerTitle>
              <DrawerDescription>
                {drawerMode === "create"
                  ? "Escolha um novo registo."
                  : "Aceda às restantes áreas da aplicação."}
              </DrawerDescription>
            </DrawerHeader>

            <div className="space-y-1 px-3 pb-3">
              {(drawerMode === "create" ? createItems : moreItems).map((item) => (
                <DrawerNavigationItem key={item.testId} item={item} />
              ))}

              {drawerMode === "more" && (
                <DrawerClose asChild>
                  <button
                    type="button"
                    className="mt-2 flex min-h-14 w-full items-center gap-4 rounded-xl px-3 py-2 text-left text-destructive transition-colors hover:bg-destructive/10"
                    onClick={() => {
                      window.location.href = "/api/logout";
                    }}
                    data-testid="mobile-more-logout"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                      <LogOut className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-medium">Terminar sessão</span>
                  </button>
                </DrawerClose>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
