import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Calendar, Trash2, Edit, Download, CheckCircle2, Circle, Building2, FileText, Send, CheckCheck, Cloud, ExternalLink } from "lucide-react";
import { useAllUsers } from "@/hooks/use-user-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { TarefaWithRelations } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow, format } from "date-fns";
import { pt } from "date-fns/locale";
import { isUnauthorizedError } from "@/lib/errors";
import { exportTarefaAsICS } from "@/lib/icsExport";
import { RichTextViewer } from "@/components/RichTextViewer";

export default function TarefaDetail() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/tarefas/:id");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allUsers = [] } = useAllUsers();
  const requestedReturnTo = new URLSearchParams(window.location.search).get(
    "returnTo",
  );
  const returnTo =
    requestedReturnTo?.startsWith("/") ? requestedReturnTo : null;
  const backTarget = returnTo || "/tarefas";

  const { data: tarefa, isLoading } = useQuery<TarefaWithRelations>({
    queryKey: ["/api/tarefas", params?.id],
  });

  const { data: msStatus } = useQuery<{ authenticated: boolean; connected?: boolean; oauthConfigured?: boolean }>({
    queryKey: ["/api/microsoft/auth/status"],
  });

  const { data: odooStatus, isLoading: odooStatusLoading } = useQuery<any>({
    queryKey: ["/api/integrations/odoo/status"],
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/tarefas/${params?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      toast({
        title: "Sucesso",
        description: "Tarefa eliminada com sucesso",
      });
      setLocation(backTarget);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        setLocation("/");
        return;
      }
      toast({
        title: "Erro",
        description: "Não foi possível eliminar a tarefa.",
        variant: "destructive",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      const newStatus = tarefa?.status === 'done' ? 'pending' : 'done';
      await apiRequest("PATCH", `/api/tarefas/${params?.id}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas", params?.id] });
      toast({
        title: "Sucesso",
        description: "Estado da tarefa atualizado",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o estado.",
        variant: "destructive",
      });
    },
  });

  const exportToTodoMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/microsoft/todo/export/${params?.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas", params?.id] });
      toast({
        title: "Sucesso",
        description: "Tarefa exportada para o Microsoft To-Do",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível exportar para o To-Do",
        variant: "destructive",
      });
    },
  });

  const syncToOdooMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/tarefas/${params?.id}/odoo/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const json = await response.json();
      if (!response.ok || json.success === false) {
        throw new Error(json.message || `HTTP ${response.status}`);
      }
      return json;
    },
    onSuccess: async (json) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/tarefas", params?.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      toast({
        title: "Sucesso",
        description: json.created
          ? "Tarefa criada no Odoo."
          : json.pulled
            ? "Tarefa atualizada a partir do Odoo."
            : "Tarefa sincronizada com Odoo.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao sincronizar",
        description: error?.message || "Tenta novamente.",
        variant: "destructive",
      });
    },
  });

  const pullFromOdooMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/tarefas/${params?.id}/odoo/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const json = await response.json();
      if (!response.ok || json.success === false) {
        throw new Error(json.message || `HTTP ${response.status}`);
      }
      return json;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/tarefas", params?.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      toast({
        title: "Sucesso",
        description: "Tarefa atualizada a partir do Odoo.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar do Odoo",
        description: error?.message || "Tenta novamente.",
        variant: "destructive",
      });
    },
  });

  const handleExportICS = () => {
    if (!tarefa) return;
    try {
      exportTarefaAsICS(tarefa);
      toast({
        title: "Sucesso",
        description: "Tarefa exportada para calendário",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível exportar a tarefa",
        variant: "destructive",
      });
    }
  };

  const handleTodoExport = () => {
    if (!msStatus?.authenticated) {
      toast({
        title: "Autenticação Necessária",
        description: "Faça login no Microsoft 365 em Integrações",
        variant: "destructive",
      });
      return;
    }
    exportToTodoMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-16 w-full" />
        <div className="max-w-2xl mx-auto px-4 py-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!tarefa) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Tarefa não encontrada</p>
      </div>
    );
  }

  const isOverdue = tarefa.dueDate && new Date(tarefa.dueDate) < new Date() && tarefa.status === 'pending';
  const isOdooConfigured = odooStatus && "configured" in odooStatus && odooStatus.configured;
  const odooTaskUrl =
    tarefa.odooTaskId && isOdooConfigured && odooStatus?.baseUrl
      ? `${odooStatus.baseUrl}/web#id=${tarefa.odooTaskId}&model=project.task&view_type=form`
      : null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(backTarget)} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold text-foreground">Detalhes da Tarefa</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const search = new URLSearchParams();
                if (returnTo) search.set("returnTo", returnTo);
                const suffix = search.toString()
                  ? `?${search.toString()}`
                  : "";
                setLocation(`/tarefas/${params?.id}/editar${suffix}`);
              }}
              data-testid="button-edit"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate()} data-testid="button-delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Card className="p-6">
          <div className="flex items-start gap-3 mb-4">
            {tarefa.status === 'done' ? (
              <CheckCircle2 className="h-6 w-6 text-green-600 mt-1" />
            ) : (
              <Circle className="h-6 w-6 text-muted-foreground mt-1" />
            )}
            <div className="flex-1">
              <h2 className={`text-2xl font-semibold mb-2 ${tarefa.status === 'done' ? 'line-through text-muted-foreground' : ''}`} data-testid="text-titulo">
                {tarefa.titulo}
              </h2>
              {tarefa.descricao && (
                <RichTextViewer
                  content={tarefa.descricao}
                  className="text-muted-foreground"
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {isOverdue && (
              <Badge variant="destructive" data-testid="badge-overdue">Atrasada</Badge>
            )}
            {tarefa.status === 'pending' && (
              <Badge variant="outline" data-testid="badge-pending">Pendente</Badge>
            )}
            {tarefa.status === 'done' && (
              <Badge variant="default" className="bg-green-600" data-testid="badge-done">Concluída</Badge>
            )}
            {tarefa.repeatInterval !== 'none' && (
              <Badge variant="secondary" data-testid="badge-repeat">
                {tarefa.repeatInterval === 'daily' ? 'Diário' :
                 tarefa.repeatInterval === '2days' ? 'A cada 2 dias' :
                 tarefa.repeatInterval === '3days' ? 'A cada 3 dias' :
                 tarefa.repeatInterval === 'weekly' ? 'Semanal' : ''}
              </Badge>
            )}
            {tarefa.todoTaskId && (
              <Badge variant="secondary" className="gap-1" data-testid="badge-todo">
                <CheckCheck className="h-3 w-3" />
                Exportada para To-Do
              </Badge>
            )}
          </div>

          <div className="space-y-3 text-sm">
            {tarefa.dueDate && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(tarefa.dueDate), "PPPp", { locale: pt })}</span>
                <span className="text-xs">({formatDistanceToNow(new Date(tarefa.dueDate), { addSuffix: true, locale: pt })})</span>
              </div>
            )}
            {tarefa.assignedUser && (
              <div className="flex items-center gap-2 text-muted-foreground" data-testid="text-assigned-user">
                <span className="font-medium">Atribuída a:</span>
                {tarefa.assignedUser.firstName} {tarefa.assignedUser.lastName}
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            <Button onClick={() => toggleStatusMutation.mutate()} disabled={toggleStatusMutation.isPending} data-testid="button-toggle-status">
              {tarefa.status === 'done' ? 'Marcar como Pendente' : 'Marcar como Concluída'}
            </Button>
            <Button variant="outline" onClick={handleExportICS} data-testid="button-export-ics">
              <Download className="h-4 w-4 mr-2" />
              Exportar ICS
            </Button>
          </div>
        </Card>

        {tarefa.entidade && (
          <Card className="p-4 hover-elevate active-elevate-2 cursor-pointer" onClick={() => setLocation(`/entidades/${tarefa.entidade!.id}`)} data-testid="card-entidade">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Entidade Relacionada</p>
                <p className="font-medium">{tarefa.entidade.nome}</p>
              </div>
            </div>
          </Card>
        )}

        {tarefa.visita && (
          <Card className="p-4 hover-elevate active-elevate-2 cursor-pointer" onClick={() => setLocation(`/visitas/${tarefa.visita!.id}`)} data-testid="card-visita">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Visita Relacionada</p>
                <p className="font-medium">Visita de {format(new Date(tarefa.visita.dataVisita), "PP", { locale: pt })}</p>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6" data-testid="card-microsoft-export">
          <div className="flex items-center gap-2 mb-4">
            <Cloud className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold">Exportações Microsoft 365</h3>
          </div>
          
          {msStatus?.authenticated ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Exporte esta tarefa para as suas ferramentas Microsoft
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm flex items-center gap-2">
                      Microsoft To-Do
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">Ativo</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tarefa.todoTaskId 
                        ? `Exportada em ${format(new Date(tarefa.lastTodoSyncAt!), "PP", { locale: pt })}`
                        : "Não exportada"}
                    </p>
                  </div>
                  <Button
                    variant={tarefa.todoTaskId ? "outline" : "default"}
                    size="sm"
                    onClick={handleTodoExport}
                    disabled={exportToTodoMutation.isPending}
                    data-testid="button-export-todo"
                  >
                    {exportToTodoMutation.isPending ? (
                      "A exportar..."
                    ) : tarefa.todoTaskId ? (
                      <>
                        <CheckCheck className="h-4 w-4 mr-2" />
                        Exportar novamente
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Exportar
                      </>
                    )}
                  </Button>
                </div>
                
                
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Faça login com Microsoft 365 para exportar tarefas para To-Do
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  window.open('/api/microsoft/auth/login', '_blank', 'width=600,height=700');
                  toast({
                    title: "Autenticação Microsoft",
                    description: "Uma nova janela foi aberta. Complete o login e volte aqui.",
                  });
                  setTimeout(() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/microsoft/auth/status"] });
                  }, 3000);
                }}
                data-testid="button-goto-microsoft-login"
              >
                <Cloud className="h-4 w-4 mr-2" />
                Conectar Microsoft 365
              </Button>
            </>
          )}
        </Card>

        <Card data-testid="card-odoo-task" className="p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-sm">Odoo Tasks</h3>
            <p className="text-xs text-muted-foreground">Sincronizar tarefa com Odoo</p>
          </div>

          {odooStatusLoading ? (
            <p className="text-xs text-muted-foreground">A carregar estado...</p>
          ) : !isOdooConfigured ? (
            <p className="text-xs text-amber-600">
              Odoo não está configurado ou está desligado para esta empresa.
            </p>
          ) : tarefa.odooTaskId ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Tarefa sincronizada: <span className="font-mono text-xs">{tarefa.odooTaskId}</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => pullFromOdooMutation.mutate()}
                  disabled={pullFromOdooMutation.isPending || syncToOdooMutation.isPending}
                  data-testid="button-tarefa-atualizar-do-odoo"
                >
                  {pullFromOdooMutation.isPending ? "A atualizar..." : "Atualizar do Odoo"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => syncToOdooMutation.mutate()}
                  disabled={pullFromOdooMutation.isPending || syncToOdooMutation.isPending}
                  data-testid="button-tarefa-sincronizar-odoo"
                >
                  {syncToOdooMutation.isPending ? "A sincronizar..." : "Sincronizar"}
                </Button>
                {odooTaskUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(odooTaskUrl, "_blank")}
                    data-testid="button-tarefa-abrir-odoo"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Abrir
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Tarefa não sincronizada com Odoo.
              </p>
              <Button
                size="sm"
                onClick={() => syncToOdooMutation.mutate()}
                disabled={syncToOdooMutation.isPending}
                data-testid="button-tarefa-criar-odoo"
                className="w-full"
              >
                {syncToOdooMutation.isPending ? "A criar..." : "Criar tarefa no Odoo"}
              </Button>
            </div>
          )}
        </Card>

        {/* Activity Log */}
        {tarefa && (
          <Card data-testid="card-task-activity-log" className="mb-6">
            <div className="p-6 space-y-3 text-sm border-b">
              <h2 className="font-semibold">Histórico da Tarefa</h2>
              {tarefa.createdByUserId && (
                <div className="flex gap-2">
                  <div className="text-muted-foreground">•</div>
                  <div>
                    {(() => {
                      const creator = allUsers.find(u => u.id === tarefa.createdByUserId);
                      const displayName = creator 
                        ? (creator.firstName && creator.lastName ? `${creator.firstName} ${creator.lastName}` : creator.email)
                        : "Utilizador desconhecido";
                      return (
                        <p className="text-foreground">Criada por <span className="font-medium">{displayName}</span></p>
                      );
                    })()}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <div className="text-muted-foreground">•</div>
                <div>
                  <p className="text-foreground">
                    Estado atual: <span className="font-medium">{tarefa.status === 'done' ? '✓ Concluída' : '○ Pendente'}</span>
                  </p>
                </div>
              </div>
              {tarefa.dueDate && (
                <div className="flex gap-2">
                  <div className="text-muted-foreground">•</div>
                  <div>
                    <p className="text-foreground">Vence em</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(tarefa.dueDate), "PPp", { locale: pt })}</p>
                  </div>
                </div>
              )}
              {tarefa.visitaId && (
                <div className="flex gap-2">
                  <div className="text-muted-foreground">•</div>
                  <div>
                    <p className="text-foreground">Relacionada com uma visita</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </main>

    </div>
  );
}
