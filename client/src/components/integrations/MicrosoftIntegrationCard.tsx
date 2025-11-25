import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlugZap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MicrosoftStatus {
  connected: boolean;
  email?: string;
  displayName?: string;
  msAccountId?: string;
}

export function MicrosoftIntegrationCard() {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);

  // Query para obter o estado da ligação
  const { data, isLoading, error, refetch } = useQuery<MicrosoftStatus>({
    queryKey: ["/api/integrations/microsoft/status"],
    gcTime: 0, // Desativa cache para forçar fetch sempre que montar
  });

  // Feedback via querystring
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const msParam = params.get("ms");

    if (msParam === "connected") {
      toast({
        title: "Conta Microsoft ligada",
        description: "A conta Microsoft 365 foi ligada com sucesso.",
      });
      // Limpar parâmetro da URL
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    } else if (msParam === "error") {
      toast({
        title: "Erro na ligação",
        description: "Ocorreu um erro ao ligar a conta Microsoft. Tente novamente.",
        variant: "destructive",
      });
      // Limpar parâmetro da URL
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [toast]);

  const handleConnect = () => {
    setIsConnecting(true);
    window.location.href = "/api/integrations/microsoft/login";
  };

  const handleRetry = () => {
    refetch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlugZap className="w-5 h-5 text-blue-700" />
          Microsoft 365
        </CardTitle>
        <CardDescription>
          Ligue a sua conta Microsoft 365 para sincronizar visitas com o Outlook Calendar (no futuro também Planner e Contactos).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            A verificar ligação...
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Não foi possível obter o estado da ligação Microsoft.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              data-testid="button-retry-microsoft-status"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Disconnected State */}
        {!isLoading && !error && data?.connected === false && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Nenhuma conta Microsoft ligada para este utilizador.
            </p>
            <Button
              type="button"
              onClick={handleConnect}
              disabled={isConnecting}
              data-testid="button-connect-microsoft"
              className="gap-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  A ligar...
                </>
              ) : (
                "Ligar conta Microsoft"
              )}
            </Button>
          </div>
        )}

        {/* Connected State */}
        {!isLoading && !error && data?.connected === true && (
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm">
                  Ligado como: <span className="font-medium">{data.displayName || data.email}</span>
                </p>
                {data.email && (
                  <p className="text-xs text-muted-foreground">{data.email}</p>
                )}
              </div>
              <Badge variant="default" className="bg-green-600">
                Ligado
              </Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleConnect}
              disabled={isConnecting}
              data-testid="button-reconnect-microsoft"
            >
              {isConnecting ? "A ligar..." : "Religar / trocar conta"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
