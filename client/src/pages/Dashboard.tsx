import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, Users, FileText, Package, Calendar, LogOut, BarChart, Link2, Download } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useToast } from "@/hooks/use-toast";
import type { VisitaWithRelations } from "@shared/schema";

interface DashboardStats {
  totalEntidades: number;
  totalContactos: number;
  totalVisitas: number;
  visitasEstesMes: number;
  marcasMaisEntregues: { marca: string; count: number }[];
  proximasVisitas: VisitaWithRelations[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

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
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Olá, {user?.firstName || user?.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/analytics")}
              data-testid="button-analytics"
            >
              <BarChart className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          </>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 text-center space-y-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-entidades">
                  {stats.totalEntidades}
                </p>
                <p className="text-xs text-muted-foreground">Entidades</p>
              </Card>

              <Card className="p-4 text-center space-y-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-contactos">
                  {stats.totalContactos}
                </p>
                <p className="text-xs text-muted-foreground">Contactos</p>
              </Card>

              <Card className="p-4 text-center space-y-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-visitas">
                  {stats.totalVisitas}
                </p>
                <p className="text-xs text-muted-foreground">Visitas Total</p>
              </Card>

              <Card className="p-4 text-center space-y-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-visitas-mes">
                  {stats.visitasEstesMes}
                </p>
                <p className="text-xs text-muted-foreground">Este Mês</p>
              </Card>
            </div>

            <Card 
              className="p-4 hover-elevate cursor-pointer" 
              onClick={() => setLocation("/integracoes/microsoft")}
              data-testid="card-microsoft-integration"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <Link2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Integração Microsoft 365</h3>
                  <p className="text-sm text-muted-foreground">
                    Ligue ao Planner, To-Do e Outlook Calendar
                  </p>
                </div>
                <div className="text-muted-foreground">→</div>
              </div>
            </Card>

            <Card data-testid="card-reports">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Relatórios PDF PRO
                </CardTitle>
                <CardDescription>Exporte relatórios detalhados com gráficos e análise IA</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadReport('monthly', 'agent')}
                    data-testid="button-report-monthly-agent"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Mensal
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadReport('weekly', 'agent')}
                    data-testid="button-report-weekly-agent"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Semanal
                  </Button>
                </div>
                {isAdmin && (
                  <>
                    <Separator />
                    <p className="text-sm text-muted-foreground">Relatórios da Empresa (Admin)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadReport('monthly', 'company')}
                        data-testid="button-report-monthly-company"
                      >
                        <Building2 className="h-4 w-4 mr-2" />
                        Mensal Empresa
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadReport('weekly', 'company')}
                        data-testid="button-report-weekly-company"
                      >
                        <BarChart className="h-4 w-4 mr-2" />
                        Semanal Empresa
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {stats.marcasMaisEntregues.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Marcas Mais Entregues</h2>
                <Card className="p-4">
                  <div className="space-y-3">
                    {stats.marcasMaisEntregues.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium text-foreground">{item.marca}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{item.count}x</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {stats.proximasVisitas.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Próximas Visitas</h2>
                <div className="space-y-2">
                  {stats.proximasVisitas.map((visita) => (
                    <Card key={visita.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{visita.gabinete?.nome}</p>
                          {visita.contacto && (
                            <p className="text-sm text-muted-foreground">{visita.contacto.nome}</p>
                          )}
                        </div>
                        {visita.proximaVisita && (
                          <div className="text-right">
                            <p className="text-sm font-medium text-primary">
                              {format(new Date(visita.proximaVisita), "d MMM", { locale: pt })}
                            </p>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
