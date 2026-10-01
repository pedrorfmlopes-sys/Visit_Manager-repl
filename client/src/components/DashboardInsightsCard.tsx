import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, RotateCcw } from "lucide-react";

interface DashboardInsightsResponse {
  scope: 'agent' | 'admin';
  period: {
    from: string;
    to: string;
  };
  metrics: {
    visitasRealizadas: number;
    visitasAgendadas: number;
    tarefasCriadas: number;
    tarefasConcluidas: number;
    tarefasEmAtraso: number;
    clientesChave: Array<{ nome: string; visitCount: number }>;
    marcasMaisTrabalhadas: Array<{ marca: string; count: number }>;
  };
  insightsText: string;
}

export function DashboardInsightsCard() {
  const { data, isLoading, error, refetch } = useQuery<DashboardInsightsResponse>({
    queryKey: ['/api/dashboard/insights'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card data-testid="card-insights-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Carregando insights...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card data-testid="card-insights-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-600">
            <Lightbulb className="h-5 w-5" />
            Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar os insights neste momento. Tenta novamente mais tarde.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isInsightsDisabled = data.insightsText.includes("desativados");

  return (
    <Card data-testid="card-insights" className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            {data.scope === 'agent' ? 'Recomendações para ti' : 'Insights da empresa'}
            <span className="text-xs text-muted-foreground ml-auto font-normal">
              (últimos 30 dias)
            </span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isInsightsDisabled ? (
          <p className="text-sm text-muted-foreground">{data.insightsText}</p>
        ) : (
          <>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {data.insightsText}
              </div>
            </div>
            <div className="text-xs text-muted-foreground pt-2 border-t">
              Gerado automaticamente com base nas visitas e tarefas dos últimos 30 dias.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              data-testid="button-insights-refresh"
              className="w-full"
            >
              <RotateCcw className="h-3 w-3 mr-2" />
              Regenerar insights
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
