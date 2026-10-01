import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Link2, Unlink, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type MicrosoftStatus = {
  connected: boolean;
  oauthConfigured: boolean;
  email?: string;
  displayName?: string;
  msAccountId?: string;
  message?: string;
};

export default function MicrosoftIntegration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: status, isLoading } = useQuery<MicrosoftStatus>({
    queryKey: ["/api/integrations/microsoft/status"],
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/integrations/microsoft/disconnect", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json?.message || "Failed to disconnect");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/integrations/microsoft/status"],
      });
      toast({
        title: "Conta desligada",
        description: "A ligação Microsoft foi removida.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível desligar a conta Microsoft.",
        variant: "destructive",
      });
    },
  });

  const handleConnect = () => {
    window.location.href = "/api/integrations/microsoft/login";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConnected = status?.connected ?? false;
  const oauthConfigured = status?.oauthConfigured ?? false;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Integração Microsoft 365</h1>
          <p className="text-sm text-muted-foreground">
            Liga a tua conta Microsoft para usar Outlook Calendar e tarefas Microsoft.
          </p>
        </div>
      </div>

      <Card data-testid="card-microsoft-integration-page">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Estado da Ligação
            {isConnected ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
          </CardTitle>
          <CardDescription>
            {isConnected
              ? "A conta Microsoft está ligada e pronta a usar."
              : "Liga a tua conta Microsoft para ativar integrações pessoais."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!oauthConfigured && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              As credenciais OAuth da Microsoft não estão configuradas neste ambiente.
            </div>
          )}

          {isConnected ? (
            <div className="space-y-4">
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">Conta:</span>{" "}
                  {status?.displayName || status?.email || status?.msAccountId || "Ligada"}
                </p>
                {status?.email && (
                  <p>
                    <span className="font-medium">Email:</span> {status.email}
                  </p>
                )}
              </div>

              <Button
                variant="destructive"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                data-testid="button-disconnect-microsoft"
              >
                {disconnectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A desligar...
                  </>
                ) : (
                  <>
                    <Unlink className="mr-2 h-4 w-4" />
                    Desligar conta Microsoft
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={!oauthConfigured}
              data-testid="button-connect-microsoft"
            >
              <Link2 className="mr-2 h-4 w-4" />
              Ligar conta Microsoft
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
