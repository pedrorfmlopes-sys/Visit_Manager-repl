import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Loader2, WifiOff, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useCurrentUser, useAllUsers, useIsAdmin } from "@/hooks/use-user-context";
import { insertEntidadeSchema, type InsertEntidade, type Entidade } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { syncManager } from "@/lib/syncManager";
import { GoogleCompanySearch } from "@/components/GoogleCompanySearch";
import { fillEntityForm, type PTEnrichmentResult } from "@/lib/enrichmentUtils";

export default function EntidadeForm() {
  const [, setLocation] = useLocation();
  const [, editParams] = useRoute("/entidades/:id/editar");
  const [, createParams] = useRoute("/entidades/nova");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { location: gpsLocation, isLoading: gpsLoading, requestLocation } = useGeolocation();
  const isEdit = !!editParams?.id;
  const entidadeId = editParams?.id;
  
  // User context for multi-agent system
  const { data: currentUser } = useCurrentUser();
  const { data: allUsers = [] } = useAllUsers();
  const isAdmin = useIsAdmin();
  
  // Enrichment state
  const [isEnriching, setIsEnriching] = useState(false);

  // FASE 29: Fetch entity types
  const { data: entidadeTipos = [] } = useQuery({
    queryKey: ["/api/entidade-tipos"],
  });

  const { data: entidade } = useQuery<Entidade>({
    queryKey: ["/api/entidades", entidadeId],
    enabled: !!entidadeId,
  });

  const form = useForm<InsertEntidade>({
    resolver: zodResolver(insertEntidadeSchema),
    defaultValues: {
      entidadeTipoId: null,
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
      // Enrichment fields
      logoUrl: "",
      domain: "",
      industry: "",
      descricao: "",
      linkedinUrl: "",
      facebookUrl: "",
      twitterUrl: "",
      instagramUrl: "",
      // Ownership
      createdByUserId: currentUser?.id,
      assignedUserId: currentUser?.id, // Default to current user
    },
  });

  // PASSO DEBUG: Reset form quando entidade chega (edição)
  useEffect(() => {
    if (entidade) {
      console.log("[EntidadeForm] Resetting form com entidade:", entidade);
      console.log("[EntidadeForm] entidade.entidadeTipoId:", entidade.entidadeTipoId);
      form.reset({
        entidadeTipoId: entidade.entidadeTipoId ?? null,
        nome: entidade.nome,
        morada: entidade.morada || "",
        codigoPostal: entidade.codigoPostal || "",
        cidade: entidade.cidade || "",
        telefone: entidade.telefone || "",
        email: entidade.email || "",
        website: entidade.website || "",
        nif: entidade.nif || "",
        notas: entidade.notas || "",
        latitude: entidade.latitude || "",
        longitude: entidade.longitude || "",
        logoUrl: entidade.logoUrl || "",
        domain: entidade.domain || "",
        industry: entidade.industry || "",
        descricao: entidade.descricao || "",
        linkedinUrl: entidade.linkedinUrl || "",
        facebookUrl: entidade.facebookUrl || "",
        twitterUrl: entidade.twitterUrl || "",
        instagramUrl: entidade.instagramUrl || "",
        createdByUserId: entidade.createdByUserId,
        assignedUserId: entidade.assignedUserId,
      });
    }
  }, [entidade, form]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertEntidade) => {
      console.log('[EntidadeForm] Creating with data:', data);
      console.log('[EntidadeForm] logoUrl value:', data.logoUrl);
      console.log('[EntidadeForm] domain value:', data.domain);
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
      console.log('[EntidadeForm UPDATE] data a enviar:', data);
      console.log('[EntidadeForm UPDATE] entidadeTipoId:', data.entidadeTipoId);
      console.log('[EntidadeForm UPDATE] nome:', data.nome);
      await apiRequest("PATCH", `/api/entidades/${entidadeId}`, data);
    },
    onSuccess: () => {
      console.log('[EntidadeForm UPDATE] Sucesso! Invalidando cache...');
      queryClient.invalidateQueries({ queryKey: ["/api/entidades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entidades", entidadeId] });
      toast({
        title: "Sucesso",
        description: "Entidade atualizada com sucesso",
      });
      setLocation(`/entidades/${entidadeId}`);
    },
    onError: (error: Error) => {
      console.error('[EntidadeForm UPDATE] Erro:', error);
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
    // Guard: Prevent submission until user context loads
    if (!currentUser) {
      toast({
        title: "A carregar...",
        description: "Por favor aguarde enquanto carregamos os seus dados.",
        variant: "destructive",
      });
      return;
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

  // PT Enrichment handlers
  const handlePTCompanySelect = async (enrichmentData: PTEnrichmentResult) => {
    setIsEnriching(true);
    
    try {
      fillEntityForm(form, enrichmentData, { overwriteExisting: false });
      
      toast({
        title: "Dados preenchidos",
        description: enrichmentData.enrichmentSource === 'fuzzy' 
          ? "Empresa encontrada na base de dados" 
          : enrichmentData.enrichmentSource === 'webscan'
          ? "Dados obtidos da pesquisa online (IA)"
          : "Dados combinados de múltiplas fontes",
      });
    } catch (error) {
      console.error('[EntidadeForm] PT enrichment error:', error);
      toast({
        title: "Erro",
        description: "Erro ao preencher dados da empresa",
        variant: "destructive",
      });
    } finally {
      setIsEnriching(false);
    }
  };

  // @deprecated Legacy autocomplete handler (use handlePTCompanySelect instead)
  const handleCompanySelect = async (company: { name: string; domain: string; logo: string }) => {
    form.setValue("domain", company.domain);
    form.setValue("logoUrl", undefined);
    form.setValue("website", `https://${company.domain}`);
    
    if (!isOnline) {
      toast({
        title: "Dados básicos preenchidos",
        description: "Enriquecimento adicional não disponível offline.",
      });
      return;
    }

    setIsEnriching(true);
    try {
      const response = await fetch('/api/enrichment/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: company.name, domain: company.domain }),
        credentials: 'include',
      });

      if (response.ok) {
        const enrichedData = await response.json();
        
        // Auto-fill additional fields from AI enrichment
        if (enrichedData.email) form.setValue("email", enrichedData.email);
        if (enrichedData.telefone) form.setValue("telefone", enrichedData.telefone);
        if (enrichedData.morada) form.setValue("morada", enrichedData.morada);
        if (enrichedData.cidade) form.setValue("cidade", enrichedData.cidade);
        if (enrichedData.industry) form.setValue("industry", enrichedData.industry);
        if (enrichedData.descricao) form.setValue("descricao", enrichedData.descricao);
        if (enrichedData.linkedinUrl) form.setValue("linkedinUrl", enrichedData.linkedinUrl);
        if (enrichedData.facebookUrl) form.setValue("facebookUrl", enrichedData.facebookUrl);
        if (enrichedData.twitterUrl) form.setValue("twitterUrl", enrichedData.twitterUrl);
        if (enrichedData.instagramUrl) form.setValue("instagramUrl", enrichedData.instagramUrl);
        
        toast({
          title: "Dados enriquecidos",
          description: `Informações de ${company.name} preenchidas automaticamente.`,
        });
      } else {
        // Enrichment failed
        toast({
          title: "Dados básicos preenchidos",
          description: "Enriquecimento adicional falhou, mas informações básicas foram preenchidas.",
        });
      }
    } catch (error) {
      console.error('[Enrichment] Error:', error);
      toast({
        title: "Dados básicos preenchidos",
        description: "Informações básicas da empresa foram preenchidas.",
      });
    } finally {
      setIsEnriching(false);
    }
  };

  const handleManualEnrich = async () => {
    const entityName = form.getValues("nome");
    
    if (!entityName) {
      toast({
        title: "Nome necessário",
        description: "Preencha o nome da entidade primeiro.",
        variant: "destructive",
      });
      return;
    }

    if (!isOnline) {
      toast({
        title: "Modo Offline",
        description: "Enriquecimento automático não disponível offline.",
        variant: "destructive",
      });
      return;
    }

    setIsEnriching(true);
    try {
      const response = await fetch('/api/enrichment/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: entityName }),
        credentials: 'include',
      });

      if (response.ok) {
        const enrichedData = await response.json();
        
        // Auto-fill form fields with enriched data
        if (enrichedData.website) form.setValue("website", enrichedData.website);
        if (enrichedData.email) form.setValue("email", enrichedData.email);
        if (enrichedData.telefone) form.setValue("telefone", enrichedData.telefone);
        if (enrichedData.morada) form.setValue("morada", enrichedData.morada);
        if (enrichedData.cidade) form.setValue("cidade", enrichedData.cidade);
        
        toast({
          title: "Dados atualizados",
          description: "Informações atualizadas da web.",
        });
      }
    } catch (error) {
      console.error('[Enrichment] Error:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsEnriching(false);
    }
  };

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
              name="entidadeTipoId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entidade</FormLabel>
                  <Select
                    onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger className="h-12" data-testid="select-entidade-tipo-id">
                        <SelectValue placeholder="Selecione o tipo ou deixe em branco" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sem tipo</SelectItem>
                      {entidadeTipos.map((tipo) => (
                        <SelectItem key={tipo.id} value={tipo.id} data-testid={`option-tipo-${tipo.id}`}>
                          {tipo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {entidadeTipos.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Sem tipos definidos – configure em Definições → Entidades
                    </p>
                  )}
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
                      Utilizador responsável por esta entidade
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-2">
                    <FormLabel>Nome *</FormLabel>
                    {isEdit && isOnline && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleManualEnrich}
                        disabled={isEnriching || !field.value}
                        className="h-8"
                        data-testid="button-refresh-web"
                      >
                        {isEnriching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        <span className="ml-1">Atualizar da Web</span>
                      </Button>
                    )}
                  </div>
                  <FormControl>
                    {isEdit ? (
                      <Input
                        {...field}
                        placeholder="Nome da entidade"
                        className="h-12"
                        data-testid="input-nome"
                      />
                    ) : (
                      <GoogleCompanySearch
                        value={field.value}
                        onChange={field.onChange}
                        onSelect={handlePTCompanySelect}
                        placeholder="Nome da empresa..."
                        className="h-12"
                      />
                    )}
                  </FormControl>
                  {!isOnline && !isEdit && (
                    <FormDescription className="text-xs text-muted-foreground">
                      Pesquisa inteligente funciona offline usando dados locais
                    </FormDescription>
                  )}
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
