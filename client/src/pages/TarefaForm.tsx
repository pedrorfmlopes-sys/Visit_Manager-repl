import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { insertTarefaSchema, type InsertTarefa, type Tarefa, type Entidade, type User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { syncManager } from "@/lib/syncManager";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { isUnauthorizedError } from "@/lib/errors";
import { useAllUsers } from "@/hooks/useAllUsers";
import { RichTextEditor } from "@/components/RichTextEditor";

export default function TarefaForm() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/tarefas/:id");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { data: currentUser } = useCurrentUser();
  const { data: allUsers = [] } = useAllUsers();
  const isAdmin = useIsAdmin();
  const isEdit = params?.id && params.id !== "nova";

  const { data: tarefa } = useQuery<Tarefa>({
    queryKey: ["/api/tarefas", params?.id],
    enabled: !!isEdit,
  });

  const { data: entidades = [] } = useQuery<Entidade[]>({
    queryKey: ["/api/entidades"],
  });

  const form = useForm<InsertTarefa>({
    resolver: zodResolver(insertTarefaSchema),
    defaultValues: tarefa || {
      titulo: "",
      descricao: "",
      visitaId: undefined,
      entidadeId: undefined,
      assignedUserId: currentUser?.id || undefined,
      dueDate: undefined,
      repeatInterval: "none",
      status: "pending",
      createdByUserId: currentUser?.id || "",
    },
    values: tarefa,
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertTarefa) => {
      await apiRequest("POST", "/api/tarefas", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      toast({
        title: "Sucesso",
        description: "Tarefa criada com sucesso",
      });
      setLocation("/tarefas");
    },
    onError: async (error: Error, data) => {
      const isNetworkError = error.message.includes('fetch') || !navigator.onLine;
      
      if (isNetworkError) {
        await syncManager.queueTarefaCreation(data);
        toast({
          title: "Tarefa guardada",
          description: "Será sincronizada automaticamente quando voltar online.",
        });
        setLocation("/tarefas");
        return;
      }
      
      if (isUnauthorizedError(error)) {
        setLocation("/");
        return;
      }
      
      toast({
        title: "Erro",
        description: "Não foi possível criar a tarefa. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertTarefa) => {
      await apiRequest("PATCH", `/api/tarefas/${params?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas", params?.id] });
      toast({
        title: "Sucesso",
        description: "Tarefa atualizada com sucesso",
      });
      setLocation(`/tarefas/${params?.id}`);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        setLocation("/");
        return;
      }
      
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a tarefa.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertTarefa) => {
    const cleanedData = {
      ...data,
      entidadeId: data.entidadeId || undefined,
      visitaId: data.visitaId || undefined,
      assignedUserId: data.assignedUserId || undefined,
      dueDate: data.dueDate || undefined,
    };
    
    if (isEdit) {
      updateMutation.mutate(cleanedData);
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/tarefas")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">
            {isEdit ? "Editar Tarefa" : "Nova Tarefa"}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Título da tarefa"
                      data-testid="input-titulo"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      content={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Descrição detalhada da tarefa (pode usar formatação e checkboxes)"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entidadeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entidade Relacionada</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-entidade">
                        <SelectValue placeholder="Selecione uma entidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {entidades.map((entidade) => (
                        <SelectItem key={entidade.id} value={entidade.id}>
                          {entidade.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isAdmin && (
              <FormField
                control={form.control}
                name="assignedUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Atribuída a</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-assigned-user">
                          <SelectValue placeholder="Selecione um utilizador" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allUsers.map((user: User) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Vencimento</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                      value={field.value ? new Date(field.value).toISOString().slice(0, 16) : ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value ? new Date(value) : undefined);
                      }}
                      data-testid="input-due-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="repeatInterval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Intervalo de Repetição</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-repeat-interval">
                        <SelectValue placeholder="Selecione o intervalo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="2days">A cada 2 dias</SelectItem>
                      <SelectItem value="3days">A cada 3 dias</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="done">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit"
            >
              <Save className="h-4 w-4 mr-2" />
              {isEdit ? "Atualizar Tarefa" : "Criar Tarefa"}
            </Button>
          </form>
        </Form>
      </main>
    </div>
  );
}
