import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Loader2, WifiOff, Building2, Users, Package, Construction, Briefcase, HandHeart, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useGeolocation } from "@/hooks/useGeolocation";
import { insertEntidadeSchema, type InsertEntidade, type Entidade } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { syncManager } from "@/lib/syncManager";

const tipoOptions = [
  { value: "Gabinete", label: "Gabinete", icon: Building2 },
  { value: "Cliente", label: "Cliente", icon: Users },
  { value: "Distribuidor", label: "Distribuidor", icon: Package },
  { value: "Obra", label: "Obra", icon: Construction },
  { value: "Parceiro", label: "Parceiro", icon: Briefcase },
  { value: "Outro", label: "Outro", icon: HandHeart },
];

export default function EntidadeForm() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/entidades/:id");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { location: gpsLocation, isLoading: gpsLoading, requestLocation } = useGeolocation();
  const isEdit = params?.id && params.id !== "nova" && params.id !== "editar";

  const { data: entidade } = useQuery<Entidade>({
    queryKey: ["/api/entidades", params?.id],
    enabled: !!isEdit,
  });

  const form = useForm<InsertEntidade>({
    resolver: zodResolver(insertEntidadeSchema),
    defaultValues: entidade || {
      tipoEntidade: "Gabinete",
      nome: "",
      morada: "",
      codigoPostal: "",
      cidade: "",
      telefone: "",
      email: "",
      website: "",
      nif: "",
      notas: "",
      latitude: "",
      longitude: "",
    },
    values: entidade,
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertEntidade) => {
      await apiRequest("POST", "/api/entidades", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entidades"] });
      toast({
        title: "Sucesso",
        description: "Entidade criada com sucesso",
      });
      setLocation("/entidades");
    },
    onError: async (error: Error, data) => {
      const isNetworkError = error.message.includes('fetch') || 
                            error.message.includes('NetworkError') ||
                            error.message.includes('Failed to fetch') ||
                            !navigator.onLine;
      
      if (isNetworkError) {
        await syncManager.queueEntidadeCreation(data);
        toast({
          title: "Entidade guardada",
          description: "Será sincronizada automaticamente quando voltar online.",
        });
        setLocation("/entidades");
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
        description: "Não foi possível criar a entidade",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertEntidade) => {
      await apiRequest("PATCH", `/api/entidades/${params?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entidades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entidades", params?.id] });
      toast({
        title: "Sucesso",
        description: "Entidade atualizada com sucesso",
      });
      setLocation(`/entidades/${params?.id}`);
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
        description: "Não foi possível atualizar a entidade",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: InsertEntidade) => {
    if (!isOnline && !isEdit) {
      await syncManager.queueEntidadeCreation(data);
      toast({
        title: "Entidade guardada",
        description: "Será sincronizada automaticamente quando voltar online.",
      });
      setLocation("/entidades");
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

  const handleCaptureLocation = () => {
    requestLocation();
  };

  // Update form when GPS location changes
  if (gpsLocation && !form.getValues("latitude")) {
    form.setValue("latitude", gpsLocation.latitude);
    form.setValue("longitude", gpsLocation.longitude);
    toast({
      title: "Localização capturada",
      description: `GPS: ${parseFloat(gpsLocation.latitude).toFixed(6)}, ${parseFloat(gpsLocation.longitude).toFixed(6)}`,
    });
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/entidades")}
            data-testid="button-voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">
            {isEdit ? "Editar Entidade" : "Nova Entidade"}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {!isOnline && (
          <Alert className="mb-4 border-destructive bg-destructive/10" data-testid="alert-offline">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              Está offline. {isEdit ? "Não é possível editar enquanto offline." : "A entidade será guardada localmente e sincronizada quando voltar online."}
            </AlertDescription>
          </Alert>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="tipoEntidade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Entidade *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12" data-testid="select-tipo-entidade">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tipoOptions.map((option) => {
                        const Icon = option.icon;
                        return (
                          <SelectItem key={option.value} value={option.value} data-testid={`option-tipo-${option.value}`}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {option.label}
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

            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Nome da entidade"
                      className="h-12"
                      data-testid="input-nome"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nif"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NIF</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder="000000000"
                      maxLength={9}
                      className="h-12"
                      data-testid="input-nif"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Número de Identificação Fiscal (9 dígitos)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="morada"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Morada</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder="Rua, número, andar"
                      className="h-12"
                      data-testid="input-morada"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="codigoPostal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código Postal</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="0000-000"
                        className="h-12"
                        data-testid="input-codigo-postal"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="Lisboa"
                        className="h-12"
                        data-testid="input-cidade"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <FormLabel>Geolocalização</FormLabel>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="Latitude"
                          className="h-12"
                          data-testid="input-latitude"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="Longitude"
                          className="h-12"
                          data-testid="input-longitude"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCaptureLocation}
                disabled={gpsLoading}
                className="w-full"
                data-testid="button-capturar-gps"
              >
                {gpsLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    A capturar localização...
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Capturar GPS Atual
                  </>
                )}
              </Button>
            </div>

            <FormField
              control={form.control}
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      type="tel"
                      placeholder="+351 000 000 000"
                      className="h-12"
                      data-testid="input-telefone"
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
                      placeholder="entidade@exemplo.com"
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
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      type="url"
                      placeholder="https://exemplo.com"
                      className="h-12"
                      data-testid="input-website"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="Notas adicionais sobre a entidade..."
                      className="min-h-24 resize-none"
                      data-testid="input-notas"
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
                  "Guardar Entidade"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
