import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Database,
  Settings,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

interface DebugInfo {
  appVersion?: string;
  timestamp?: string;
  database?: { ok?: boolean };
  stats?: {
    usersActive?: number;
    users?: number;
    entidades?: number;
    contactos?: number;
    visitasTotal?: number;
    visitas?: number;
    visitasLast30Days?: number;
    visitasLast30?: number;
    tarefasTotal?: number;
    tarefas?: number;
    tarefasAtraso?: number;
  };
  settings?: {
    mostrarGPS?: boolean;
    ia?: {
      visitSummaryEnabled?: boolean;
      taskSuggestionsEnabled?: boolean;
      dashboardInsightsEnabled?: boolean;
    };
  };
  integrations?: {
    microsoft?: string;
    google?: string;
  };
}

export default function AdminDebug() {
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<DebugInfo>({
    queryKey: ["/api/admin/debug"],
  });

  const normalized = data
    ? {
        appVersion: data.appVersion ?? "dev",
        timestamp: data.timestamp ?? new Date().toISOString(),
        databaseOk: data.database?.ok ?? true,
        usersActive: data.stats?.usersActive ?? data.stats?.users ?? 0,
        entidades: data.stats?.entidades ?? 0,
        contactos: data.stats?.contactos ?? 0,
        visitasTotal: data.stats?.visitasTotal ?? data.stats?.visitas ?? 0,
        visitasLast30Days:
          data.stats?.visitasLast30Days ?? data.stats?.visitasLast30 ?? 0,
        tarefasTotal: data.stats?.tarefasTotal ?? data.stats?.tarefas ?? 0,
        tarefasAtraso: data.stats?.tarefasAtraso ?? 0,
        mostrarGPS: data.settings?.mostrarGPS ?? false,
        visitSummaryEnabled: data.settings?.ia?.visitSummaryEnabled ?? false,
        taskSuggestionsEnabled:
          data.settings?.ia?.taskSuggestionsEnabled ?? false,
        dashboardInsightsEnabled:
          data.settings?.ia?.dashboardInsightsEnabled ?? false,
        microsoft: data.integrations?.microsoft ?? "Nao configurado",
        google: data.integrations?.google ?? "Nao configurado",
      }
    : null;

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
              <h1 className="text-xl font-semibold text-foreground">
                Debug / Ferramentas
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Estado da aplicacao e configuracoes
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
        ) : normalized ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Estado da Aplicacao
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Versao</span>
                  <Badge variant="outline">{normalized.appVersion}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Data/Hora Geracao</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(normalized.timestamp).toLocaleString("pt-PT")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Base de Dados</span>
                  <Badge
                    variant={normalized.databaseOk ? "default" : "destructive"}
                  >
                    {normalized.databaseOk ? "OK" : "Erro"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="h-5 w-5 text-primary" />
                  Estatisticas da Empresa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Utilizadores</p>
                    <p className="text-2xl font-bold">{normalized.usersActive}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Entidades</p>
                    <p className="text-2xl font-bold">{normalized.entidades}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Contactos</p>
                    <p className="text-2xl font-bold">{normalized.contactos}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Visitas (Total)</p>
                    <p className="text-2xl font-bold">{normalized.visitasTotal}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Visitas (30 dias)</p>
                    <p className="text-2xl font-bold">{normalized.visitasLast30Days}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Tarefas (Total)</p>
                    <p className="text-2xl font-bold">{normalized.tarefasTotal}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Tarefas em Atraso</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {normalized.tarefasAtraso}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5 text-primary" />
                  Configuracoes Relevantes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Localizacao e Privacidade</p>
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm">Mostrar GPS</span>
                    <Badge
                      variant={normalized.mostrarGPS ? "default" : "outline"}
                    >
                      {normalized.mostrarGPS ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Inteligencia Artificial</p>
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm">Resumo de Visitas</span>
                    <Badge
                      variant={
                        normalized.visitSummaryEnabled ? "default" : "outline"
                      }
                    >
                      {normalized.visitSummaryEnabled ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm">Sugestoes de Tarefas</span>
                    <Badge
                      variant={
                        normalized.taskSuggestionsEnabled ? "default" : "outline"
                      }
                    >
                      {normalized.taskSuggestionsEnabled ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between pl-4">
                    <span className="text-sm">Insights Dashboard</span>
                    <Badge
                      variant={
                        normalized.dashboardInsightsEnabled
                          ? "default"
                          : "outline"
                      }
                    >
                      {normalized.dashboardInsightsEnabled ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Integracoes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Microsoft (Outlook/Planner)
                  </span>
                  <Badge variant="outline">{normalized.microsoft}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Google</span>
                  <Badge variant="outline">{normalized.google}</Badge>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
