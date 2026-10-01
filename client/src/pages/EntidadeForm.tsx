import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, CheckCircle2, Loader2, WifiOff, MapPin, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useCurrentUser, useAllUsers, useIsAdmin } from "@/hooks/use-user-context";
import { insertEntidadeSchema, type InsertEntidade, type Entidade } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { syncManager } from "@/lib/syncManager";
import { GoogleCompanySearch } from "@/components/GoogleCompanySearch";
import { CountrySelect } from "@/components/CountrySelect";
import { fillEntityForm, parsePortugueseAddress, type PTEnrichmentResult } from "@/lib/enrichmentUtils";
import { useAuth } from "@/hooks/useAuth";
import { resolveEntityResearchSettings } from "@shared/entityResearch";
import { VIES_COUNTRY_CODES, stripCountryPrefix } from "@shared/countries";

interface VatValidationResponse {
  supported: boolean;
  valid: boolean | null;
  countryCode: string;
  vatNumber: string;
  name: string | null;
  address: string | null;
  requestDate: string | null;
}

interface PostalLookupResponse {
  postalCode: string;
  locality: string | null;
  postalDesignation: string | null;
  municipality: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  streets: Array<{ street: string; numbers: string[] }>;
  source?: "geoapi.pt" | "openstreetmap";
}

interface AddressSearchResult {
  displayName: string;
  street: string | null;
  houseNumber: string | null;
  city: string | null;
  postalCode: string | null;
  latitude: number;
  longitude: number;
}

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
  const { empresa } = useAuth();
  const { data: allUsers = [] } = useAllUsers();
  const isAdmin = useIsAdmin();
  const researchSettings = resolveEntityResearchSettings(empresa?.uiSettings);
  
  // Enrichment state
  const [isEnriching, setIsEnriching] = useState(false);
  const [vatResult, setVatResult] = useState<VatValidationResponse | null>(null);
  const [selectedPostalStreet, setSelectedPostalStreet] = useState("");
  const [addressResults, setAddressResults] = useState<AddressSearchResult[]>([]);

  // FASE 29: Fetch entity types
  const { data: entidadeTipos = [] } = useQuery<any[]>({
    queryKey: ["/api/entidade-tipos"],
  });

  const { data: entidade, isLoading: isEntidadeLoading } = useQuery<Entidade>({
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
      countryCode: "PT",
      selectedOdooPartnerId: null,
      validatedVatStatus: null,
      notas: "",
      latitude: "",
      longitude: "",
      proximityAlertsEnabled: false,
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
        countryCode: entidade.countryCode || "PT",
        selectedOdooPartnerId: entidade.odooPartnerId
          ? Number(entidade.odooPartnerId)
          : null,
        validatedVatStatus:
          entidade.vatValidationStatus === "valid" ||
          entidade.vatValidationStatus === "invalid"
            ? entidade.vatValidationStatus
            : null,
        notas: entidade.notas || "",
        latitude: entidade.latitude || "",
        longitude: entidade.longitude || "",
        proximityAlertsEnabled: entidade.proximityAlertsEnabled ?? false,
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

  useEffect(() => {
    if (!currentUser || isEdit) return;
    form.setValue("createdByUserId", currentUser.id);
    if (!form.getValues("assignedUserId")) {
      form.setValue("assignedUserId", currentUser.id);
    }
  }, [currentUser, form, isEdit]);

  useEffect(() => {
    if (isEdit || !empresa) return;
    if (!form.formState.dirtyFields.countryCode) {
      form.setValue("countryCode", researchSettings.defaultCountry);
    }
  }, [empresa, form, isEdit, researchSettings.defaultCountry]);

  const selectedCountry = form.watch("countryCode") || researchSettings.defaultCountry;
  const selectedPostalCode = form.watch("codigoPostal") || "";

  const postalLookup = useQuery<PostalLookupResponse>({
    queryKey: ["/api/enrichment/postal-code", selectedPostalCode],
    queryFn: async () => {
      const response = await fetch(
        `/api/enrichment/postal-code/${encodeURIComponent(selectedPostalCode)}`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Postal lookup failed");
      return response.json();
    },
    enabled:
      isOnline &&
      researchSettings.postalLookupEnabled &&
      selectedCountry === "PT" &&
      /^\d{4}-\d{3}$/.test(selectedPostalCode),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  const postalStreetNumbers =
    postalLookup.data?.streets.find((item) => item.street === selectedPostalStreet)
      ?.numbers ?? [];

  useEffect(() => {
    const postal = postalLookup.data;
    if (!postal) return;
    if (!form.getValues("cidade")) {
      form.setValue(
        "cidade",
        postal.locality || postal.postalDesignation || postal.municipality || "",
        { shouldDirty: true },
      );
    }
    if (!form.getValues("latitude") && postal.latitude !== null) {
      form.setValue("latitude", String(postal.latitude), { shouldDirty: true });
    }
    if (!form.getValues("longitude") && postal.longitude !== null) {
      form.setValue("longitude", String(postal.longitude), { shouldDirty: true });
    }
  }, [form, postalLookup.data]);

  const vatMutation = useMutation({
    mutationFn: async (input: { countryCode: string; vatNumber: string }) => {
      const response = await apiRequest("POST", "/api/enrichment/vat/validate", input);
      return response.json() as Promise<VatValidationResponse>;
    },
    onSuccess: (result) => {
      setVatResult(result);
      form.setValue(
        "validatedVatStatus",
        result.supported && result.valid !== null
          ? result.valid
            ? "valid"
            : "invalid"
          : null,
        { shouldDirty: true },
      );
    },
    onError: () => {
      setVatResult(null);
      form.setValue("validatedVatStatus", null);
      toast({
        title: "VIES indisponível",
        description: "Pode continuar a preencher e guardar a entidade manualmente.",
        variant: "destructive",
      });
    },
  });

  const addressMutation = useMutation({
    mutationFn: async () => {
      const address = String(form.getValues("morada") || "").trim();
      const city = String(form.getValues("cidade") || "").trim();
      const postalCode = String(form.getValues("codigoPostal") || "").trim();
      const query = [address, postalCode, city].filter(Boolean).join(", ");
      if (query.length < 5) throw new Error("Escreva uma morada mais completa.");

      const params = new URLSearchParams({ q: query, countryCode: selectedCountry });
      const response = await fetch(`/api/enrichment/address-search?${params}`, {
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Pesquisa de morada indisponível.");
      return (payload.results ?? []) as AddressSearchResult[];
    },
    onSuccess: (results) => {
      setAddressResults(results);
      if (results.length === 0) {
        toast({
          title: "Morada não encontrada",
          description: "Experimente acrescentar a localidade ou o código postal.",
        });
      }
    },
    onError: (error: Error) => {
      setAddressResults([]);
      toast({
        title: "Não foi possível pesquisar a morada",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const validateVat = () => {
    const taxNumber = String(form.getValues("nif") || "").trim();
    if (!taxNumber || !researchSettings.viesEnabled || !isOnline) return;
    const viesCountry = selectedCountry === "GR" ? "EL" : selectedCountry;
    if (!VIES_COUNTRY_CODES.has(viesCountry)) {
      setVatResult({
        supported: false,
        valid: null,
        countryCode: selectedCountry,
        vatNumber: taxNumber,
        name: null,
        address: null,
        requestDate: null,
      });
      return;
    }
    vatMutation.mutate({
      countryCode: selectedCountry,
      vatNumber: stripCountryPrefix(taxNumber, selectedCountry),
    });
  };

  const applyVatSuggestion = () => {
    if (!vatResult) return;
    if (vatResult.name && !form.getValues("nome")) {
      form.setValue("nome", vatResult.name, { shouldDirty: true });
    }
    if (vatResult.address && !form.getValues("morada")) {
      if (selectedCountry === "PT") {
        const parsed = parsePortugueseAddress(vatResult.address);
        if (parsed.morada) form.setValue("morada", parsed.morada, { shouldDirty: true });
        if (parsed.codigoPostal && !form.getValues("codigoPostal")) {
          form.setValue("codigoPostal", parsed.codigoPostal, { shouldDirty: true });
        }
        if (parsed.cidade && !form.getValues("cidade")) {
          form.setValue("cidade", parsed.cidade, { shouldDirty: true });
        }
      } else {
        form.setValue("morada", vatResult.address, { shouldDirty: true });
      }
    }
  };

  const applyPostalStreet = (street: string) => {
    setSelectedPostalStreet(street);
    form.setValue("morada", street, { shouldDirty: true });
  };

  const applyAddressResult = (result: AddressSearchResult) => {
    const address = [result.street, result.houseNumber].filter(Boolean).join(", ");
    form.setValue("morada", address || result.displayName, { shouldDirty: true });
    if (result.city) form.setValue("cidade", result.city, { shouldDirty: true });
    if (result.postalCode) {
      form.setValue("codigoPostal", result.postalCode, { shouldDirty: true });
    }
    form.setValue("latitude", String(result.latitude), { shouldDirty: true });
    form.setValue("longitude", String(result.longitude), { shouldDirty: true });
    setAddressResults([]);
  };

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

  const isPending =
    createMutation.isPending || updateMutation.isPending || !currentUser;

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
        {isEdit && isEntidadeLoading && !entidade ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>A carregar entidade...</span>
            </div>
          </div>
        ) : (
          <>
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

            {researchSettings.internationalEnabled && (
              <FormField
                control={form.control}
                name="countryCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>País</FormLabel>
                    <FormControl>
                      <CountrySelect
                        value={field.value || researchSettings.defaultCountry}
                        onChange={(countryCode) => {
                          field.onChange(countryCode);
                          setVatResult(null);
                          form.setValue("validatedVatStatus", null, { shouldDirty: true });
                        }}
                        testId="select-entity-country"
                      />
                    </FormControl>
                    <FormDescription>
                      Define o prefixo fiscal e os serviços de pesquisa disponíveis.
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
                  <FormLabel>Nome *</FormLabel>
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
                        existingEntityId={entidadeId}
                        countryCode={selectedCountry}
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
                  <FormLabel>{selectedCountry === "PT" ? "NIF" : "Identificação fiscal / VAT"}</FormLabel>
                  <div className="flex gap-2">
                    <div className="flex h-12 min-w-14 items-center justify-center rounded-md border bg-muted px-3 text-sm font-semibold">
                      {selectedCountry}
                    </div>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        onChange={(event) => {
                          field.onChange(event.target.value.toUpperCase());
                          setVatResult(null);
                          form.setValue("validatedVatStatus", null, { shouldDirty: true });
                        }}
                        onBlur={(event) => {
                          field.onBlur();
                          if (
                            (event.relatedTarget as HTMLElement | null)?.dataset.testid !==
                            "button-validate-vat"
                          ) {
                            validateVat();
                          }
                        }}
                        placeholder={selectedCountry === "PT" ? "000000000" : "Número fiscal"}
                        maxLength={50}
                        className="h-12"
                        data-testid="input-nif"
                      />
                    </FormControl>
                    {researchSettings.viesEnabled && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 shrink-0"
                        onClick={validateVat}
                        disabled={!field.value || !isOnline || vatMutation.isPending}
                        data-testid="button-validate-vat"
                      >
                        {vatMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="mr-2 h-4 w-4" />
                        )}
                        Validar
                      </Button>
                    )}
                  </div>
                  <FormDescription className="text-xs">
                    {selectedCountry === "PT"
                      ? "Número de Identificação Fiscal português (9 dígitos)."
                      : "Introduza o número sem o prefixo do país."}
                  </FormDescription>
                  {vatResult && !vatResult.supported && (
                    <Alert className="border-amber-300 bg-amber-50" data-testid="vat-unsupported">
                      <TriangleAlert className="h-4 w-4" />
                      <AlertDescription>
                        O VIES não valida este país. Pode confirmar e guardar os dados manualmente.
                      </AlertDescription>
                    </Alert>
                  )}
                  {vatResult?.supported && vatResult.valid === false && (
                    <Alert className="border-destructive/40 bg-destructive/5" data-testid="vat-invalid">
                      <TriangleAlert className="h-4 w-4" />
                      <AlertDescription>
                        O VIES não confirmou este número. Verifique-o antes de guardar.
                      </AlertDescription>
                    </Alert>
                  )}
                  {vatResult?.supported && vatResult.valid === true && (
                    <Alert className="border-emerald-300 bg-emerald-50" data-testid="vat-valid">
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                      <AlertDescription className="space-y-2">
                        <div>
                          <p className="font-medium text-emerald-900">Número confirmado pelo VIES.</p>
                          {vatResult.name && <p>{vatResult.name}</p>}
                          {vatResult.address && (
                            <p className="whitespace-pre-line text-xs">{vatResult.address}</p>
                          )}
                        </div>
                        {(vatResult.name || vatResult.address) && (
                          <Button type="button" size="sm" variant="outline" onClick={applyVatSuggestion}>
                            Aplicar apenas nos campos vazios
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
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
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        onChange={(event) => {
                          field.onChange(event.target.value);
                          setAddressResults([]);
                        }}
                        placeholder="Rua, número, andar"
                        className="h-12"
                        data-testid="input-morada"
                      />
                    </FormControl>
                    {researchSettings.postalLookupEnabled && isOnline && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 shrink-0"
                        onClick={() => addressMutation.mutate()}
                        disabled={!field.value || addressMutation.isPending}
                        data-testid="button-search-address"
                      >
                        {addressMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="mr-2 h-4 w-4" />
                        )}
                        Pesquisar
                      </Button>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {addressResults.length > 0 && (
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border bg-card p-2" data-testid="address-search-results">
                {addressResults.map((result) => (
                  <button
                    key={`${result.latitude}-${result.longitude}-${result.displayName}`}
                    type="button"
                    className="w-full rounded-md p-3 text-left text-sm hover:bg-muted"
                    onClick={() => applyAddressResult(result)}
                  >
                    <span className="block font-medium">{result.displayName}</span>
                    <span className="text-xs text-muted-foreground">Fonte: OpenStreetMap</span>
                  </button>
                ))}
              </div>
            )}

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
                        onChange={(event) => {
                          const input = event.target.value;
                          const digits = input.replace(/\D/g, "").slice(0, 7);
                          const formatted =
                            digits.length > 4
                              ? `${digits.slice(0, 4)}-${digits.slice(4)}`
                              : digits;
                          field.onChange(formatted);
                          setSelectedPostalStreet("");
                        }}
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

            {researchSettings.postalLookupEnabled && selectedCountry === "PT" && (
              <div className="space-y-2" data-testid="postal-lookup-results">
                {postalLookup.isFetching && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A procurar o código postal no GeoAPI.pt...
                  </p>
                )}
                {postalLookup.isError && /^\d{4}-\d{3}$/.test(selectedPostalCode) && (
                  <p className="text-sm text-muted-foreground">
                    Não foi possível consultar este código postal. Pode continuar manualmente.
                  </p>
                )}
                {postalLookup.data && postalLookup.data.streets.length > 0 && (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                    <div>
                      <p className="text-sm font-medium">Moradas encontradas</p>
                      <p className="text-xs text-muted-foreground">
                        Selecione a rua e, quando disponível, o número de porta.
                      </p>
                    </div>
                    <Select value={selectedPostalStreet} onValueChange={applyPostalStreet}>
                      <SelectTrigger data-testid="select-postal-street">
                        <SelectValue placeholder="Selecionar rua" />
                      </SelectTrigger>
                      <SelectContent>
                        {postalLookup.data.streets.map((item) => (
                          <SelectItem key={item.street} value={item.street}>
                            {item.street}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedPostalStreet && postalStreetNumbers.length > 0 && (
                      <Select
                        onValueChange={(number) => {
                          form.setValue("morada", `${selectedPostalStreet}, ${number}`, {
                            shouldDirty: true,
                          });
                        }}
                      >
                        <SelectTrigger data-testid="select-postal-number">
                          <SelectValue placeholder="Selecionar número de porta" />
                        </SelectTrigger>
                        <SelectContent>
                          {postalStreetNumbers.map((number) => (
                            <SelectItem key={number} value={number}>{number}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-[11px] text-muted-foreground">Fonte: GeoAPI.pt</p>
                  </div>
                )}
                {postalLookup.data && postalLookup.data.streets.length === 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm" data-testid="postal-locality-result">
                    <p className="font-medium">
                      {postalLookup.data.locality ||
                        postalLookup.data.postalDesignation ||
                        "Código postal encontrado"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Localidade e coordenadas preenchidas. Complete a rua manualmente ou use “Pesquisar” na morada.
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Fonte: OpenStreetMap</p>
                  </div>
                )}
              </div>
            )}

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
              {(form.watch("latitude") && form.watch("longitude")) && (
                <FormField
                  control={form.control}
                  name="proximityAlertsEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-3 rounded-lg border p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-entity-proximity-alert"
                        />
                      </FormControl>
                      <div>
                        <FormLabel>Avisar quando estiver por perto</FormLabel>
                        <FormDescription>
                          Mostra tarefas atrasadas ou períodos longos sem visita nesta entidade.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              )}
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
          </>
        )}
      </main>
    </div>
  );
}
