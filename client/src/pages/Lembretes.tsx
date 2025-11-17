import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Bell, Calendar, CheckCircle, Clock, MapPin, Sparkles, Plus } from "lucide-react";
import type { Lembrete } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Lembretes() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: lembretes, isLoading } = useQuery<Lembrete[]>({
    queryKey: ['/api/lembretes'],
  });

  const snoozeMutation = useMutation({
    mutationFn: async ({ reminderId, duration }: { reminderId: string; duration: '2days' | '7days' | '30days' }) => {
      return await fetch('/api/lembretes/snooze', {
        method: 'POST',
        body: JSON.stringify({ reminderId, duration }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lembretes'] });
      toast({
        title: "Lembrete adiado",
        description: "O lembrete foi adiado com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível adiar o lembrete",
        variant: "destructive",
      });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      return await fetch('/api/lembretes/resolve', {
        method: 'POST',
        body: JSON.stringify({ reminderId }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lembretes'] });
      toast({
        title: "Lembrete concluído",
        description: "O lembrete foi marcado como concluído",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível concluir o lembrete",
        variant: "destructive",
      });
    },
  });

  const handleSnooze = (reminderId: string, duration: '2days' | '7days' | '30days') => {
    snoozeMutation.mutate({ reminderId, duration });
  };

  const handleResolve = (reminderId: string) => {
    resolveMutation.mutate(reminderId);
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'visita':
        return <Badge variant="default" className="gap-1"><MapPin className="h-3 w-3" />Visita</Badge>;
      case 'tarefa':
        return <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" />Tarefa</Badge>;
      case 'ia':
        return <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" />IA</Badge>;
      default:
        return <Badge>{tipo}</Badge>;
    }
  };

  const handleCreateVisit = (entidadeId?: string) => {
    if (entidadeId) {
      setLocation(`/visitas/nova?entidadeId=${entidadeId}`);
    } else {
      setLocation('/visitas/nova');
    }
  };

  const handleCreateTask = (entidadeId?: string, visitaId?: string) => {
    const params = new URLSearchParams();
    if (entidadeId) params.set('entidadeId', entidadeId);
    if (visitaId) params.set('visitaId', visitaId);
    setLocation(`/tarefas/nova?${params.toString()}`);
  };

  const handleOpenEntity = (entidadeId?: string) => {
    if (entidadeId) {
      setLocation(`/entidades/${entidadeId}`);
    }
  };

  const handleOpenTask = (tarefaId?: string) => {
    if (tarefaId) {
      setLocation(`/tarefas/${tarefaId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Lembretes</h1>
            <p className="text-sm text-muted-foreground">Gerencie os seus lembretes e follow-ups</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-6 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Bell className="h-6 w-6" />
            Lembretes
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie os seus lembretes e follow-ups</p>
        </div>
      </div>

      {!lembretes || lembretes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4" data-testid="text-no-reminders">
              Não existem lembretes pendentes
            </p>
            <p className="text-sm text-muted-foreground">
              Os lembretes são gerados automaticamente com base nas suas visitas e tarefas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {lembretes.map((lembrete) => (
            <Card key={lembrete.id} className="hover-elevate" data-testid={`card-lembrete-${lembrete.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    {getTipoBadge(lembrete.tipo)}
                    {lembrete.dataVencimento && (
                      <Badge variant="outline" className="ml-2 gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(lembrete.dataVencimento), "d 'de' MMMM", { locale: ptBR })}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(lembrete.dataCriacao), "d MMM", { locale: ptBR })}
                  </span>
                </div>
                <CardTitle className="text-base mt-2" data-testid={`text-lembrete-mensagem-${lembrete.id}`}>
                  {lembrete.mensagem}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {lembrete.tipo === 'visita' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleCreateVisit(lembrete.entidadeId || undefined)}
                        data-testid={`button-criar-visita-${lembrete.id}`}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Criar Visita
                      </Button>
                      {lembrete.entidadeId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEntity(lembrete.entidadeId || undefined)}
                          data-testid={`button-abrir-entidade-${lembrete.id}`}
                        >
                          <MapPin className="h-4 w-4 mr-1" />
                          Abrir Entidade
                        </Button>
                      )}
                    </>
                  )}

                  {lembrete.tipo === 'tarefa' && (
                    <>
                      {lembrete.tarefaId && (
                        <Button
                          size="sm"
                          onClick={() => handleOpenTask(lembrete.tarefaId || undefined)}
                          data-testid={`button-abrir-tarefa-${lembrete.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Abrir Tarefa
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolve(lembrete.id)}
                        data-testid={`button-marcar-concluida-${lembrete.id}`}
                      >
                        Marcar como Concluída
                      </Button>
                    </>
                  )}

                  {lembrete.tipo === 'ia' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleCreateTask(lembrete.entidadeId || undefined, lembrete.visitaId || undefined)}
                        data-testid={`button-criar-tarefa-${lembrete.id}`}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Criar Tarefa
                      </Button>
                      {lembrete.entidadeId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEntity(lembrete.entidadeId || undefined)}
                          data-testid={`button-abrir-entidade-ia-${lembrete.id}`}
                        >
                          <MapPin className="h-4 w-4 mr-1" />
                          Abrir Entidade
                        </Button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSnooze(lembrete.id, '2days')}
                    disabled={snoozeMutation.isPending}
                    data-testid={`button-snooze-2days-${lembrete.id}`}
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Adiar 2 dias
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSnooze(lembrete.id, '7days')}
                    disabled={snoozeMutation.isPending}
                    data-testid={`button-snooze-7days-${lembrete.id}`}
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Adiar 7 dias
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSnooze(lembrete.id, '30days')}
                    disabled={snoozeMutation.isPending}
                    data-testid={`button-snooze-30days-${lembrete.id}`}
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Adiar 30 dias
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleResolve(lembrete.id)}
                    disabled={resolveMutation.isPending}
                    data-testid={`button-resolve-${lembrete.id}`}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Concluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
