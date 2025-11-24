import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertCircle, CheckCircle2, Database, Settings } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

interface DebugInfo {
  appVersion: string;
  timestamp: string;
  database: { ok: boolean };
  stats: {
    usersActive: number;
    entidades: number;
    contactos: number;
    visitasTotal: number;
    visitasLast30Days: number;
    tarefasTotal: number;
    tarefasAtraso: number;
  };
  settings: {
    mostrarGPS: boolean;
    ia: {
      visitSummaryEnabled: boolean;
      taskSuggestionsEnabled: boolean;
      dashboardInsightsEnabled: boolean;
    };
  };
  integrations: {
    microsoft: string;
    google: string;
  };
}

export default function AdminDebug() {
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<DebugInfo>({
    queryKey: ["/api/admin/debug"],
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back-debug"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Debug / Ferramentas</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Estado da aplicação e configurações
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p>Erro ao carregar dados de debug</p>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-64" />
            <Skeleton className="h-40" />
          </>
        ) : data ? (
          <>
            {/* Estado da Aplicação */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Estado da Aplicação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Versão</span>
                  <Badge variant="outline">{data.appVersion}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Data/Hora Geração</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(data.timestamp).toLocaleString("pt-PT")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Base de Dados</span>
                  <Badge variant={data.database.ok ? "default" : "destructive"}>
                    {data.database.ok ? "✓ OK" : "✗ Erro"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Estatísticas da Empresa */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="h-5 w-5 text-primary" />
                  Estatísticas da Empresa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Utilizadores</p>
                    <p className="text-2xl font-bold">{data.stats.usersActive}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Entidades</p>
                    <p className="text-2xl font-bold">{data.stats.entidades}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Contactos</p>
                    <p className="text-2xl font-bold">{data.stats.contactos}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Visitas (Total)</p>
                    <p className="text-2xl font-bold">{data.stats.visitasTotal}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Visitas (30 dias)</p>
                    <p className="text-2xl font-bold">{data.stats.visitasLast30Days}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Tarefas (Total)</p>
                    <p className="text-2xl font-bold">{data.stats.tarefasTotal}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Tarefas em Atraso</p>
                    <p className="text-2xl font-bold text-amber-600">{data.stats.tarefasAtraso}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Configurações */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5 text-primary" />
                  Configurações Relevantes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Localização & Privacidade</p>
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm">Mostrar GPS</span>
                    <Badge variant={data.settings.mostrarGPS ? "default" : "outline"}>
                      {data.settings.mostrarGPS ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Inteligência Artificial</p>
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm">Resumo de Visitas</span>
                    <Badge variant={data.settings.ia.visitSummaryEnabled ? "default" : "outline"}>
                      {data.settings.ia.visitSummaryEnabled ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm">Sugestões de Tarefas</span>
                    <Badge variant={data.settings.ia.taskSuggestionsEnabled ? "default" : "outline"}>
                      {data.settings.ia.taskSuggestionsEnabled ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm">Insights Dashboard</span>
                    <Badge variant={data.settings.ia.dashboardInsightsEnabled ? "default" : "outline"}>
                      {data.settings.ia.dashboardInsightsEnabled ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Integrações */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Integrações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Microsoft (Outlook/Planner)</span>
                  <Badge variant="outline">{data.integrations.microsoft}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Google</span>
                  <Badge variant="outline">{data.integrations.google}</Badge>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
