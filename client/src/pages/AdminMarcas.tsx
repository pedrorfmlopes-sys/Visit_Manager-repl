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
import type { Marca } from "@shared/schema";
import { Plus } from "lucide-react";
import { useState } from "react";

const createMarcaSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  codigo: z.string().optional().nullable(),
  ativa: z.boolean().default(true),
});

const updateMarcaSchema = z.object({
  nome: z.string().optional(),
  codigo: z.string().optional().nullable(),
  ativa: z.boolean().optional(),
});

type CreateMarcaForm = z.infer<typeof createMarcaSchema>;
type UpdateMarcaForm = z.infer<typeof updateMarcaSchema>;

export default function AdminMarcas() {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: marcas = [], isLoading } = useQuery<Marca[]>({
    queryKey: ["/api/admin/marcas"],
  });

  const form = useForm<CreateMarcaForm>({
    resolver: zodResolver(createMarcaSchema),
    defaultValues: { ativa: true },
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateMarcaForm>({});

  const createMutation = useMutation({
    mutationFn: (data: CreateMarcaForm) =>
      apiRequest("POST", "/api/admin/marcas", data),
    onSuccess: () => {
      toast({ title: "Marca criada com sucesso" });
      form.reset();
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marcas"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar marca",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMarcaForm }) =>
      apiRequest("PATCH", `/api/admin/marcas/${id}`, data),
    onSuccess: () => {
      toast({ title: "Marca atualizada com sucesso" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marcas"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar marca",
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
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Create Marca Form */}
        {!isFormOpen ? (
          <Button
            onClick={() => setIsFormOpen(true)}
            className="w-full"
            data-testid="button-open-create-marca-form"
          >
            <Plus className="w-4 h-4 mr-2" />
            Criar Nova Marca
          </Button>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-admin-marcas-create-title">Criar Nova Marca</CardTitle>
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
                        <FormLabel>Nome da Marca</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Marca A" {...field} data-testid="input-marca-nome" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="codigo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código (Opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: MA001" {...field} value={field.value || ""} data-testid="input-marca-codigo" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ativa"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-marca-ativa-create"
                          />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">Marca Ativa</FormLabel>
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2">
                    <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-marca">
                      {createMutation.isPending ? "Criando..." : "Criar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsFormOpen(false)}
                      data-testid="button-cancel-marca-form"
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Marcas List */}
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-admin-marcas-list-title">Marcas da Empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {marcas.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma marca encontrada</p>
              ) : (
                marcas.map((marca) => (
                  <div
                    key={marca.id}
                    className="flex flex-col gap-3 p-4 border rounded-lg hover-elevate"
                    data-testid={`card-marca-${marca.id}`}
                  >
                    {editingId === marca.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          updateMutation.mutate({ id: marca.id, data: editForm });
                        }}
                        className="space-y-3"
                      >
                        <Input
                          placeholder="Nome"
                          value={editForm.nome || marca.nome}
                          onChange={(e) =>
                            setEditForm({ ...editForm, nome: e.target.value })
                          }
                          data-testid={`input-edit-marca-nome-${marca.id}`}
                        />
                        <Input
                          placeholder="Código"
                          value={editForm.codigo || marca.codigo || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, codigo: e.target.value || null })
                          }
                          data-testid={`input-edit-marca-codigo-${marca.id}`}
                        />
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={editForm.ativa !== undefined ? editForm.ativa : marca.ativa}
                            onCheckedChange={(checked) =>
                              setEditForm({ ...editForm, ativa: checked as boolean })
                            }
                            data-testid={`checkbox-edit-marca-ativa-${marca.id}`}
                          />
                          <span>Ativa</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            size="sm"
                            disabled={updateMutation.isPending}
                            data-testid={`button-save-marca-${marca.id}`}
                          >
                            Guardar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                            data-testid={`button-cancel-edit-marca-${marca.id}`}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold" data-testid={`text-marca-nome-${marca.id}`}>
                              {marca.nome}
                            </p>
                            {marca.codigo && (
                              <p className="text-sm text-muted-foreground" data-testid={`text-marca-codigo-${marca.id}`}>
                                Código: {marca.codigo}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant={marca.ativa ? "default" : "secondary"}
                            data-testid={`badge-marca-ativa-${marca.id}`}
                          >
                            {marca.ativa ? "Ativa" : "Inativa"}
                          </Badge>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(marca.id);
                              setEditForm({
                                nome: marca.nome,
                                codigo: marca.codigo,
                                ativa: marca.ativa,
                              });
                            }}
                            data-testid={`button-edit-marca-${marca.id}`}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant={marca.ativa ? "outline" : "default"}
                            onClick={() =>
                              updateMutation.mutate({
                                id: marca.id,
                                data: { ativa: !marca.ativa },
                              })
                            }
                            disabled={updateMutation.isPending}
                            data-testid={`button-toggle-ativa-marca-${marca.id}`}
                          >
                            {marca.ativa ? "Desativar" : "Ativar"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
