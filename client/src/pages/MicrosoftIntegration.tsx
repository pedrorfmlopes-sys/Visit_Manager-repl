import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, Link2, Unlink } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface MicrosoftStatus {
  connected: boolean;
  scopes?: string[];
  expiresAt?: string;
}

export default function MicrosoftIntegration() {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: status, isLoading } = useQuery<MicrosoftStatus>({
    queryKey: ['/api/microsoft/auth/status'],
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/microsoft/auth/disconnect', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/microsoft/auth/status'] });
      toast({
        title: 'Conta desligada',
        description: 'A sua conta Microsoft foi desligada com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível desligar a conta Microsoft.',
        variant: 'destructive',
      });
    },
  });

  const handleConnect = () => {
    setIsConnecting(true);
    window.location.href = '/api/microsoft/auth/login';
  };

  const handleDisconnect = () => {
    if (confirm('Tem a certeza que deseja desligar a sua conta Microsoft? Isto irá remover o acesso ao To-Do e Planner.')) {
      disconnectMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConnected = status?.connected ?? false;

  return (
    <div className="container max-w-4xl py-8 px-4">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integração Microsoft 365</h1>
          <p className="text-muted-foreground mt-2">
            Ligue a sua conta Microsoft para exportar tarefas para o To-Do (e opcionalmente para o Planner).
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Estado da Ligação
                  {isConnected ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" data-testid="icon-connected" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" data-testid="icon-disconnected" />
                  )}
                </CardTitle>
                <CardDescription className="mt-2">
                  {isConnected
                    ? 'A sua conta Microsoft está ligada e pronta para usar.'
                    : 'Ligue a sua conta Microsoft para aceder às funcionalidades de integração.'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium">Permissões concedidas:</span>
                    <ul className="list-disc list-inside mt-1 text-muted-foreground">
                      <li>Microsoft To-Do (leitura e escrita)</li>
                      <li>Perfil de utilizador (leitura)</li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-2">
                      Nota: O acesso ao Planner requer permissões adicionais que podem não estar disponíveis para todas as contas.
                    </p>
                  </div>
                  {status?.expiresAt && (
                    <p className="text-sm text-muted-foreground">
                      Token expira em: {format(new Date(status.expiresAt), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt })}
                    </p>
                  )}
                </div>
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                  data-testid="button-disconnect"
                >
                  {disconnectMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      A desligar...
                    </>
                  ) : (
                    <>
                      <Unlink className="mr-2 h-4 w-4" />
                      Desligar Conta Microsoft
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                data-testid="button-connect"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A redirecionar...
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Ligar Conta Microsoft
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funcionalidades Disponíveis</CardTitle>
            <CardDescription>
              O que pode fazer com a integração Microsoft 365
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <span className="text-lg">✓</span>
                </div>
                <div>
                  <h3 className="font-medium">Exportar Tarefas para o To-Do (Principal)</h3>
                  <p className="text-sm text-muted-foreground">
                    Crie rapidamente tarefas no Microsoft To-Do com um clique, incluindo data de vencimento e categorias. Funciona para todas as contas Microsoft.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <span className="text-lg">📋</span>
                </div>
                <div>
                  <h3 className="font-medium">Exportar Tarefas para o Planner (Opcional)</h3>
                  <p className="text-sm text-muted-foreground">
                    Sincronize as suas tarefas com o Microsoft Planner. Escolha o grupo, plano e bucket de destino. Requer permissões adicionais que podem não estar disponíveis para todas as contas.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacidade e Segurança</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Os seus tokens de acesso Microsoft são armazenados de forma segura e encriptados. Só você tem acesso à sua conta Microsoft.
            </p>
            <p>
              A aplicação apenas solicita as permissões necessárias para as funcionalidades descritas acima.
            </p>
            <p>
              Pode desligar a sua conta Microsoft a qualquer momento. Isto irá remover o acesso imediatamente.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
