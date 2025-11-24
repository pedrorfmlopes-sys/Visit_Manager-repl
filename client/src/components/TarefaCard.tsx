import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { CheckCircle2, Circle, Calendar, Building2, User, AlertCircle, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RichTextViewer } from "@/components/RichTextViewer";
import type { TarefaWithRelations } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TarefaCardProps {
  tarefa: TarefaWithRelations;
  onClick?: () => void;
}

export function TarefaCard({ tarefa, onClick }: TarefaCardProps) {
  const isOverdue = tarefa.dueDate && new Date(tarefa.dueDate) < new Date() && tarefa.status === 'pending';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteTarefaMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/tarefas/${tarefa.id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      toast({
        title: "Sucesso",
        description: "Tarefa eliminada com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao eliminar tarefa",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Tem a certeza que deseja eliminar esta tarefa?")) {
      deleteTarefaMutation.mutate();
    }
  };
  
  return (
    <Card
      className="p-4 hover-elevate active-elevate-2"
      data-testid={`card-tarefa-${tarefa.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            {tarefa.status === 'done' ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" data-testid="icon-status-done" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" data-testid="icon-status-pending" />
            )}
            
            <div className="flex-1 min-w-0" onClick={onClick} className="cursor-pointer">
              <h3 className={`font-medium text-foreground mb-1 ${tarefa.status === 'done' ? 'line-through text-muted-foreground' : ''}`} data-testid="text-titulo">
                {tarefa.titulo}
              </h3>
              
              {tarefa.descricao && (
                <div className="text-sm text-muted-foreground mb-2 line-clamp-2" data-testid="text-descricao">
                  <RichTextViewer content={tarefa.descricao} />
                </div>
              )}
              
              <div className="flex flex-wrap gap-2 mb-2">
                {isOverdue && (
                  <Badge variant="destructive" className="text-xs" data-testid="badge-overdue">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Atrasada
                  </Badge>
                )}
                
                {tarefa.status === 'pending' && (
                  <Badge variant="outline" className="text-xs" data-testid="badge-pending">
                    Pendente
                  </Badge>
                )}
                
                {tarefa.status === 'done' && (
                  <Badge variant="default" className="text-xs bg-green-600" data-testid="badge-done">
                    Concluída
                  </Badge>
                )}
                
                {tarefa.repeatInterval && tarefa.repeatInterval !== 'none' && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-repeat">
                    {tarefa.repeatInterval === 'daily' ? 'Diário' :
                     tarefa.repeatInterval === '2days' ? 'A cada 2 dias' :
                     tarefa.repeatInterval === '3days' ? 'A cada 3 dias' :
                     tarefa.repeatInterval === 'weekly' ? 'Semanal' : ''}
                  </Badge>
                )}
              </div>
              
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {tarefa.dueDate && (
                  <span className="flex items-center gap-1" data-testid="text-due-date">
                    <Calendar className="h-3 w-3" />
                    {formatDistanceToNow(new Date(tarefa.dueDate), { addSuffix: true, locale: pt })}
                  </span>
                )}
                
                {tarefa.entidade && (
                  <span className="flex items-center gap-1" data-testid="text-entidade">
                    <Building2 className="h-3 w-3" />
                    {tarefa.entidade.nome}
                  </span>
                )}
                
                {tarefa.assignedUser && (
                  <span className="flex items-center gap-1" data-testid="text-assigned-user">
                    <User className="h-3 w-3" />
                    {tarefa.assignedUser.firstName} {tarefa.assignedUser.lastName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDelete}
          disabled={deleteTarefaMutation.isPending}
          className="flex-shrink-0"
          data-testid={`button-delete-tarefa-${tarefa.id}`}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </Card>
  );
}
