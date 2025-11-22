import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, Link2, Unlink, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface MicrosoftStatus {
  connected: boolean;
  scopes?: string[];
  expiresAt?: string;
}

interface DeviceFlowResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  pollInterval: number;
}

export default function MicrosoftIntegration() {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showAuthOptions, setShowAuthOptions] = useState(false);
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowResponse | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

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

  const handleConnectOAuth = () => {
    setIsConnecting(true);
    window.location.href = '/api/microsoft/auth/login';
  };

  const handleConnectDeviceFlow = async () => {
    try {
      setIsConnecting(true);
      const response = await fetch('/api/microsoft/auth/device-flow/start', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to start device flow');

      const data: DeviceFlowResponse = await response.json();
      setDeviceFlow(data);

      startPolling(data.deviceCode, data.pollInterval);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível iniciar o Device Flow.',
        variant: 'destructive',
      });
      setIsConnecting(false);
    }
  };

  const startPolling = (deviceCode: string, interval: number) => {
    if (pollInterval) clearInterval(pollInterval);

    const newInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/microsoft/auth/device-flow/poll/${deviceCode}`, {
          credentials: 'include',
        });

        if (response.ok) {
          clearInterval(newInterval);
          setPollInterval(null);
          setDeviceFlow(null);
          setIsConnecting(false);
          setShowAuthOptions(false);
          queryClient.invalidateQueries({ queryKey: ['/api/microsoft/auth/status'] });
          toast({
            title: 'Sucesso',
            description: 'Conta Microsoft ligada com sucesso!',
          });
        } else if (response.status === 400) {
          return;
        } else if (response.status === 410) {
          clearInterval(newInterval);
          setPollInterval(null);
          setDeviceFlow(null);
          setIsConnecting(false);
          toast({
            title: 'Expirado',
            description: 'Código expirou. Tente novamente.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, interval * 1000);

    setPollInterval(newInterval as any);
  };

  const handleCopyCode = () => {
    if (deviceFlow) {
      navigator.clipboard.writeText(deviceFlow.userCode);
      toast({
        title: 'Copiado',
        description: 'Código copiado para a área de transferência.',
      });
    }
  };

  const handleDisconnect = () => {
    if (confirm('Tem a certeza que deseja desligar a sua conta Microsoft? Isto irá remover o acesso ao To-Do e Planner.')) {
      disconnectMutation.mutate();
    }
  };

  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

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
              <>
                <Button
                  onClick={() => setShowAuthOptions(true)}
                  disabled={isConnecting}
                  data-testid="button-connect"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      A processar...
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" />
                      Ligar Conta Microsoft
                    </>
                  )}
                </Button>

                {deviceFlow && (
                  <div className="mt-4 p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <h3 className="font-medium mb-3">Código de Autorização</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Copie o código abaixo e visite {' '}
                      <a 
                        href={deviceFlow.verificationUri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {deviceFlow.verificationUri}
                      </a>
                    </p>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-white dark:bg-slate-900 p-3 rounded border text-center font-mono text-2xl font-bold tracking-widest">
                        {deviceFlow.userCode}
                      </div>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={handleCopyCode}
                        data-testid="button-copy-code"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      À espera de autorização... (expira em {deviceFlow.expiresIn}s)
                    </p>
                  </div>
                )}
              </>
            )}

            <AlertDialog open={showAuthOptions} onOpenChange={setShowAuthOptions}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Escolha o método de autenticação</AlertDialogTitle>
                  <AlertDialogDescription>
                    Selecione como quer ligar a sua conta Microsoft
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-3 py-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handleConnectDeviceFlow}
                    data-testid="button-device-flow"
                  >
                    <span className="flex flex-col items-start">
                      <span className="font-medium">Device Flow (Recomendado)</span>
                      <span className="text-xs text-muted-foreground">Insira um código no seu browser</span>
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handleConnectOAuth}
                    data-testid="button-oauth"
                  >
                    <span className="flex flex-col items-start">
                      <span className="font-medium">OAuth Redirect</span>
                      <span className="text-xs text-muted-foreground">Login tradicional com redirect</span>
                    </span>
                  </Button>
                </div>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
              </AlertDialogContent>
            </AlertDialog>
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
