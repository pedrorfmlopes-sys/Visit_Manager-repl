import { useEffect, useRef, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { pt } from "date-fns/locale";
import {
  ArrowRight,
  AlertTriangle,
  CalendarDays,
  CalendarPlus2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GripVertical,
  ListTodo,
  MapPinned,
  Plus,
  Route,
  UserRound,
} from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  analyzePlanningConflicts,
  buildGoogleMapsRouteUrl,
} from "@/lib/planning";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface PlanningUser {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface PlanningEntity {
  id: string;
  nome: string;
  latitude?: string | null;
  longitude?: string | null;
  cidade?: string | null;
}

interface PlanningTask {
  id: string;
  titulo: string;
  dueDate?: string | null;
  status: "pending" | "done";
  assignedUserId?: string | null;
  createdByUserId: string;
  entidade?: PlanningEntity | null;
}

interface PlanningVisit {
  id: string;
  dataVisita: string;
  assignedUserId?: string | null;
  userId: string;
  notas?: string | null;
  entidade?: PlanningEntity | null;
}

interface PlanningResponse {
  tasks: PlanningTask[];
  visits: PlanningVisit[];
}

interface PlanningContextResponse {
  role: "admin" | "agent";
  currentUserId: string;
  users: PlanningUser[];
  unplannedTasks: PlanningTask[];
}

type PlanningView = "day" | "week" | "month";

type PlanningItem =
  | {
      kind: "tarefa";
      id: string;
      title: string;
      scheduledAt: string | null;
      assignedUserId: string | null;
      entity: PlanningEntity | null;
      status: "pending" | "done";
      raw: PlanningTask;
    }
  | {
      kind: "visita";
      id: string;
      title: string;
      scheduledAt: string;
      assignedUserId: string | null;
      entity: PlanningEntity | null;
      raw: PlanningVisit;
    };

function userName(user?: PlanningUser) {
  if (!user) return "Sem responsável";
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.email ||
    "Utilizador"
  );
}

function toLocalInputValue(value: string | null) {
  if (!value) return "";
  return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
}

function getInitialAnchor() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("date") || params.get("week");
  if (!value) return new Date();
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getInitialView(): PlanningView {
  const value = new URLSearchParams(window.location.search).get("view");
  return value === "day" || value === "month" ? value : "week";
}

function getPlanningRange(anchor: Date, view: PlanningView) {
  if (view === "day") {
    return { start: startOfDay(anchor), end: endOfDay(anchor) };
  }
  if (view === "month") {
    return {
      start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
    };
  }
  return {
    start: startOfWeek(anchor, { weekStartsOn: 1 }),
    end: endOfWeek(anchor, { weekStartsOn: 1 }),
  };
}

function changePlanningPeriod(
  anchor: Date,
  view: PlanningView,
  direction: -1 | 1,
) {
  if (view === "day") {
    return direction === 1 ? addDays(anchor, 1) : subDays(anchor, 1);
  }
  if (view === "month") {
    return direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1);
  }
  return direction === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1);
}

async function fetchPlanningRange(from: string, to: string) {
  const params = new URLSearchParams({ from, to, includeContext: "false" });
  const response = await fetch(`/api/planeamento?${params}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Não foi possível carregar o planeamento.");
  }
  return response.json() as Promise<PlanningResponse>;
}

async function fetchPlanningContext() {
  const response = await fetch("/api/planeamento/context", {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Não foi possível carregar o contexto do planeamento.");
  }
  return response.json() as Promise<PlanningContextResponse>;
}

function getPlanningDate(day: Date, source?: string | null) {
  const result = new Date(day);
  if (source) {
    const sourceDate = new Date(source);
    result.setHours(sourceDate.getHours(), sourceDate.getMinutes(), 0, 0);
  } else {
    result.setHours(9, 0, 0, 0);
  }
  return result;
}

function PlanningCard({
  item,
  user,
  showUser,
  compact = false,
  hasConflict = false,
  onSelect,
}: {
  item: PlanningItem;
  user?: PlanningUser;
  showUser: boolean;
  compact?: boolean;
  hasConflict?: boolean;
  onSelect: (item: PlanningItem) => void;
}) {
  const isVisit = item.kind === "visita";
  const isDone = item.kind === "tarefa" && item.status === "done";
  const draggable = useDraggable({
    id: `${item.kind}:${item.id}`,
    data: { item },
  });
  const transform = draggable.transform;

  return (
    <div
      ref={draggable.setNodeRef}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(item);
        }
      }}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        opacity: draggable.isDragging ? 0.55 : undefined,
        zIndex: draggable.isDragging ? 20 : undefined,
      }}
      className={`relative w-full overflow-hidden cursor-pointer rounded-xl border text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
        compact ? "p-2" : "p-3"
      } ${
        hasConflict
          ? "border-red-300 bg-red-50/90 ring-1 ring-red-200"
          : isVisit
          ? "border-[#22C7A9]/35 bg-[#EAF9F6]"
          : isDone
            ? "border-border bg-muted/50 opacity-65"
            : "border-amber-200 bg-amber-50/80"
      }`}
      data-testid={`planning-item-${item.kind}-${item.id}`}
    >
      <div className={`flex items-start ${compact ? "gap-1.5" : "gap-2"}`}>
        <span
          className={`mt-0.5 flex shrink-0 items-center justify-center rounded-lg ${
            compact ? "h-5 w-5" : "h-7 w-7"
          } ${
            isVisit
              ? "bg-[#073B4C] text-white"
              : "bg-amber-500/15 text-amber-700"
          }`}
        >
          {isVisit ? (
            <CalendarPlus2 className={compact ? "h-3 w-3" : "h-4 w-4"} />
          ) : (
            <ListTodo className={compact ? "h-3 w-3" : "h-4 w-4"} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold leading-snug ${compact ? "line-clamp-1 text-xs" : "line-clamp-2 text-sm"}`}>
            {item.title}
          </span>
          {item.entity && !compact && (
            <span className="mt-1 line-clamp-1 block text-xs text-muted-foreground">
              {item.entity.nome}
            </span>
          )}
        </span>
      </div>
      <div className={`${compact ? "mt-1" : "mt-3"} flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground`}>
        {item.scheduledAt && (
          <span className="flex items-center gap-1">
            <Clock3 className="h-3 w-3" />
            {format(new Date(item.scheduledAt), "HH:mm")}
          </span>
        )}
        {showUser && !compact && (
          <span className="flex min-w-0 items-center gap-1">
            <UserRound className="h-3 w-3 shrink-0" />
            <span className="truncate">{userName(user)}</span>
          </span>
        )}
        {isDone && <Badge variant="secondary">Concluída</Badge>}
        {hasConflict && (
          <span
            className="flex items-center gap-1 font-medium text-red-700"
            title="Possível sobreposição de horário"
          >
            <AlertTriangle className="h-3 w-3" />
            {!compact && "Conflito"}
          </span>
        )}
        <button
          type="button"
          {...draggable.attributes}
          {...draggable.listeners}
          aria-label={`Arrastar ${item.title}`}
          onClick={(event) => event.stopPropagation()}
          className={`ml-auto cursor-grab rounded-md text-muted-foreground/55 hover:bg-black/5 hover:text-foreground active:cursor-grabbing ${compact ? "p-0.5" : "p-1"}`}
          data-testid={`planning-drag-${item.kind}-${item.id}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function PlanningDayColumn({
  dayKey,
  className,
  children,
}: {
  dayKey: string;
  className: string;
  children: React.ReactNode;
}) {
  const droppable = useDroppable({ id: dayKey });

  return (
    <article
      ref={droppable.setNodeRef}
      className={`${className} ${
        droppable.isOver ? "ring-2 ring-[#22C7A9] ring-offset-2" : ""
      }`}
      data-testid={`planning-day-${dayKey}`}
    >
      {children}
    </article>
  );
}

export default function Planeamento() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [anchor, setAnchor] = useState(getInitialAnchor);
  const [view, setView] = useState<PlanningView>(getInitialView);
  const [selectedUserId, setSelectedUserId] = useState(
    () => new URLSearchParams(window.location.search).get("user") || "all",
  );
  const [selectedItem, setSelectedItem] = useState<PlanningItem | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("unassigned");
  const restoredViewRef = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );

  const range = getPlanningRange(anchor, view);
  const days = eachDayOfInterval(range);
  const from = range.start.toISOString();
  const to = range.end.toISOString();
  const planningQueryKey = ["/api/planeamento", from, to] as const;
  const planningContextQueryKey = ["/api/planeamento/context"] as const;

  const { data, isLoading, isError, isFetching } = useQuery<PlanningResponse>({
    queryKey: planningQueryKey,
    queryFn: () => fetchPlanningRange(from, to),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const {
    data: planningContext,
    isLoading: isContextLoading,
    isError: isContextError,
    isFetching: isContextFetching,
  } = useQuery<PlanningContextResponse>({
    queryKey: planningContextQueryKey,
    queryFn: fetchPlanningContext,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!data || isFetching) return;

    const adjacentAnchors = [
      changePlanningPeriod(anchor, view, -1),
      changePlanningPeriod(anchor, view, 1),
    ];
    for (const adjacentAnchor of adjacentAnchors) {
      const adjacentRange = getPlanningRange(adjacentAnchor, view);
      const adjacentFrom = adjacentRange.start.toISOString();
      const adjacentTo = adjacentRange.end.toISOString();
      void queryClient.prefetchQuery({
        queryKey: ["/api/planeamento", adjacentFrom, adjacentTo],
        queryFn: () => fetchPlanningRange(adjacentFrom, adjacentTo),
        staleTime: 60_000,
      });
    }
  }, [anchor, data, isFetching, view]);

  const isAdmin = planningContext?.role === "admin";
  const effectiveUserId = isAdmin
    ? selectedUserId
    : planningContext?.currentUserId;
  const usersById = new Map(
    planningContext?.users.map((user) => [user.id, user]) ?? [],
  );
  const tasksById = new Map<string, PlanningTask>();
  planningContext?.unplannedTasks.forEach((task) => tasksById.set(task.id, task));
  data?.tasks.forEach((task) => tasksById.set(task.id, task));
  const planningTasks = Array.from(tasksById.values());

  const items: PlanningItem[] = [
    ...(planningTasks.map(
      (task): PlanningItem => ({
        kind: "tarefa",
        id: task.id,
        title: task.titulo,
        scheduledAt: task.dueDate ?? null,
        assignedUserId: task.assignedUserId ?? task.createdByUserId,
        entity: task.entidade ?? null,
        status: task.status,
        raw: task,
      }),
    )),
    ...(data?.visits.map(
      (visit): PlanningItem => ({
        kind: "visita",
        id: visit.id,
        title: visit.entidade?.nome || "Visita",
        scheduledAt: visit.dataVisita,
        assignedUserId: visit.assignedUserId ?? visit.userId,
        entity: visit.entidade ?? null,
        raw: visit,
      }),
    ) ?? []),
  ].filter(
    (item) => effectiveUserId === "all" || item.assignedUserId === effectiveUserId,
  );

  const plannedItems = items.filter((item) => item.scheduledAt);
  const unplannedTasks = items.filter(
    (item) => item.kind === "tarefa" && !item.scheduledAt && item.status === "pending",
  );
  const periodVisits = plannedItems.filter((item) => item.kind === "visita");
  const pendingTasks = items.filter(
    (item) => item.kind === "tarefa" && item.status === "pending",
  );
  const { conflictingItemIds, overloadedDayKeys, conflictDayKeys } =
    analyzePlanningConflicts(plannedItems);

  const planningReturnPath = (() => {
    const params = new URLSearchParams({
      week: format(anchor, "yyyy-MM-dd"),
      view,
    });
    if (isAdmin && selectedUserId !== "all") {
      params.set("user", selectedUserId);
    }
    return `/planeamento?${params.toString()}`;
  })();

  useEffect(() => {
    if (!planningContext) return;
    window.history.replaceState(null, "", planningReturnPath);
  }, [planningContext, planningReturnPath]);

  const savePlanningView = () => {
    const columns = Array.from(
      document.querySelectorAll<HTMLElement>("[data-planning-scroll-day]"),
    );
    sessionStorage.setItem(
      "visit-manager:planning-view",
      JSON.stringify({
        path: planningReturnPath,
        windowScrollY: window.scrollY,
        columns: Object.fromEntries(
          columns.map((column) => [
            column.dataset.planningScrollDay,
            column.scrollTop,
          ]),
        ),
      }),
    );
  };

  const navigateFromPlanning = (
    path: string,
    params: Record<string, string> = {},
  ) => {
    savePlanningView();
    const search = new URLSearchParams(params);
    search.set("returnTo", planningReturnPath);
    setLocation(`${path}?${search.toString()}`);
  };

  useEffect(() => {
    if (!data || !planningContext || restoredViewRef.current) return;
    restoredViewRef.current = true;
    const raw = sessionStorage.getItem("visit-manager:planning-view");
    if (!raw) return;

    try {
      const state = JSON.parse(raw) as {
        path?: string;
        windowScrollY?: number;
        columns?: Record<string, number>;
      };
      if (state.path !== planningReturnPath) return;
      requestAnimationFrame(() => {
        window.scrollTo({ top: state.windowScrollY || 0 });
        Object.entries(state.columns || {}).forEach(([dayKey, scrollTop]) => {
          const column = document.querySelector<HTMLElement>(
            `[data-planning-scroll-day="${dayKey}"]`,
          );
          if (column) column.scrollTop = scrollTop;
        });
      });
    } catch {
      sessionStorage.removeItem("visit-manager:planning-view");
    }
  }, [data, planningContext, planningReturnPath]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) return;
      const body: Record<string, string | null> = {
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      };
      if (isAdmin) {
        body.assignedUserId =
          assignedUserId === "unassigned" ? null : assignedUserId;
      }
      await apiRequest(
        "PATCH",
        `/api/planeamento/${selectedItem.kind}/${selectedItem.id}`,
        body,
      );
    },
    onSuccess: async () => {
      if (selectedItem?.kind === "tarefa" && scheduledAt) {
        queryClient.setQueryData<PlanningContextResponse>(
          planningContextQueryKey,
          (current) =>
            current
              ? {
                  ...current,
                  unplannedTasks: current.unplannedTasks.filter(
                    (task) => task.id !== selectedItem.id,
                  ),
                }
              : current,
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/planeamento"] }),
        queryClient.invalidateQueries({ queryKey: planningContextQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/visitas"] }),
      ]);
      setSelectedItem(null);
      toast({ title: "Planeamento atualizado" });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({
      item,
      targetDate,
    }: {
      item: PlanningItem;
      targetDate: Date;
    }) => {
      await apiRequest(
        "PATCH",
        `/api/planeamento/${item.kind}/${item.id}`,
        { scheduledAt: targetDate.toISOString() },
      );
    },
    onMutate: async ({ item, targetDate }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["/api/planeamento"] }),
        queryClient.cancelQueries({ queryKey: planningContextQueryKey }),
      ]);
      const previousRange =
        queryClient.getQueryData<PlanningResponse>(planningQueryKey);
      const previousContext =
        queryClient.getQueryData<PlanningContextResponse>(
          planningContextQueryKey,
        );

      queryClient.setQueryData<PlanningResponse>(
        planningQueryKey,
        (current) => {
          if (!current) return current;
          const scheduledAt = targetDate.toISOString();

          if (item.kind === "tarefa") {
            const exists = current.tasks.some((task) => task.id === item.id);
            return {
              ...current,
              tasks: exists
                ? current.tasks.map((task) =>
                    task.id === item.id
                      ? { ...task, dueDate: scheduledAt }
                      : task,
                  )
                : [...current.tasks, { ...item.raw, dueDate: scheduledAt }],
            };
          }

          return {
            ...current,
            visits: current.visits.map((visit) =>
              visit.id === item.id
                ? { ...visit, dataVisita: scheduledAt }
                : visit,
            ),
          };
        },
      );

      if (item.kind === "tarefa") {
        queryClient.setQueryData<PlanningContextResponse>(
          planningContextQueryKey,
          (current) =>
            current
              ? {
                  ...current,
                  unplannedTasks: current.unplannedTasks.filter(
                    (task) => task.id !== item.id,
                  ),
                }
              : current,
        );
      }

      return { previousRange, previousContext };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/planeamento"] }),
        queryClient.invalidateQueries({ queryKey: planningContextQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/visitas"] }),
      ]);
      toast({ title: "Atividade reagendada" });
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousRange) {
        queryClient.setQueryData(planningQueryKey, context.previousRange);
      }
      if (context?.previousContext) {
        queryClient.setQueryData(
          planningContextQueryKey,
          context.previousContext,
        );
      }
      toast({
        title: "Não foi possível mover a atividade",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const item = event.active.data.current?.item as PlanningItem | undefined;
    const targetDay = event.over?.id;
    if (!item || typeof targetDay !== "string") return;

    const day = new Date(`${targetDay}T12:00:00`);
    if (Number.isNaN(day.getTime())) return;
    if (
      item.scheduledAt &&
      isSameDay(new Date(item.scheduledAt), day)
    ) {
      return;
    }

    moveMutation.mutate({
      item,
      targetDate: getPlanningDate(day, item.scheduledAt),
    });
  };

  const openEditor = (item: PlanningItem) => {
    setSelectedItem(item);
    setScheduledAt(toLocalInputValue(item.scheduledAt));
    setAssignedUserId(item.assignedUserId || "unassigned");
  };

  const openRoute = (day: Date) => {
    const visits = items
      .filter(
        (item): item is Extract<PlanningItem, { kind: "visita" }> =>
          item.kind === "visita" &&
          Boolean(item.scheduledAt) &&
          isSameDay(new Date(item.scheduledAt), day),
      )
      .map((item) => item.raw);
    const routeUrl = buildGoogleMapsRouteUrl(visits);
    if (!routeUrl) {
      toast({
        title: "Sem localizações disponíveis",
        description: "As entidades deste dia ainda não têm coordenadas válidas.",
      });
      return;
    }
    window.open(routeUrl, "_blank", "noopener,noreferrer");
  };

  const periodLabel =
    view === "day"
      ? format(anchor, "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })
      : view === "month"
        ? format(anchor, "MMMM 'de' yyyy", { locale: pt })
        : `${format(range.start, "d MMM", { locale: pt })} - ${format(range.end, "d MMM yyyy", { locale: pt })}`;
  const pageTitle = isAdmin
    ? view === "day"
      ? "Organizar o dia"
      : view === "month"
        ? "Organizar o mês"
        : "Organizar a semana"
    : view === "day"
      ? "O meu dia"
      : view === "month"
        ? "O meu mês"
        : "A minha semana";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f3faf8_0%,hsl(var(--background))_22rem)]">
      <header className="border-b border-[#073B4C]/10 px-4 py-5 md:px-6">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[#08715f]">
                <CalendarDays className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-[0.18em]">
                  {isAdmin ? "Planeamento da equipa" : "Agenda pessoal"}
                </span>
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#073B4C]">
                {pageTitle}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {isAdmin
                  ? "Distribua visitas e tarefas, equilibre a equipa e reveja os percursos."
                  : "Organize as suas visitas e tarefas e prepare o percurso de cada dia."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigateFromPlanning("/visitas/nova")}
                data-testid="planning-new-visit"
              >
                <CalendarPlus2 className="mr-2 h-4 w-4" />
                Nova visita
              </Button>
              <Button
                onClick={() => navigateFromPlanning("/tarefas/nova")}
                data-testid="planning-new-task"
              >
                <ListTodo className="mr-2 h-4 w-4" />
                Nova tarefa
              </Button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/85 p-3 shadow-sm backdrop-blur lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between gap-2 md:justify-start">
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  setAnchor((current) => changePlanningPeriod(current, view, -1))
                }
                aria-label="Período anterior"
                data-testid="planning-previous-week"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <button
                type="button"
                className="min-w-52 rounded-xl px-3 py-2 text-center text-sm font-semibold text-[#073B4C] hover:bg-muted"
                onClick={() => setAnchor(new Date())}
                data-testid="planning-current-week"
              >
                <span className="first-letter:uppercase">{periodLabel}</span>
              </button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  setAnchor((current) => changePlanningPeriod(current, view, 1))
                }
                aria-label="Período seguinte"
                data-testid="planning-next-week"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div
              className="grid grid-cols-3 rounded-xl bg-muted p-1"
              aria-label="Vista do planeamento"
            >
              {(["day", "week", "month"] as const).map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={view === option ? "default" : "ghost"}
                  className="px-3"
                  onClick={() => setView(option)}
                  data-testid={`planning-view-${option}`}
                >
                  {option === "day" ? "Dia" : option === "week" ? "Semana" : "Mês"}
                </Button>
              ))}
            </div>

            {isAdmin && (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger
                  className="w-full md:w-64"
                  data-testid="planning-user-filter"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda a equipa</SelectItem>
                  {planningContext?.users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {userName(user)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(isFetching || isContextFetching) &&
              !isLoading &&
              !isContextLoading && (
              <span
                className="text-xs text-muted-foreground"
                data-testid="planning-refreshing"
              >
                A atualizar...
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 md:px-6">
        {isLoading || isContextLoading ? (
          <div className="grid gap-3 md:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <Skeleton key={item} className="h-56 rounded-2xl" />
            ))}
          </div>
        ) : isError || isContextError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
            <p className="font-semibold">Não foi possível carregar o planeamento.</p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:max-w-3xl">
              <div className="rounded-xl border bg-card p-3">
                <p className="text-2xl font-semibold text-[#073B4C]">{periodVisits.length}</p>
                <p className="text-xs text-muted-foreground">Visitas</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <p className="text-2xl font-semibold text-[#073B4C]">{pendingTasks.length}</p>
                <p className="text-xs text-muted-foreground">Tarefas</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <p className="text-2xl font-semibold text-amber-600">{unplannedTasks.length}</p>
                <p className="text-xs text-muted-foreground">Por planear</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <p className="text-2xl font-semibold text-red-600">
                  {conflictDayKeys.size}
                </p>
                <p className="text-xs text-muted-foreground">
                  Dias com conflitos
                </p>
              </div>
            </section>

            {(conflictDayKeys.size > 0 || overloadedDayKeys.size > 0) && (
              <section
                className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"
                data-testid="planning-conflict-summary"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-semibold">Agenda a precisar de atenção</p>
                    <p className="mt-0.5 text-amber-900/75">
                      {conflictDayKeys.size > 0 &&
                        `${conflictDayKeys.size} dia(s) com horários possivelmente sobrepostos.`}
                      {conflictDayKeys.size > 0 &&
                        overloadedDayKeys.size > 0 &&
                        " "}
                      {overloadedDayKeys.size > 0 &&
                        `${overloadedDayKeys.size} dia(s) com mais de 8 atividades por responsável.`}
                    </p>
                  </div>
                </div>
                <Badge className="w-fit bg-amber-600 text-white hover:bg-amber-600">
                  {conflictingItemIds.size > 0
                    ? `${conflictingItemIds.size} atividades`
                    : `${overloadedDayKeys.size} dias`}
                </Badge>
              </section>
            )}

            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <section
                className={`planning-board-grid ${
                  view === "day"
                    ? "grid max-w-3xl grid-cols-1 gap-3"
                    : view === "month"
                      ? "grid w-full min-w-0 max-w-full grid-cols-[repeat(7,minmax(9rem,1fr))] gap-2 overflow-x-auto pb-3"
                      : "grid auto-cols-[minmax(17rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-3 lg:w-full lg:min-w-0 lg:max-w-full lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-[repeat(7,minmax(0,1fr))] lg:overflow-visible"
                }`}
                data-testid="planning-week-grid"
                data-view={view}
              >
              {days.map((day) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const dayItems = plannedItems
                  .filter((item) => isSameDay(new Date(item.scheduledAt!), day))
                  .sort(
                    (a, b) =>
                      new Date(a.scheduledAt!).getTime() -
                      new Date(b.scheduledAt!).getTime(),
                  );
                const visitsWithLocation = dayItems.filter(
                  (item) =>
                    item.kind === "visita" &&
                    item.entity?.latitude &&
                    item.entity?.longitude,
                ).length;

                return (
                  <PlanningDayColumn
                    key={day.toISOString()}
                    dayKey={dayKey}
                    className={`flex flex-col border transition-shadow ${
                      view === "month"
                        ? "h-48 rounded-xl p-2"
                        : view === "day"
                          ? "h-[40rem] rounded-2xl p-4"
                          : "h-[32rem] rounded-2xl p-3 lg:h-[calc(100vh-23rem)] lg:min-h-[22rem] lg:max-h-[42rem]"
                    } ${
                      isToday(day)
                        ? "border-[#22C7A9] bg-white shadow-[0_12px_35px_rgba(7,59,76,0.08)]"
                        : view === "month" && !isSameMonth(day, anchor)
                          ? "border-border/60 bg-muted/40 opacity-60"
                          : "border-border/80 bg-card/75"
                    }`}
                  >
                    <div
                      className={`flex min-w-0 shrink-0 flex-wrap items-start justify-between gap-2 border-b ${
                        view === "month" ? "mb-2 pb-2" : "mb-3 pb-3"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {format(day, "EEE", { locale: pt })}
                        </p>
                        <p className={`${view === "month" ? "text-base" : "mt-0.5 text-xl"} font-semibold text-[#073B4C]`}>
                          {format(day, "d")}
                        </p>
                      </div>
                      {(conflictDayKeys.has(dayKey) ||
                        overloadedDayKeys.has(dayKey)) && (
                        <Badge
                          variant="outline"
                          className="border-amber-300 bg-amber-50 px-1.5 text-[10px] text-amber-700"
                          title={
                            overloadedDayKeys.has(dayKey)
                              ? "Dia com carga elevada"
                              : "Possível conflito de horário"
                          }
                        >
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {overloadedDayKeys.has(dayKey) ? "Carga" : "Conflito"}
                        </Badge>
                      )}
                      {visitsWithLocation > 0 && view !== "month" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-[#08715f]"
                          onClick={() => openRoute(day)}
                          title="Abrir percurso sugerido"
                          data-testid={`planning-route-${format(day, "yyyy-MM-dd")}`}
                        >
                          <Route className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div
                      className={`planning-column-scroll min-h-0 flex-1 overflow-y-auto pr-1 ${
                        view === "month" ? "space-y-1" : "space-y-2"
                      }`}
                      data-planning-scroll-day={dayKey}
                      data-testid={`planning-day-scroll-${dayKey}`}
                    >
                      {dayItems.length ? (
                        dayItems.slice(0, view === "month" ? 3 : undefined).map((item) => (
                          <PlanningCard
                            key={`${item.kind}-${item.id}`}
                            item={item}
                            user={usersById.get(item.assignedUserId || "")}
                            showUser={Boolean(isAdmin)}
                            compact={view === "month"}
                            hasConflict={conflictingItemIds.has(
                              `${item.kind}:${item.id}`,
                            )}
                            onSelect={openEditor}
                          />
                        ))
                      ) : (
                        <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed text-center text-xs text-muted-foreground ${
                          view === "month" ? "min-h-16" : "min-h-28"
                        }`}>
                          <CalendarDays className="mb-2 h-5 w-5 opacity-40" />
                          Sem atividades
                        </div>
                      )}
                      {view === "month" && dayItems.length > 3 && (
                        <button
                          type="button"
                          className="w-full rounded-md py-1 text-xs font-semibold text-[#08715f] hover:bg-[#22C7A9]/10"
                          onClick={() => {
                            setAnchor(day);
                            setView("day");
                          }}
                          data-testid={`planning-more-${dayKey}`}
                        >
                          +{dayItems.length - 3} atividades
                        </button>
                      )}
                    </div>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          className={`mt-2 w-full shrink-0 border border-dashed text-muted-foreground hover:border-[#22C7A9] hover:text-[#08715f] ${
                            view === "month" ? "h-7 px-2" : "h-9"
                          }`}
                          aria-label={`Adicionar atividade em ${format(day, "d 'de' MMMM", { locale: pt })}`}
                          data-testid={`planning-add-${dayKey}`}
                        >
                          <Plus className={`h-4 w-4 ${view === "month" ? "" : "mr-1.5"}`} />
                          {view === "month" ? (
                            <span className="sr-only">Adicionar</span>
                          ) : (
                            "Adicionar"
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="center" className="w-52 p-2">
                        <div className="grid gap-1">
                          <Button
                            variant="ghost"
                            className="justify-start"
                            onClick={() =>
                              navigateFromPlanning("/visitas/nova", {
                                dataVisita: getPlanningDate(day).toISOString(),
                              })
                            }
                            data-testid={`planning-add-visit-${dayKey}`}
                          >
                            <CalendarPlus2 className="mr-2 h-4 w-4 text-[#08715f]" />
                            Nova visita
                          </Button>
                          <Button
                            variant="ghost"
                            className="justify-start"
                            onClick={() =>
                              navigateFromPlanning("/tarefas/nova", {
                                dueDate: getPlanningDate(day).toISOString(),
                              })
                            }
                            data-testid={`planning-add-task-${dayKey}`}
                          >
                            <ListTodo className="mr-2 h-4 w-4 text-amber-600" />
                            Nova tarefa
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </PlanningDayColumn>
                );
              })}
              </section>

              <section className="rounded-2xl border bg-card p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <MapPinned className="h-5 w-5 text-amber-600" />
                    Por planear
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tarefas sem data, prontas para colocar no calendário.
                  </p>
                </div>
                <Badge variant="secondary">{unplannedTasks.length}</Badge>
              </div>

              {unplannedTasks.length ? (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {unplannedTasks.map((item) => (
                    <PlanningCard
                      key={item.id}
                      item={item}
                      user={usersById.get(item.assignedUserId || "")}
                      showUser={Boolean(isAdmin)}
                      onSelect={openEditor}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-primary" />
                  Tudo tem uma data definida.
                </div>
              )}
              </section>
            </DndContext>
          </>
        )}
      </main>

      <Dialog
        open={Boolean(selectedItem)}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Organizar atividade</DialogTitle>
            <DialogDescription>
              {selectedItem?.kind === "visita" ? "Visita" : "Tarefa"}:{" "}
              {selectedItem?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="planning-date">Data e hora</Label>
              <Input
                id="planning-date"
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                data-testid="planning-edit-date"
              />
              {selectedItem?.kind === "tarefa" && (
                <button
                  type="button"
                  className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setScheduledAt("")}
                >
                  Retirar da agenda
                </button>
              )}
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                  <SelectTrigger data-testid="planning-edit-user">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedItem?.kind === "tarefa" && (
                      <SelectItem value="unassigned">Sem responsável</SelectItem>
                    )}
                    {planningContext?.users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {userName(user)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedItem?.entity && (
              <div className="rounded-xl bg-muted/60 p-3 text-sm">
                <p className="font-medium">{selectedItem.entity.nome}</p>
                {selectedItem.entity.cidade && (
                  <p className="text-muted-foreground">{selectedItem.entity.cidade}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                selectedItem &&
                navigateFromPlanning(
                  selectedItem.kind === "visita"
                    ? `/visitas/${selectedItem.id}`
                    : `/tarefas/${selectedItem.id}`,
                )
              }
            >
              Abrir detalhe
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={
                updateMutation.isPending ||
                (selectedItem?.kind === "visita" && !scheduledAt)
              }
              data-testid="planning-save-item"
            >
              {updateMutation.isPending ? "A guardar..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
