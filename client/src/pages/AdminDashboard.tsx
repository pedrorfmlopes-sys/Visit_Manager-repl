import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Users, FileText, CheckCircle2, Calendar, AlertCircle, Zap, TrendingUp, ArrowRight, Download } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { format, startOfWeek, endOfWeek, subDays } from "date-fns";
import { pt } from "date-fns/locale";
import { AlertRibbon } from "@/components/AlertRibbon";
import { DashboardInsightsCard } from "@/components/DashboardInsightsCard";
import type { VisitaWithRelations, Tarefa } from "@shared/schema";

interface DashboardStats {
  totalEntidades: number;
  totalContactos: number;
  totalVisitas: number;
  visitasEstesMes: number;
  marcasMaisEntregues: { marca: string; count: number }[];
  proximasVisitas: VisitaWithRelations[];
}

interface KeyClient {
  entidadeId: string;
  nome: string;
  visitCount: number;
  lastVisitDate?: string;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const isDev = import.meta.env.DEV;

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
  });

  const { data: visitas, isLoading: visitasLoading } = useQuery<VisitaWithRelations[]>({
    queryKey: ["/api/visitas"],
  });

  const { data: tarefas, isLoading: tarefasLoading } = useQuery<Tarefa[]>({
    queryKey: ["/api/tarefas"],
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/dev/toggle-role", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to toggle role");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sucesso",
        description: `Role alterado para: ${data.role}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao mudar role. Apenas disponível em desenvolvimento.",
        variant: "destructive",
      });
    },
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

  // Get visitas desta semana
  const weekStart = startOfWeek(today, { locale: pt });
  const weekEnd = endOfWeek(today, { locale: pt });
  const visitasEsteSemanaSorted = visitas?.filter(v => {
    const visitaDate = new Date(v.dataVisita);
    return visitaDate >= weekStart && visitaDate <= weekEnd;
  }).sort((a, b) => new Date(b.dataVisita).getTime() - new Date(a.dataVisita).getTime()) || [];

  // Get tarefas em atraso
  const tarefasEmAtrasoList = tarefas?.filter(t => {
    return t.status !== 'done' && (t.dueDate ? new Date(t.dueDate) < today : false);
  }).sort((a, b) => {
    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return dateA - dateB;
  }) || [];

  // Calculate key clients (top entities by visit count in last 30 days)
  const thirtyDaysAgo = subDays(today, 30);
  const visitas30Days = visitas?.filter(v => {
    const visitaDate = new Date(v.dataVisita);
    return visitaDate >= thirtyDaysAgo && visitaDate <= today;
  }) || [];

  const keyClientMap = new Map<string, { nome: string; count: number; lastDate: Date }>();
  visitas30Days.forEach(v => {
    if (v.entidadeId && v.entidade) {
      const existing = keyClientMap.get(v.entidadeId);
      const visitDate = new Date(v.dataVisita);
      if (existing) {
        existing.count += 1;
        if (visitDate > existing.lastDate) {
          existing.lastDate = visitDate;
        }
      } else {
        keyClientMap.set(v.entidadeId, {
          nome: v.entidade.nome,
          count: 1,
          lastDate: visitDate,
        });
      }
    }
  });

  const keyClients = Array.from(keyClientMap.entries())
    .map(([id, data]) => ({
      entidadeId: id,
      nome: data.nome,
      visitCount: data.count,
      lastVisitDate: format(data.lastDate, "dd MMM yyyy", { locale: pt }),
    }))
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, 5);

  const isLoading = statsLoading || visitasLoading || tarefasLoading;

  const handleDownloadReport = async (reportType: 'monthly' | 'weekly', scope: 'agent' | 'company') => {
    try {
      const response = await fetch(`/api/pdf/reports/${reportType}/${scope}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = `Relatorio-${reportType === 'monthly' ? 'Mensal' : 'Semanal'}-${scope === 'company' ? 'Empresa' : 'Pessoal'}-${new Date().toISOString().split('T')[0]}.pdf`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Relatório Exportado",
        description: "PDF descarregado com sucesso!",
      });
    } catch (error) {
      console.error('Error downloading report:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar relatório. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard Admin</h1>
          <p className="text-muted-foreground mt-1">Visão geral da empresa</p>
        </div>
        {isDev && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleRoleMutation.mutate()}
            disabled={toggleRoleMutation.isPending}
            data-testid="button-toggle-role-admin"
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            {toggleRoleMutation.isPending ? "..." : `Dev: Mudar para ${user?.role === "admin" ? "agent" : "admin"}`}
          </Button>
        )}
      </div>

      {/* Alert Ribbon - between title and KPI cards */}
      <AlertRibbon />

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

      {/* CRM Cards Section */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-80 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Visitas desta semana */}
          <Card 
            className="cursor-pointer hover-elevate transition-all"
            onClick={() => {
              const from = format(weekStart, "yyyy-MM-dd");
              const to = format(weekEnd, "yyyy-MM-dd");
              setLocation(`/visitas?from=${from}&to=${to}`);
            }}
            data-testid="card-visitas-semana"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Visitas desta semana</CardTitle>
                <Calendar className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-foreground mt-2">{visitasSemana}</p>
            </CardHeader>
            <CardContent>
              {visitasEsteSemanaSorted.length > 0 ? (
                <div className="space-y-2">
                  {visitasEsteSemanaSorted.slice(0, 5).map((visita) => (
                    <div
                      key={visita.id}
                      className="flex items-start justify-between text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{visita.entidade?.nome || "Entidade"}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(visita.dataVisita), "dd MMM HH:mm", { locale: pt })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {visitasEsteSemanaSorted.length > 5 && (
                    <p className="text-xs text-muted-foreground pt-2">+{visitasEsteSemanaSorted.length - 5} mais</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma visita esta semana</p>
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Click para ver todas</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          {/* Tarefas em atraso */}
          <Card 
            className="cursor-pointer hover-elevate transition-all"
            onClick={() => {
              setLocation("/tarefas?overdue=true");
            }}
            data-testid="card-tarefas-atraso"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Tarefas em atraso</CardTitle>
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <p className="text-2xl font-bold text-foreground mt-2">{tarefasEmAtraso}</p>
            </CardHeader>
            <CardContent>
              {tarefasEmAtrasoList.length > 0 ? (
                <div className="space-y-2">
                  {tarefasEmAtrasoList.slice(0, 5).map((tarefa) => (
                    <div
                      key={tarefa.id}
                      className="flex items-start justify-between text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{tarefa.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {tarefa.dueDate && format(new Date(tarefa.dueDate), "dd MMM yyyy", { locale: pt })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {tarefasEmAtrasoList.length > 5 && (
                    <p className="text-xs text-muted-foreground pt-2">+{tarefasEmAtrasoList.length - 5} mais</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma tarefa em atraso</p>
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Click para ver todas</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          {/* Clientes chave */}
          <Card 
            className="cursor-pointer hover-elevate transition-all lg:col-span-2"
            data-testid="card-clientes-chave"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Clientes chave (últimos 30 dias)</CardTitle>
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              {keyClients.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {keyClients.map((client, idx) => (
                    <div
                      key={client.entidadeId}
                      className="p-3 rounded-lg border border-border hover-elevate cursor-pointer"
                      onClick={() => {
                        setLocation(`/visitas?entidadeId=${client.entidadeId}`);
                      }}
                      data-testid={`client-card-${idx}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">{client.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {client.lastVisitDate}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">{client.visitCount}</p>
                          <p className="text-xs text-muted-foreground">visitas</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma visita nos últimos 30 dias</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary Stats */}
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

      {/* IA Insights */}
      <DashboardInsightsCard />

      {/* PDF Reports - FINAL */}
      <Card data-testid="card-reports" className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-primary" />
            Exportar Relatórios PDF
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Button
              variant="default"
              onClick={() => handleDownloadReport('monthly', 'agent')}
              data-testid="button-report-monthly-agent"
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Mensal Pessoal
            </Button>
            <Button
              variant="default"
              onClick={() => handleDownloadReport('weekly', 'agent')}
              data-testid="button-report-weekly-agent"
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Semanal Pessoal
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDownloadReport('monthly', 'company')}
              data-testid="button-report-monthly-company"
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Mensal Empresa
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDownloadReport('weekly', 'company')}
              data-testid="button-report-weekly-company"
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Semanal Empresa
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
