import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Building2, Store, Factory, Briefcase, Users, Home, Handshake, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertEntidadeTipoSchema, type EntidadeTipo } from "@shared/schema";

// FASE 30: Icon map for display
const iconOptions = [
  { name: 'Building2', label: 'Edifício', component: Building2 },
  { name: 'Store', label: 'Loja', component: Store },
  { name: 'Factory', label: 'Fábrica', component: Factory },
  { name: 'Briefcase', label: 'Negócio', component: Briefcase },
  { name: 'Users', label: 'Pessoas', component: Users },
  { name: 'Home', label: 'Casa', component: Home },
  { name: 'Handshake', label: 'Parceria', component: Handshake },
  { name: 'Package', label: 'Pacote', component: Package },
];

export default function AdminEntidadeTipos() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);

  const { data: tipos = [], isLoading } = useQuery<EntidadeTipo[]>({
    queryKey: ["/api/admin/entidade-tipos"],
  });

  const form = useForm({
    resolver: zodResolver(insertEntidadeTipoSchema),
    defaultValues: {
      nome: "",
      cor: "#3b82f6",
      icon: "Building2", // FASE 30: Default icon
      ativo: true,
      ordem: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/admin/entidade-tipos", data),
    onSuccess: () => {
      toast({ title: "Tipo criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/entidade-tipos"] });
      form.reset();
      setOpenDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: any }) =>
      apiRequest("PATCH", `/api/admin/entidade-tipos/${data.id}`, data.updates),
    onSuccess: () => {
      toast({ title: "Tipo atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/entidade-tipos"] });
      setEditingId(null);
      form.reset();
      setOpenDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/admin/entidade-tipos/${id}`, { ativo: false }),
    onSuccess: () => {
      toast({ title: "Tipo desativado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/entidade-tipos"] });
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao desativar", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data: any) => {
    console.log("[DEBUG TIPO ENTIDADE SUBMIT]", data);
    if (editingId) {
      updateMutation.mutate({ id: editingId, updates: data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (tipo: EntidadeTipo) => {
    setEditingId(tipo.id);
    form.reset(tipo);
    setOpenDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse">
          <div className="w-8 h-8 bg-primary rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Tipos de Entidade</h3>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              onClick={() => {
                setEditingId(null);
                form.reset();
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Tipo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Tipo" : "Novo Tipo de Entidade"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Atualize os detalhes do tipo" : "Crie um novo tipo de entidade"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="ex: Gabinete" {...field} />
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
                      <FormLabel>Cor</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <input type="color" {...field} className="w-12 h-10 rounded" />
                          <span className="text-sm text-muted-foreground">{field.value}</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ícone</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "Building2"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Escolhe ícone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {iconOptions.map((option) => {
                            const IconComponent = option.component;
                            return (
                              <SelectItem key={option.name} value={option.name}>
                                <div className="flex items-center gap-2">
                                  <IconComponent className="h-4 w-4" />
                                  <span>{option.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Atualizar" : "Criar"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {tipos.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Nenhum tipo criado. Crie um novo para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tipos.map((tipo) => {
            // FASE 30: Get icon component for this type
            const iconOption = iconOptions.find(opt => opt.name === (tipo.icon || 'Building2'));
            const IconComponent = iconOption?.component || Building2;
            
            return (
              <Card key={tipo.id} className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: tipo.cor || "#3b82f6" }}
                      />
                      <IconComponent className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{tipo.nome}</span>
                      {!tipo.ativo && (
                        <span className="text-xs text-muted-foreground">(inativo)</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleEdit(tipo)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => setDeletingId(tipo.id)}
                        disabled={!tipo.ativo}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Desativar Tipo?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Este tipo será desativado e não aparecerá mais nas opções.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeletingId(null)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(deletingId)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Desativando..." : "Desativar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
