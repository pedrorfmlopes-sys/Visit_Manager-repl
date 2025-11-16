import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, Building2, Calendar, Target, Users, MapPin } from "lucide-react";
import { useLocation } from "wouter";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, isWithinInterval } from "date-fns";
import { pt } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { VisitaWithRelations, Gabinete } from "@shared/schema";

interface DashboardStats {
  totalVisitas: number;
  totalGabinetes: number;
  visitasEsteMes: number;
  proximasVisitas: number;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Analytics() {
  const [, setLocation] = useLocation();

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
  });

  const { data: visitas = [] } = useQuery<VisitaWithRelations[]>({
    queryKey: ["/api/visitas"],
  });

  const { data: gabinetes = [] } = useQuery<Gabinete[]>({
    queryKey: ["/api/gabinetes"],
  });

  // Calculate visit trends over last 6 months
  const calculateVisitTrends = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      
      const visitasNoMes = visitas.filter(v => 
        isWithinInterval(new Date(v.dataVisita), { start, end })
      ).length;

      months.push({
        mes: format(monthDate, "MMM", { locale: pt }),
        visitas: visitasNoMes,
      });
    }
    return months;
  };

  // Top offices by visit count
  const calculateTopOffices = () => {
    const officeCounts = new Map<string, { nome: string; count: number }>();
    
    visitas.forEach(v => {
      if (v.gabinete && v.gabineteId) {
        const current = officeCounts.get(v.gabineteId) || { nome: v.gabinete.nome || 'Desconhecido', count: 0 };
        current.count++;
        officeCounts.set(v.gabineteId, current);
      }
    });

    return Array.from(officeCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  // Visit distribution by day of week
  const calculateVisitsByWeekday = () => {
    const weekdayCounts = {
      Dom: 0,
      Seg: 0,
      Ter: 0,
      Qua: 0,
      Qui: 0,
      Sex: 0,
      Sáb: 0,
    };

    visitas.forEach(v => {
      const dayName = format(new Date(v.dataVisita), "EEE", { locale: pt });
      const shortDay = dayName.slice(0, 3);
      if (shortDay in weekdayCounts) {
        weekdayCounts[shortDay as keyof typeof weekdayCounts]++;
      }
    });

    return Object.entries(weekdayCounts).map(([dia, visitas]) => ({ dia, visitas }));
  };

  // Visit frequency distribution (unique offices visited)
  const calculateVisitFrequency = () => {
    const officeCounts = new Map<string, number>();
    
    visitas.forEach(v => {
      if (v.gabineteId) {
        officeCounts.set(v.gabineteId, (officeCounts.get(v.gabineteId) || 0) + 1);
      }
    });

    const onceOnly = Array.from(officeCounts.values()).filter(count => count === 1).length;
    const multiple = Array.from(officeCounts.values()).filter(count => count > 1).length;
    
    return [
      { nome: "Visita Única", valor: onceOnly },
      { nome: "Visitas Múltiplas", valor: multiple },
    ];
  };

  // Calculate average visits per month
  const calculateAverageVisitsPerMonth = () => {
    if (visitas.length === 0) return 0;
    
    const oldest = new Date(Math.min(...visitas.map(v => new Date(v.dataVisita).getTime())));
    const monthsDiff = Math.max(1, (Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    return (visitas.length / monthsDiff).toFixed(1);
  };

  // Calculate visits with GPS
  const calculateGPSUsage = () => {
    const withGPS = visitas.filter(v => v.latitude && v.longitude).length;
    const withoutGPS = visitas.length - withGPS;
    
    return [
      { nome: "Com GPS", valor: withGPS },
      { nome: "Sem GPS", valor: withoutGPS },
    ];
  };

  const visitTrends = calculateVisitTrends();
  const topOffices = calculateTopOffices();
  const visitsByWeekday = calculateVisitsByWeekday();
  const visitFrequency = calculateVisitFrequency();
  const averageVisits = calculateAverageVisitsPerMonth();
  const gpsUsage = calculateGPSUsage();
  const uniqueOfficesVisited = new Set(visitas.filter(v => v.gabineteId).map(v => v.gabineteId)).size;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Analytics Avançado</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Visitas</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalVisitas || 0}</div>
              <p className="text-xs text-muted-foreground">
                Média: {averageVisits}/mês
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gabinetes Visitados</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueOfficesVisited}</div>
              <p className="text-xs text-muted-foreground">
                gabinetes únicos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Visitas Este Mês</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.visitasEsteMes || 0}</div>
              <p className="text-xs text-muted-foreground">
                {visitTrends[visitTrends.length - 1]?.mes}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próximas Visitas</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.proximasVisitas || 0}</div>
              <p className="text-xs text-muted-foreground">
                Agendadas
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="trends" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trends" data-testid="tab-trends">Tendências</TabsTrigger>
            <TabsTrigger value="distribution" data-testid="tab-distribution">Distribuição</TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Evolução de Visitas (Últimos 6 Meses)</CardTitle>
                <CardDescription>
                  Tendência do número de visitas realizadas ao longo do tempo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={visitTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="mes" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="visitas" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top 5 Gabinetes por Visitas</CardTitle>
                <CardDescription>
                  Gabinetes com maior número de visitas registadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topOffices} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      type="number" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      dataKey="nome" 
                      type="category" 
                      width={150}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Visitas por Dia da Semana</CardTitle>
                  <CardDescription>
                    Distribuição de visitas pelos dias da semana
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={visitsByWeekday}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="dia" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                      />
                      <Bar dataKey="visitas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Frequência de Visitas</CardTitle>
                  <CardDescription>
                    Gabinetes por número de visitas realizadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={visitFrequency}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ nome, valor, percent }) => 
                          `${nome}: ${valor} (${(percent * 100).toFixed(0)}%)`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="valor"
                      >
                        {visitFrequency.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Utilização de GPS
                  </CardTitle>
                  <CardDescription>
                    Visitas com localização GPS capturada
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={gpsUsage}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ nome, valor, percent }) => 
                          `${nome}: ${valor} (${(percent * 100).toFixed(0)}%)`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="valor"
                      >
                        {gpsUsage.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index + 2]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Métricas de Performance</CardTitle>
                  <CardDescription>
                    Indicadores de eficiência operacional
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Média de Visitas/Mês</span>
                    <Badge variant="secondary" className="text-base">{averageVisits}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Gabinetes Únicos</span>
                    <Badge variant="secondary" className="text-base">
                      {uniqueOfficesVisited}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Visitas com GPS</span>
                    <Badge variant="secondary" className="text-base">
                      {visitas.length > 0 
                        ? ((gpsUsage[0].valor / visitas.length) * 100).toFixed(0)
                        : 0}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Próximas Agendadas</span>
                    <Badge variant="secondary" className="text-base">{stats?.proximasVisitas || 0}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
