import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Loader2, Calendar as CalendarIcon, Upload, X, WifiOff, Plus, Mic, Volume2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useCurrentUser, useAllUsers, useIsAdmin } from "@/hooks/use-user-context";
import { useAuth } from "@/hooks/useAuth";
import { useAudioTranscription } from "@/hooks/useAudioTranscription";
import { LocationPreview } from "@/components/LocationPreview";
import { insertVisitaSchema, type InsertVisita, type Entidade, type Contacto, type InsertTarefa, type Marca } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { syncManager } from "@/lib/syncManager";
import { offlineStorage } from "@/lib/offlineStorage";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";

const visitaFormSchema = insertVisitaSchema.extend({
  entidadeId: z.string().min(1, "Selecione uma entidade"),
  dataVisita: z.date(),
  marcasIds: z.array(z.string()).optional(),
  contactosIds: z.array(z.string()).optional(), // FASE 3: Multiple contacts per visit
});

type VisitaFormData = z.infer<typeof visitaFormSchema>;

export default function VisitaForm() {
  const [location, setLocation] = useLocation();
  const [, params] = useRoute("/visitas/:id");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  
  // Extract ID from URL path (works for both /visitas/:id and /visitas/:id/editar)
  const visitaIdFromPath = location.split('/')[2]; // Get ID from /visitas/ID/...
  const visitaId = params?.id || (visitaIdFromPath && visitaIdFromPath !== "nova" ? visitaIdFromPath : null);
  const isEdit = visitaId && visitaId !== "nova";
  
  // Get pre-fill data from query params (FASE 15: follow-up visits)
  const queryParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const prefillData = {
    visitaAnteriorId: queryParams.get('visitaAnteriorId') || '',
    dataVisita: queryParams.get('dataVisita') ? new Date(queryParams.get('dataVisita')!) : null,
    entidadeId: queryParams.get('entidadeId') || '',
    contactoId: queryParams.get('contactoId') || '',
    entidadeName: queryParams.get('entidadeName') || '',
    contactoName: queryParams.get('contactoName') || '',
    visitaAnteriorData: queryParams.get('visitaAnteriorData') ? new Date(queryParams.get('visitaAnteriorData')!) : null,
    resumoVisitaAnterior: queryParams.get('resumoVisitaAnterior') || '',
  };
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const { location: gpsLocation, error: gpsError, isLoading: gpsLoading, requestLocation } = useGeolocation(true);
  
  // FASE-AUDIO-CORE-02: Use unified audio transcription hook
  const audio = useAudioTranscription();
  
  // Task creation state
  const [createTask, setCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState<Date | undefined>(undefined);
  
  // Marcas search state (FASE 5 UI update)
  const [marcasSearch, setMarcasSearch] = useState("");
  
  // FASE 3: Contactos search state
  const [contactosSearch, setContactosSearch] = useState("");
  
  // User context for multi-agent system
  const { data: currentUser } = useCurrentUser();
  const { data: allUsers = [] } = useAllUsers();
  const isAdmin = useIsAdmin();
  const { empresa } = useAuth();

  // Refetch auth user when VisitaForm loads to ensure fresh empresa data
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  }, [queryClient]);

  // Debug logging for Marcas feature
  useEffect(() => {
    if (empresa) {
      console.log("VisitaForm: empresa loaded", {
        empresaId: empresa.id,
        mostrarMarcasEmVisitas: empresa.mostrarMarcasEmVisitas,
      });
    } else {
      console.log("VisitaForm: empresa is undefined or loading");
    }
  }, [empresa]);

  const { data: entidades } = useQuery<Entidade[]>({
    queryKey: ["/api/entidades"],
  });

  const { data: contactos } = useQuery<Contacto[]>({
    queryKey: ["/api/contactos"],
  });

  const { data: marcas = [] } = useQuery<Marca[]>({
    queryKey: ["/api/marcas", "onlyAtivas"],
    queryFn: async () => {
      const response = await fetch("/api/marcas?onlyAtivas=true", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch marcas");
      return response.json();
    },
    enabled: empresa?.mostrarMarcasEmVisitas ?? false,
  });

  // Load existing visit data when in edit mode
  const { data: existingVisita } = useQuery({
    queryKey: ["/api/visitas", visitaId],
    enabled: !!isEdit,
  });

  // Build prefilled notes with header (FASE 15: use HTML paragraphs for RichTextEditor)
  const notasComResumo = prefillData.resumoVisitaAnterior && prefillData.visitaAnteriorData
    ? `<p></p><p></p><p><strong>***** Resumo da Visita Anterior, efetuada dia ${format(new Date(prefillData.visitaAnteriorData), "dd/MM/yyyy", { locale: pt })} *****</strong></p><p></p><p>${prefillData.resumoVisitaAnterior}</p>`
    : prefillData.resumoVisitaAnterior || "";

  const form = useForm<VisitaFormData>({
    resolver: zodResolver(visitaFormSchema),
    defaultValues: isEdit && existingVisita ? {
      entidadeId: existingVisita.entidadeId || "",
      dataVisita: new Date(existingVisita.dataVisita),
      notas: existingVisita.notas || "",
      marcasEntregues: existingVisita.marcasEntregues || [],
      marcasIds: existingVisita.visitasMarcas?.map((vm: any) => vm.marca.id) || [],
      // FASE 3: Load contactosPresentes from API response
      contactosIds: existingVisita.contactosPresentes?.map((c: any) => c.id) || [],
      proximaVisita: existingVisita.proximaVisita ? new Date(existingVisita.proximaVisita) : undefined,
    } : {
      entidadeId: prefillData.entidadeId || "",
      dataVisita: prefillData.dataVisita || new Date(),
      notas: notasComResumo,
      marcasEntregues: [],
      marcasIds: [],
      contactosIds: [],
      proximaVisita: undefined,
    },
    values: isEdit && existingVisita ? {
      entidadeId: existingVisita.entidadeId || "",
      dataVisita: new Date(existingVisita.dataVisita),
      notas: existingVisita.notas || "",
      marcasEntregues: existingVisita.marcasEntregues || [],
      marcasIds: existingVisita.visitasMarcas?.map((vm: any) => vm.marca.id) || [],
      // FASE 3: Load contactosPresentes from API response
      contactosIds: existingVisita.contactosPresentes?.map((c: any) => c.id) || [],
      proximaVisita: existingVisita.proximaVisita ? new Date(existingVisita.proximaVisita) : undefined,
    } : undefined,
  });

  const selectedEntidadeId = form.watch("entidadeId");
  const selectedMarcasIds = form.watch("marcasIds") || [];
  const selectedContactosIds = form.watch("contactosIds") || [];
  const filteredContactos = contactos?.filter(c => c.entidadeId === selectedEntidadeId);

  const updateMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      // Convert FormData to JSON for PATCH (unlike POST which uses FormData for file uploads)
      const jsonData: any = {
        entidadeId: formData.get("entidadeId"),
        dataVisita: formData.get("dataVisita"),
        notas: formData.get("notas") || null,
        marcasEntregues: formData.get("marcasEntregues") ? JSON.parse(formData.get("marcasEntregues") as string) : [],
      };
      
      // FASE 3: Add contactosIds if provided
      if (formData.get("contactosIds")) {
        jsonData.contactosIds = JSON.parse(formData.get("contactosIds") as string);
      }
      
      const response = await fetch(`/api/visitas/${visitaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jsonData),
        credentials: "include",
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status}: ${text}`);
      }
      
      return response.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/visitas", visitaId] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      
      toast({
        title: "Sucesso",
        description: "Visita atualizada com sucesso!",
      });
      
      setLocation(`/visitas/${visitaId}`);
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
        description: "Não foi possível atualizar a visita",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/visitas", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status}: ${text}`);
      }
      
      return response.json();
    },
    onSuccess: async (visitaData) => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitas"] });
      
      // FASE 15: Refetch previous visit query and its posteriores if this is a follow-up visit
      // IMPORTANT: Must await these refetches before navigating so the component can render updated data
      const visitaAnteriorId = new URLSearchParams(window.location.search).get('visitaAnteriorId');
      if (visitaAnteriorId) {
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ["/api/visitas", visitaAnteriorId] }),
          queryClient.refetchQueries({ queryKey: ["/api/visitas", visitaAnteriorId, "posteriores"] }),
        ]);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entidades"] });
      queryClient.refetchQueries({ queryKey: ["/api/entidades"] });
      
      // Create task if requested
      if (createTask && taskTitle) {
        if (!currentUser) {
          toast({
            title: "Aviso",
            description: "Visita criada mas tarefa não foi criada (login necessário).",
            variant: "destructive",
          });
        } else {
          try {
            const tarefaData = {
              titulo: taskTitle,
              descricao: taskDescription || null,
              visitaId: visitaData.id,
              entidadeId: form.getValues("entidadeId") || undefined,
              dueDate: taskDueDate || null,
              repeatInterval: "none" as const,
              status: "pending" as const,
            };
            
            await apiRequest("POST", "/api/tarefas", tarefaData);
            queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
            
            toast({
              title: "Sucesso",
              description: "Visita e tarefa criadas com sucesso! A processar IA...",
            });
          } catch (error) {
            console.error("Failed to create task:", error);
            toast({
              title: "Atenção",
              description: "Visita criada mas falhou a criação da tarefa.",
              variant: "destructive",
            });
          }
        }
      } else {
        toast({
          title: "Sucesso",
          description: "Visita criada com sucesso! A processar IA...",
        });
      }
      
      // FASE 15: If this is a follow-up visit, navigate back to anterior visit, otherwise to list
      const visitaAnteriorIdNav = new URLSearchParams(window.location.search).get('visitaAnteriorId');
      if (visitaAnteriorIdNav) {
        // Wait a bit to ensure queries are refetched before navigating
        await new Promise(resolve => setTimeout(resolve, 500));
        setLocation(`/visitas/${visitaAnteriorIdNav}`);
      } else {
        setLocation("/visitas");
      }
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
        description: "Não foi possível criar a visita",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: VisitaFormData) => {
    // Guard: Prevent submission until user context loads
    if (!currentUser) {
      toast({
        title: "A carregar...",
        description: "Por favor aguarde enquanto carregamos os seus dados.",
        variant: "destructive",
      });
      return;
    }
    
    // Set ownership fields (currentUser now guaranteed to exist)
    const createdByUserId = currentUser.id;
    // For non-admins, ALWAYS use current user. For admins, use selected value or default to current user
    const assignedUserId = (!isAdmin || !data.assignedUserId) ? currentUser.id : data.assignedUserId;
    
    // Offline mode - queue for sync
    if (!isOnline) {
      if (audioFile || mediaFiles.length > 0) {
        toast({
          title: "Modo Offline",
          description: "Ficheiros de áudio/media não serão enviados. Notas serão sincronizadas quando voltar online.",
          variant: "destructive",
        });
      }

      const visitaData = {
        entidadeId: data.entidadeId,
        dataVisita: data.dataVisita.toISOString(),
        notas: data.notas || null,
        proximaVisita: data.proximaVisita?.toISOString() || null,
        marcasEntregues: data.marcasEntregues || [],
        latitude: gpsLocation?.latitude || null,
        longitude: gpsLocation?.longitude || null,
        locationAccuracy: gpsLocation?.accuracy || null,
        createdByUserId: createdByUserId || null,
        assignedUserId: assignedUserId || null,
        visitaAnteriorId: prefillData.visitaAnteriorId || null,
        contactosIds: data.contactosIds || [],
      };

      await syncManager.queueVisitaCreation(visitaData);
      
      toast({
        title: "Visita guardada",
        description: "Será sincronizada automaticamente quando voltar online.",
      });
      
      setLocation("/visitas");
      return;
    }

    // Online mode - normal submission
    const formData = new FormData();
    
    formData.append("entidadeId", data.entidadeId);
    formData.append("dataVisita", data.dataVisita.toISOString());
    if (data.notas) formData.append("notas", data.notas);
    if (data.proximaVisita) formData.append("proximaVisita", data.proximaVisita.toISOString());
    if (data.marcasEntregues) formData.append("marcasEntregues", JSON.stringify(data.marcasEntregues));
    if (data.marcasIds && data.marcasIds.length > 0) formData.append("marcasIds", JSON.stringify(data.marcasIds));
    // FASE 3: Send contactosIds array instead of single contactoId
    if (data.contactosIds && data.contactosIds.length > 0) formData.append("contactosIds", JSON.stringify(data.contactosIds));
    
    // FASE 15: Add visitaAnteriorId if this is a follow-up visit
    if (prefillData.visitaAnteriorId) {
      formData.append("visitaAnteriorId", prefillData.visitaAnteriorId);
    }
    
    // Add ownership fields
    if (createdByUserId) formData.append("createdByUserId", createdByUserId);
    if (assignedUserId) formData.append("assignedUserId", assignedUserId);
    
    // Add GPS location if available (only send if we have valid coordinates)
    if (gpsLocation && gpsLocation.latitude && gpsLocation.longitude) {
      formData.append("latitude", gpsLocation.latitude);
      formData.append("longitude", gpsLocation.longitude);
      formData.append("locationAccuracy", gpsLocation.accuracy);
    }
    
    if (audioFile) {
      formData.append("audio", audioFile);
    }
    
    mediaFiles.forEach((file) => {
      formData.append("media", file);
    });
    
    // Submit visita form - use update or create depending on mode
    if (isEdit) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setMediaFiles(prev => [...prev, ...files].slice(0, 5));
  };


  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/visitas")}
            data-testid="button-voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">
            {isEdit ? "Editar Visita" : "Nova Visita"}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {!isOnline && (
          <Alert className="mb-4 border-destructive bg-destructive/10" data-testid="alert-offline">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              Está offline. A visita será guardada localmente e sincronizada automaticamente quando voltar online. 
              {(audioFile || mediaFiles.length > 0) && " Ficheiros de áudio/media não serão enviados."}
            </AlertDescription>
          </Alert>
        )}
        
        {/* FASE 15: Reference to previous visit */}
        {prefillData.visitaAnteriorId && (
          <Card className="mb-4 bg-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Referência da Visita Anterior
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Entidade:</span>
                <p className="font-medium">{prefillData.entidadeName || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Contacto:</span>
                <p className="font-medium">{prefillData.contactoName || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Data anterior:</span>
                <p className="font-medium">{prefillData.visitaAnteriorData ? format(new Date(prefillData.visitaAnteriorData), "PPP", { locale: pt }) : "—"}</p>
              </div>
              {prefillData.resumoVisitaAnterior && (
                <div>
                  <span className="text-muted-foreground">Resumo anterior:</span>
                  <p className="font-medium text-xs line-clamp-2 mt-1">{prefillData.resumoVisitaAnterior}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="entidadeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entidade *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12" data-testid="select-entidade">
                        <SelectValue placeholder="Selecione a entidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {entidades?.map((entidade) => (
                        <SelectItem key={entidade.id} value={entidade.id}>
                          {entidade.nome} {entidade.entidadeTipo && `(${entidade.entidadeTipo.nome})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* FASE 1 (Fase 0+): Multiple/Single contacts selector based on multiContactosEnabled flag */}
            <FormField
              control={form.control}
              name="contactosIds"
              render={({ field }) => {
                const multiContactosEnabled = empresa?.uiSettings?.visitas?.multiContactosEnabled ?? false;
                
                return (
                  <FormItem>
                    <FormLabel>
                      {multiContactosEnabled ? "Contactos presentes na visita" : "Contacto da visita"}
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                          disabled={!selectedEntidadeId}
                          data-testid="button-contactos-dropdown"
                        >
                          {field.value?.length
                            ? multiContactosEnabled
                              ? `${field.value.length} contacto${field.value.length === 1 ? "" : "s"} selecionado${field.value.length === 1 ? "" : "s"}`
                              : field.value[0] ? (contactos?.find(c => c.id === field.value[0])?.nome || "Contacto selecionado") : "Selecione um contacto"
                            : selectedEntidadeId 
                              ? (multiContactosEnabled ? "Seleciona um ou mais contactos" : "Selecione um contacto")
                              : "Selecione primeiro a entidade"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" side="bottom" align="start">
                        {selectedEntidadeId && (
                          <>
                            <div className="p-3 border-b">
                              <Input
                                placeholder="Pesquisar contactos..."
                                value={contactosSearch}
                                onChange={(e) => setContactosSearch(e.target.value)}
                                className="h-8"
                                data-testid="input-contactos-search"
                              />
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                              {filteredContactos && filteredContactos.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                  Nenhum contacto disponível para esta entidade
                                </div>
                              ) : (
                                filteredContactos
                                  ?.filter((contacto) =>
                                    contacto.nome.toLowerCase().includes(contactosSearch.toLowerCase())
                                  )
                                  .map((contacto) => {
                                    const isSelected = field.value?.includes(contacto.id);
                                    return (
                                      <div
                                        key={contacto.id}
                                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted"
                                        onClick={() => {
                                          // FASE 1: Respect multiContactosEnabled flag
                                          if (!multiContactosEnabled) {
                                            // Single mode: toggle or replace
                                            if (isSelected) {
                                              field.onChange([]); // Deselect
                                            } else {
                                              field.onChange([contacto.id]); // Replace with this one
                                            }
                                          } else {
                                            // Multi mode: original behavior
                                            const newIds = isSelected
                                              ? (field.value || []).filter((id) => id !== contacto.id)
                                              : [...(field.value || []), contacto.id];
                                            field.onChange(newIds);
                                          }
                                        }}
                                        data-testid={`button-contacto-${contacto.id}`}
                                      >
                                        <Checkbox
                                          checked={isSelected}
                                          onCheckedChange={() => {}}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium">{contacto.nome}</div>
                                          {contacto.funcao && <div className="text-xs text-muted-foreground">{contacto.funcao}</div>}
                                        </div>
                                      </div>
                                    );
                                  })
                              )}
                            </div>
                          </>
                        )}
                      </PopoverContent>
                    </Popover>

                    {/* Show selected contactos as small badges below */}
                    {field.value && field.value.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {filteredContactos
                          ?.filter((c) => field.value?.includes(c.id))
                          .map((c) => (
                            <Badge
                              key={c.id}
                              variant="secondary"
                              className="text-xs"
                              data-testid={`badge-contacto-selected-${c.id}`}
                            >
                              {c.nome}
                            </Badge>
                          ))}
                      </div>
                    )}

                    <FormDescription className="text-xs">
                      {selectedEntidadeId 
                        ? (multiContactosEnabled
                          ? "Escolhe um ou mais contactos que estiveram presentes nesta visita"
                          : "Seleciona um contacto que esteve presente nesta visita. Clica noutro para substituir.")
                        : "Seleciona uma entidade primeiro para ver os contactos disponíveis"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* Assigned User Field - Admin Only */}
            {isAdmin && (
              <FormField
                control={form.control}
                name="assignedUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Atribuído a</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || currentUser?.id}>
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
                    <FormDescription className="text-xs">
                      Utilizador responsável por esta visita
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="dataVisita"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data da Visita *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className="h-12 w-full justify-start text-left font-normal"
                          data-testid="button-data-visita"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP", { locale: pt }) : "Selecione a data"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        locale={pt}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* FASE-AUDIO-CORE-02: Audio Recording and Transcription Controls */}
            <Card className="bg-muted/50 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Ditar Anotações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant={audio.isRecording ? "destructive" : "default"}
                    size="sm"
                    onClick={audio.isRecording ? audio.stopRecording : audio.startRecording}
                    data-testid="button-audio-record"
                  >
                    <Mic className="h-4 w-4 mr-2" />
                    {audio.isRecording ? 'Parar' : 'Gravar'}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const text = await audio.transcribe();
                        const currentNotas = form.getValues("notas") || "";
                        const updatedNotas = currentNotas 
                          ? currentNotas + "\n\n" + text
                          : text;
                        form.setValue("notas", updatedNotas);
                        toast({
                          title: "Áudio transcrito",
                          description: "Texto adicionado às notas.",
                        });
                      } catch (error) {
                        // Error already handled and logged by hook
                      }
                    }}
                    disabled={!audio.hasAudio || audio.isTranscribing}
                    data-testid="button-audio-transcribe"
                  >
                    <Volume2 className="h-4 w-4 mr-2" />
                    {audio.isTranscribing ? 'A transcrever...' : 'Transcrever áudio'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const text = await audio.selectFileAndTranscribe();
                        const currentNotas = form.getValues("notas") || "";
                        const updatedNotas = currentNotas 
                          ? currentNotas + "\n\n" + text
                          : text;
                        form.setValue("notas", updatedNotas);
                        toast({
                          title: "Ficheiro transcrito",
                          description: "Texto adicionado às notas.",
                        });
                      } catch (error) {
                        // Error already handled by hook
                      }
                    }}
                    disabled={audio.isTranscribing}
                    data-testid="button-audio-file"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Ficheiro
                  </Button>
                </div>
                
                {audio.hasAudio && !audio.isRecording && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Áudio gravado e pronto para transcrever
                  </p>
                )}
              </CardContent>
            </Card>

            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas da Visita</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      content={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Descreva os pontos principais da visita. Ou usa o botão acima para ditar..."
                      className="border-input"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Podes formatar o texto, adicionar listas e checklists. A IA irá analisar estas notas para gerar um resumo
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* FASE 5: Marcas Faladas - Updated UI with dropdown/multi-select */}
            {empresa?.mostrarMarcasEmVisitas && (
              <FormField
                control={form.control}
                name="marcasIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marcas Faladas Nesta Visita</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                          data-testid="button-marcas-dropdown"
                        >
                          {field.value?.length
                            ? `${field.value.length} marca${field.value.length === 1 ? "" : "s"} selecionada${field.value.length === 1 ? "" : "s"}`
                            : "Seleciona uma ou mais marcas"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" side="bottom" align="start">
                        <div className="p-3 border-b">
                          <Input
                            placeholder="Pesquisar marcas..."
                            value={marcasSearch}
                            onChange={(e) => setMarcasSearch(e.target.value)}
                            className="h-8"
                            data-testid="input-marcas-search"
                          />
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {marcas.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              Nenhuma marca disponível
                            </div>
                          ) : (
                            marcas
                              .filter((marca) =>
                                marca.nome.toLowerCase().includes(marcasSearch.toLowerCase())
                              )
                              .map((marca) => {
                                const isSelected = field.value?.includes(marca.id);
                                return (
                                  <div
                                    key={marca.id}
                                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted"
                                    onClick={() => {
                                      const newIds = isSelected
                                        ? (field.value || []).filter((id) => id !== marca.id)
                                        : [...(field.value || []), marca.id];
                                      field.onChange(newIds);
                                    }}
                                    data-testid={`button-marca-${marca.id}`}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => {}}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="text-sm">{marca.nome}</span>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Show selected marcas as small badges below */}
                    {field.value && field.value.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {marcas
                          .filter((m) => field.value?.includes(m.id))
                          .map((m) => (
                            <Badge
                              key={m.id}
                              variant="secondary"
                              className="text-xs"
                              data-testid={`badge-marca-selected-${m.id}`}
                            >
                              {m.nome}
                            </Badge>
                          ))}
                      </div>
                    )}

                    <FormDescription className="text-xs">
                      Escolhe uma ou mais marcas que foram abordadas na visita.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="space-y-2">
              <FormLabel>Áudio da Visita (Suplementar)</FormLabel>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioChange}
                  className="h-12"
                  data-testid="input-audio"
                />
              </div>
              {audioFile && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <span className="text-sm flex-1">{audioFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setAudioFile(null)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Usa o botão "Ditar Anotações" acima para gravar e transcrever áudio.
              </p>
            </div>

            <div className="space-y-2">
              <FormLabel>Fotos/Vídeos</FormLabel>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleMediaChange}
                  className="h-12"
                  data-testid="input-media"
                />
              </div>
              {mediaFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {mediaFiles.map((file, idx) => (
                    <div key={idx} className="relative p-2 bg-muted rounded-md">
                      <span className="text-xs truncate block">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setMediaFiles(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 h-6 w-6"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="proximaVisita"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Próxima Visita</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className="h-12 w-full justify-start text-left font-normal"
                          data-testid="button-proxima-visita"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP", { locale: pt }) : "Agendar próxima visita"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={field.onChange}
                        locale={pt}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Localização GPS</FormLabel>
              <LocationPreview
                location={gpsLocation}
                error={gpsError}
                isLoading={gpsLoading}
                onRequestLocation={requestLocation}
                showMap={true}
              />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="create-task"
                  checked={createTask}
                  onCheckedChange={(checked) => setCreateTask(checked as boolean)}
                  disabled={isEdit}
                  data-testid="checkbox-criar-tarefa"
                />
                <label
                  htmlFor="create-task"
                  className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Criar tarefa associada a esta visita
                </label>
              </div>

              {createTask && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Nova Tarefa
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <FormLabel>Título da Tarefa *</FormLabel>
                      <Input
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        placeholder="Ex: Follow-up com orçamento"
                        data-testid="input-task-titulo"
                      />
                    </div>

                    <div className="space-y-2">
                      <FormLabel>Descrição</FormLabel>
                      <RichTextEditor
                        content={taskDescription}
                        onChange={setTaskDescription}
                        placeholder="Use formatação e checkboxes para organizar a tarefa..."
                      />
                    </div>

                    <div className="space-y-2">
                      <FormLabel>Data de Vencimento</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            data-testid="button-task-due-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {taskDueDate ? format(taskDueDate, "PPP", { locale: pt }) : "Selecione a data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={taskDueDate}
                            onSelect={setTaskDueDate}
                            locale={pt}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="sticky bottom-20 pt-4">
              <Button
                type="submit"
                className="w-full h-12"
                disabled={createMutation.isPending || updateMutation.isPending || (createTask && !taskTitle)}
                data-testid="button-guardar"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEdit ? "A atualizar visita..." : "A criar visita..."}
                  </>
                ) : (
                  isEdit 
                    ? "Atualizar Visita" 
                    : (createTask ? "Criar Visita e Tarefa" : "Criar Visita")
                )}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
