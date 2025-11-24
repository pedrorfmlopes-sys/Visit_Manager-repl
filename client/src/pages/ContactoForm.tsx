import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Loader2, WifiOff, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useCurrentUser, useAllUsers, useIsAdmin } from "@/hooks/use-user-context";
import { insertContactoSchema, type InsertContacto, type Contacto, type Entidade } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { syncManager } from "@/lib/syncManager";

export default function ContactoForm() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/contactos/:id");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const isEdit = params?.id && params.id !== "novo";
  
  // User context for multi-agent system
  const { data: currentUser } = useCurrentUser();
  const { data: allUsers = [] } = useAllUsers();
  const isAdmin = useIsAdmin();
  
  // Get entidadeId from query params
  const searchParams = new URLSearchParams(window.location.search);
  const entidadeIdFromQuery = searchParams.get("entidadeId") || "";

  const { data: contacto } = useQuery<Contacto>({
    queryKey: ["/api/contactos", params?.id],
    enabled: !!isEdit,
  });

  const { data: entidades } = useQuery<Entidade[]>({
    queryKey: ["/api/entidades"],
  });

  const form = useForm<InsertContacto>({
    resolver: zodResolver(insertContactoSchema),
    defaultValues: contacto || {
      nome: "",
      funcao: "",
      telemovel: "",
      email: "",
      entidadeId: entidadeIdFromQuery,
      observacoes: "",
      fotoUrl: "",
      createdByUserId: currentUser?.id,
      assignedUserId: currentUser?.id, // Default to current user
    },
    values: contacto,
  });

  // Auto-fill address when entity is selected
  const handleEntidadeChange = (entidadeId: string) => {
    // Handle "Sem entidade" option by setting to undefined
    if (entidadeId === "__none__" || !entidadeId) {
      return;
    }
    
    const selectedEntity = entidades?.find(e => e.id === entidadeId);
    if (selectedEntity) {
      // Only auto-fill observacoes if it's currently empty
      const currentObservacoes = form.getValues("observacoes") || "";
      if (!currentObservacoes.trim()) {
        const addressParts = [
          selectedEntity.morada,
          selectedEntity.codigoPostal && selectedEntity.cidade 
            ? `${selectedEntity.codigoPostal} ${selectedEntity.cidade}`
            : selectedEntity.codigoPostal || selectedEntity.cidade
        ].filter(Boolean);
        
        if (addressParts.length > 0) {
          form.setValue("observacoes", `Morada: ${addressParts.join(", ")}`);
        }
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: InsertContacto) => {
      await apiRequest("POST", "/api/contactos", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contactos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entidades"] });
      queryClient.refetchQueries({ queryKey: ["/api/entidades"] });
      toast({
        title: "Sucesso",
        description: "Contacto criado com sucesso",
      });
      setLocation("/contactos");
    },
    onError: async (error: Error, data) => {
      // Check if it's a network error (offline)
      const isNetworkError = error.message.includes('fetch') || 
                            error.message.includes('NetworkError') ||
                            error.message.includes('Failed to fetch') ||
                            !navigator.onLine;
      
      if (isNetworkError) {
        await syncManager.queueContactoCreation(data);
        toast({
          title: "Contacto guardado",
          description: "Será sincronizado automaticamente quando voltar online.",
        });
        setLocation("/contactos");
        return;
      }
      
      if (isUnauthorizedError(error)) {
        toast({
          title: "Não autorizado",
          description: "A fazer login novamente...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro",
        description: "Não foi possível criar o contacto",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertContacto) => {
      await apiRequest("PATCH", `/api/contactos/${params?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contactos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contactos", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/entidades"] });
      queryClient.refetchQueries({ queryKey: ["/api/entidades"] });
      toast({
        title: "Sucesso",
        description: "Contacto atualizado com sucesso",
      });
      setLocation(`/contactos/${params?.id}`);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Não autorizado",
          description: "A fazer login novamente...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o contacto",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: InsertContacto) => {
    // Guard: Prevent submission until user context loads
    if (!currentUser) {
      toast({
        title: "A carregar...",
        description: "Por favor aguarde enquanto carregamos os seus dados.",
        variant: "destructive",
      });
      return;
    }
    
    // Normalize empty string and __none__ to undefined for optional entidadeId
    if (!data.entidadeId || data.entidadeId === "__none__" || data.entidadeId === "") {
      data.entidadeId = undefined;
    }
    
    // Set ownership on creation (currentUser now guaranteed to exist)
    if (!isEdit) {
      data.createdByUserId = currentUser.id;
      // For non-admins, ALWAYS set to current user. For admins, use selected value or default to current user
      if (!isAdmin || !data.assignedUserId) {
        data.assignedUserId = currentUser.id;
      }
    }
    
    if (!isOnline && !isEdit) {
      await syncManager.queueContactoCreation(data);
      toast({
        title: "Contacto guardado",
        description: "Será sincronizado automaticamente quando voltar online.",
      });
      setLocation("/contactos");
      return;
    }

    if (!isOnline && isEdit) {
      toast({
        title: "Modo Offline",
        description: "Não é possível editar enquanto offline. Tente novamente quando voltar online.",
        variant: "destructive",
      });
      return;
    }

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/contactos")}
              data-testid="button-voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold text-foreground">
              {isEdit ? "Editar Contacto" : "Novo Contacto"}
            </h1>
          </div>
          {!isEdit && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setLocation("/qr-scanner")}
              data-testid="button-qr-scanner"
              title="Importar de QR Code ou Cartão de Visita"
            >
              <QrCode className="h-5 w-5" />
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {!isOnline && (
          <Alert className="mb-4 border-destructive bg-destructive/10" data-testid="alert-offline">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              Está offline. {isEdit ? "Não é possível editar enquanto offline." : "O contacto será guardado localmente e sincronizado quando voltar online."}
            </AlertDescription>
          </Alert>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Nome completo"
                      className="h-12"
                      data-testid="input-nome"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Assigned User Field - Admin Only */}
            {isAdmin && (
              <FormField
                control={form.control}
                name="assignedUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Atribuído a</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger className="h-12" data-testid="select-assigned-user">
                          <SelectValue placeholder="Selecione um utilizador" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id} data-testid={`option-user-${user.id}`}>
                            {user.firstName && user.lastName 
                              ? `${user.firstName} ${user.lastName}`
                              : user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Utilizador responsável por este contacto
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="entidadeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entidade</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      // Convert __none__ to undefined immediately in form state
                      const normalizedValue = (value === "__none__" || !value) ? undefined : value;
                      field.onChange(normalizedValue);
                      handleEntidadeChange(value);
                    }} 
                    value={field.value || "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger className="h-12" data-testid="select-entidade">
                        <SelectValue placeholder="Opcional - Selecione se aplicável" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__" data-testid="option-entidade-none">
                        Sem entidade
                      </SelectItem>
                      {entidades?.map((entidade) => (
                        <SelectItem key={entidade.id} value={entidade.id} data-testid={`option-entidade-${entidade.id}`}>
                          {entidade.nome} {entidade.entidadeTipo && `(${entidade.entidadeTipo.nome})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Contactos podem existir sem entidade associada
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="funcao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Função</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder="Arquiteto, Diretor, etc."
                      className="h-12"
                      data-testid="input-funcao"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="telemovel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telemóvel</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      type="tel"
                      placeholder="+351 900 000 000"
                      className="h-12"
                      data-testid="input-telemovel"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      type="email"
                      placeholder="contacto@exemplo.com"
                      className="h-12"
                      data-testid="input-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="Notas adicionais sobre o contacto..."
                      className="min-h-24 resize-none"
                      data-testid="input-observacoes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="sticky bottom-20 pt-4">
              <Button
                type="submit"
                className="w-full h-12"
                disabled={isPending}
                data-testid="button-guardar"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    A guardar...
                  </>
                ) : (
                  "Guardar Contacto"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
