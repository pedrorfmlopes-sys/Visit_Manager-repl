import { useQuery } from "@tanstack/react-query";
import { Building2, Users, FileText, CheckCircle2, Calendar, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { pt } from "date-fns/locale";
import type { VisitaWithRelations, Tarefa } from "@shared/schema";

interface DashboardStats {
  totalEntidades: number;
  totalContactos: number;
  totalVisitas: number;
  visitasEstesMes: number;
  marcasMaisEntregues: { marca: string; count: number }[];
  proximasVisitas: VisitaWithRelations[];
}

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
  });

  const { data: visitas, isLoading: visitasLoading } = useQuery<VisitaWithRelations[]>({
    queryKey: ["/api/visitas"],
  });

  const { data: tarefas, isLoading: tarefasLoading } = useQuery<Tarefa[]>({
    queryKey: ["/api/tarefas"],
  });

  // Calculate stats from data
  const today = new Date();
  const visitasHoje = visitas?.filter(v => {
    const visitaDate = new Date(v.dataVisita);
    return visitaDate.toDateString() === today.toDateString();
  }).length || 0;

  const visitasSemana = visitas?.filter(v => {
    const visitaDate = new Date(v.dataVisita);
    const weekStart = startOfWeek(today, { locale: pt });
    const weekEnd = endOfWeek(today, { locale: pt });
    return visitaDate >= weekStart && visitaDate <= weekEnd;
  }).length || 0;

  const tarefasPorConcluir = tarefas?.filter(t => t.status !== 'done').length || 0;
  const tarefasEmAtraso = tarefas?.filter(t => {
    return t.status !== 'done' && (t.dueDate ? new Date(t.dueDate) < today : false);
  }).length || 0;

  const isLoading = statsLoading || visitasLoading || tarefasLoading;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Admin</h1>
        <p className="text-muted-foreground mt-1">Visão geral da empresa</p>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Visitas Hoje</p>
                <p className="text-3xl font-bold text-foreground">{visitasHoje}</p>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Visitas Esta Semana</p>
                <p className="text-3xl font-bold text-foreground">{visitasSemana}</p>
              </div>
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Calendar className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tarefas Por Concluir</p>
                <p className="text-3xl font-bold text-foreground">{tarefasPorConcluir}</p>
              </div>
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-purple-500" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tarefas em Atraso</p>
                <p className="text-3xl font-bold text-foreground">{tarefasEmAtraso}</p>
              </div>
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Stats Summary */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Entidades</p>
                <p className="text-2xl font-bold text-foreground">{stats.totalEntidades}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Contactos</p>
                <p className="text-2xl font-bold text-foreground">{stats.totalContactos}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <FileText className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Visitas</p>
                <p className="text-2xl font-bold text-foreground">{stats.totalVisitas}</p>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Últimas Visitas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimas Visitas</CardTitle>
        </CardHeader>
        <CardContent>
          {visitasLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded" />
              ))}
            </div>
          ) : visitas && visitas.length > 0 ? (
            <div className="space-y-3">
              {visitas.slice(0, 10).map((visita) => (
                <div
                  key={visita.id}
                  className="flex items-start justify-between p-3 rounded-lg border border-border hover-elevate transition-colors"
                  data-testid={`visit-item-${visita.id}`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{visita.entidade?.nome || "Entidade"}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(visita.dataVisita), "dd MMM yyyy 'às' HH:mm", { locale: pt })}
                    </p>
                    {visita.notas && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">{visita.notas}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400">
                      Registada
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Nenhuma visita registada</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
