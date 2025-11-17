import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Calendar, Trash2, Edit, Download, CheckCircle2, Circle, Building2, FileText, Send, CheckCheck, Cloud } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";

export default function TarefaDetail() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/tarefas/:id");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPlannerDialog, setShowPlannerDialog] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedBucketId, setSelectedBucketId] = useState<string>("");

  const { data: tarefa, isLoading } = useQuery<TarefaWithRelations>({
    queryKey: ["/api/tarefas", params?.id],
  });

  const { data: msStatus } = useQuery<{ authenticated: boolean }>({
    queryKey: ["/api/microsoft/auth/status"],
  });

  const { data: groups = [] } = useQuery<Array<{ id: string; displayName: string }>>({
    queryKey: ["/api/microsoft/planner/groups"],
    enabled: showPlannerDialog && !!msStatus?.authenticated,
  });

  const { data: plans = [] } = useQuery<Array<{ id: string; title: string }>>({
    queryKey: ["/api/microsoft/planner/plans", selectedGroupId],
    enabled: !!selectedGroupId && showPlannerDialog,
  });

  const { data: buckets = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/microsoft/planner/buckets", selectedPlanId],
    enabled: !!selectedPlanId && showPlannerDialog,
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
      setLocation("/tarefas");
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

  const exportToPlannerMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlanId || !selectedBucketId) {
        throw new Error("Selecione um plano e bucket");
      }
      await apiRequest("POST", `/api/microsoft/planner/export/${params?.id}`, {
        planId: selectedPlanId,
        bucketId: selectedBucketId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas", params?.id] });
      setShowPlannerDialog(false);
      toast({
        title: "Sucesso",
        description: "Tarefa exportada para o Microsoft Planner",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível exportar para o Planner",
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

  const handlePlannerExport = () => {
    if (!msStatus?.authenticated) {
      toast({
        title: "Autenticação Necessária",
        description: "Faça login no Microsoft 365 em Integrações",
        variant: "destructive",
      });
      return;
    }
    setSelectedGroupId("");
    setSelectedPlanId("");
    setSelectedBucketId("");
    setShowPlannerDialog(true);
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/tarefas")} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold text-foreground">Detalhes da Tarefa</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/tarefas/${params?.id}/editar`)} data-testid="button-edit">
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
            {tarefa.plannerTaskId && (
              <Badge variant="secondary" className="gap-1" data-testid="badge-planner">
                <CheckCheck className="h-3 w-3" />
                Exportada para Planner
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
                    <p className="font-medium text-sm">Microsoft Planner</p>
                    <p className="text-xs text-muted-foreground">
                      {tarefa.plannerTaskId 
                        ? `Exportada em ${format(new Date(tarefa.lastPlannerSyncAt!), "PP", { locale: pt })}`
                        : "Não exportada"}
                    </p>
                  </div>
                  <Button
                    variant={tarefa.plannerTaskId ? "outline" : "default"}
                    size="sm"
                    onClick={handlePlannerExport}
                    disabled={exportToPlannerMutation.isPending}
                    data-testid="button-export-planner"
                  >
                    {exportToPlannerMutation.isPending ? (
                      "A exportar..."
                    ) : tarefa.plannerTaskId ? (
                      <>
                        <Send className="h-4 w-4 mr-2" />
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
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">Microsoft To-Do</p>
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
                        <Send className="h-4 w-4 mr-2" />
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
                Faça login com Microsoft 365 para exportar tarefas para Planner e To-Do
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={() => setLocation('/integracoes/microsoft')}
                data-testid="button-goto-microsoft-login"
              >
                <Cloud className="h-4 w-4 mr-2" />
                Conectar Microsoft 365
              </Button>
            </>
          )}
        </Card>
      </main>

      <Dialog open={showPlannerDialog} onOpenChange={setShowPlannerDialog}>
        <DialogContent data-testid="dialog-planner-export">
          <DialogHeader>
            <DialogTitle>Exportar para Microsoft Planner</DialogTitle>
            <DialogDescription>
              Selecione o grupo, plano e bucket onde deseja criar a tarefa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Grupo</label>
              <Select value={selectedGroupId} onValueChange={(value) => {
                setSelectedGroupId(value);
                setSelectedPlanId("");
                setSelectedBucketId("");
              }}>
                <SelectTrigger data-testid="select-group">
                  <SelectValue placeholder="Selecione um grupo" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedGroupId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Plano</label>
                <Select value={selectedPlanId} onValueChange={(value) => {
                  setSelectedPlanId(value);
                  setSelectedBucketId("");
                }}>
                  <SelectTrigger data-testid="select-plan">
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedPlanId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Bucket</label>
                <Select value={selectedBucketId} onValueChange={setSelectedBucketId}>
                  <SelectTrigger data-testid="select-bucket">
                    <SelectValue placeholder="Selecione um bucket" />
                  </SelectTrigger>
                  <SelectContent>
                    {buckets.map((bucket) => (
                      <SelectItem key={bucket.id} value={bucket.id}>
                        {bucket.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlannerDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => exportToPlannerMutation.mutate()}
              disabled={!selectedBucketId || exportToPlannerMutation.isPending}
              data-testid="button-confirm-export"
            >
              {exportToPlannerMutation.isPending ? "A exportar..." : "Exportar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
