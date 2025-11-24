import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { EntidadeTipo } from "@shared/schema";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { useState } from "react";

const createTipoSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  cor: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
  ordem: z.number().default(0),
});

const updateTipoSchema = z.object({
  nome: z.string().optional(),
  cor: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  ordem: z.number().optional(),
});

type CreateTipoForm = z.infer<typeof createTipoSchema>;
type UpdateTipoForm = z.infer<typeof updateTipoSchema>;

export default function AdminEntidadeTipos() {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateTipoForm>({});

  const { data: tipos = [], isLoading } = useQuery<EntidadeTipo[]>({
    queryKey: ["/api/admin/entidade-tipos"],
  });

  const form = useForm<CreateTipoForm>({
    resolver: zodResolver(createTipoSchema),
    defaultValues: { ativo: true, ordem: 0 },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTipoForm) =>
      apiRequest("POST", "/api/admin/entidade-tipos", data),
    onSuccess: () => {
      toast({ title: "Tipo criado com sucesso" });
      form.reset();
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/entidade-tipos"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar tipo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTipoForm }) =>
      apiRequest("PATCH", `/api/admin/entidade-tipos/${id}`, data),
    onSuccess: () => {
      toast({ title: "Tipo atualizado com sucesso" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/entidade-tipos"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar tipo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-primary rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 pt-4">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Create Tipo Form */}
        {!isFormOpen ? (
          <Button
            onClick={() => setIsFormOpen(true)}
            className="w-full"
            data-testid="button-open-create-tipo-form"
          >
            <Plus className="w-4 h-4 mr-2" />
            Criar Novo Tipo de Entidade
          </Button>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-admin-tipos-create-title">Criar Novo Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Tipo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Hotel, Arquiteto, Revenda" {...field} data-testid="input-tipo-nome" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cor (Opcional)</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              placeholder="#000000"
                              {...field}
                              value={field.value || "#000000"}
                              className="w-20 h-10"
                              data-testid="input-tipo-cor"
                            />
                            <Input
                              placeholder="Ex: #FF5733"
                              {...field}
                              value={field.value || ""}
                              data-testid="input-tipo-cor-hex"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ativo"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-tipo-ativo"
                          />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">Ativo</FormLabel>
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2">
                    <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-tipo">
                      {createMutation.isPending ? "Criando..." : "Criar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsFormOpen(false)}
                      data-testid="button-cancel-tipo-form"
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Tipos List */}
        <div className="space-y-3">
          {tipos.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-secondary">
                Nenhum tipo de entidade criado
              </CardContent>
            </Card>
          ) : (
            tipos.map((tipo) => (
              <Card key={tipo.id} className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-1">
                      {tipo.cor && (
                        <div
                          className="w-6 h-6 rounded-full border"
                          style={{ backgroundColor: tipo.cor }}
                          data-testid={`badge-tipo-cor-${tipo.id}`}
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium" data-testid={`text-tipo-nome-${tipo.id}`}>
                          {tipo.nome}
                        </p>
                        <p className="text-xs text-secondary">Ordem: {tipo.ordem}</p>
                      </div>
                      {!tipo.ativo && (
                        <Badge variant="secondary" data-testid={`badge-tipo-inactive-${tipo.id}`}>
                          Inativo
                        </Badge>
                      )}
                    </div>

                    {editingId === tipo.id ? (
                      <div className="flex-1 space-y-3 min-w-xs">
                        <Input
                          placeholder="Nome"
                          value={editForm.nome || ""}
                          onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                          data-testid={`input-edit-tipo-nome-${tipo.id}`}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={updateMutation.isPending}
                            onClick={() => updateMutation.mutate({ id: tipo.id, data: editForm })}
                            data-testid={`button-save-tipo-${tipo.id}`}
                          >
                            {updateMutation.isPending ? "..." : "Guardar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null);
                              setEditForm({});
                            }}
                            data-testid={`button-cancel-edit-tipo-${tipo.id}`}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(tipo.id);
                            setEditForm({ nome: tipo.nome, ativo: tipo.ativo });
                          }}
                          data-testid={`button-edit-tipo-${tipo.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            updateMutation.mutate({
                              id: tipo.id,
                              data: { ativo: !tipo.ativo },
                            });
                          }}
                          data-testid={`button-toggle-tipo-${tipo.id}`}
                        >
                          {tipo.ativo ? (
                            <span className="text-xs font-bold">ON</span>
                          ) : (
                            <span className="text-xs font-bold text-secondary">OFF</span>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
