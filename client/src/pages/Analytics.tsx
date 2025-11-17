import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, CheckCircle2, AlertCircle, Building2, TrendingUp, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', 'hsl(var(--destructive))'];

export default function Analytics() {
  const isOnline = useOnlineStatus();
  const isAdmin = useIsAdmin();
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<string>("30");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [selectedEntityType, setSelectedEntityType] = useState<string>("all");

  // Build query params
  const params: Record<string, string> = {
    period: period,
  };

  // Only add agent filter if admin and not "all"
  if (isAdmin && selectedAgent && selectedAgent !== "all") {
    params.agente = selectedAgent;
  }

  // Only add entity type filter if not "all"
  if (selectedEntityType && selectedEntityType !== "all") {
    params.tipoEntidade = selectedEntityType;
  }

  const queryParams = new URLSearchParams(params);
  const analyticsUrl = `/api/analytics?${queryParams.toString()}`;

  const { data: analytics, isLoading, error } = useQuery({
    queryKey: [analyticsUrl],
    enabled: isOnline,
  });

  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    enabled: isAdmin && isOnline,
  });

  // Show offline message when not connected
  if (!isOnline) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            O Dashboard requer ligação à internet.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show loading skeletons
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
          <div className="flex items-center gap-3 max-w-7xl mx-auto">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Analytics</h1>
          </div>
        </header>
        <div className="p-4 space-y-4 max-w-7xl mx-auto">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            {isAdmin && <Skeleton className="h-10 w-48" />}
            <Skeleton className="h-10 w-48" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar analytics. Tente novamente mais tarde.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!analytics) return null;

  const { visits, tasks, entities, brands } = analytics;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="flex flex-col gap-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Analytics</h1>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {/* Period filter */}
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]" data-testid="filter-period">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
                <SelectItem value="365">1 ano</SelectItem>
              </SelectContent>
            </Select>

            {/* Agent filter (admin only) */}
            {isAdmin && users && (
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-[180px]" data-testid="filter-agent">
                  <SelectValue placeholder="Todos os agentes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os agentes</SelectItem>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Entity type filter */}
            <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
              <SelectTrigger className="w-[180px]" data-testid="filter-entity-type">
                <SelectValue placeholder="Tipo de entidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="Gabinete">Gabinete</SelectItem>
                <SelectItem value="Distribuidor">Distribuidor</SelectItem>
                <SelectItem value="Parceiro">Parceiro</SelectItem>
                <SelectItem value="Construtor">Construtor</SelectItem>
                <SelectItem value="Contato Pessoal">Contato Pessoal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6 max-w-7xl mx-auto">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card data-testid="kpi-total-visits">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Visitas</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{visits.total_visits}</div>
            </CardContent>
          </Card>

          <Card data-testid="kpi-visits-7-days">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Visitas (7 dias)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{visits.visits_last_7_days}</div>
            </CardContent>
          </Card>

          <Card data-testid="kpi-tasks-pending">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tarefas Pendentes</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasks.tasks_pending}</div>
            </CardContent>
          </Card>

          <Card data-testid="kpi-tasks-overdue">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tarefas Atrasadas</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{tasks.tasks_overdue}</div>
            </CardContent>
          </Card>

          <Card data-testid="kpi-total-entities">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Entidades</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{entities.entities_by_type.reduce((sum, e) => sum + e.count, 0)}</div>
            </CardContent>
          </Card>

          <Card data-testid="kpi-new-entities-30-days">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entidades Novas (30 dias)</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{entities.entities_created_last_30_days}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Visits by Month */}
          <Card>
            <CardHeader>
              <CardTitle>Visitas por Mês</CardTitle>
            </CardHeader>
            <CardContent>
              {visits.visits_by_month.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={visits.visits_by_month}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Sem dados disponíveis
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visits by Agent */}
          <Card>
            <CardHeader>
              <CardTitle>Visitas por Agente</CardTitle>
            </CardHeader>
            <CardContent>
              {visits.visits_by_agent.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={visits.visits_by_agent} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="agent" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--secondary))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Sem dados disponíveis
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visits by Entity Type */}
          <Card>
            <CardHeader>
              <CardTitle>Visitas por Tipo de Entidade</CardTitle>
            </CardHeader>
            <CardContent>
              {visits.visits_by_entity_type.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={visits.visits_by_entity_type}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.tipo}: ${entry.count}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {visits.visits_by_entity_type.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Sem dados disponíveis
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tasks by Status */}
          <Card>
            <CardHeader>
              <CardTitle>Tarefas por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.tasks_by_status.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={tasks.tasks_by_status}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.status}: ${entry.count}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {tasks.tasks_by_status.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Sem dados disponíveis
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tasks by Agent */}
          <Card>
            <CardHeader>
              <CardTitle>Tarefas por Agente</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.tasks_by_agent.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tasks.tasks_by_agent} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="agent" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--accent))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Sem dados disponíveis
                </div>
              )}
            </CardContent>
          </Card>

          {/* Brands Top 10 */}
          <Card>
            <CardHeader>
              <CardTitle>Marcas Entregues — Top 10</CardTitle>
            </CardHeader>
            <CardContent>
              {brands.brand_frequency.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={brands.brand_frequency} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="marca" type="category" width={80} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Sem dados disponíveis
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
