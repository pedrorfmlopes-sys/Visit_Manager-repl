import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
});

type VisitaFormData = z.infer<typeof visitaFormSchema>;

export default function VisitaForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const { location: gpsLocation, error: gpsError, isLoading: gpsLoading, requestLocation } = useGeolocation(true);
  
  // FASE 7.2: Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [pendingClips, setPendingClips] = useState<File[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [supportsRecording, setSupportsRecording] = useState(
    typeof navigator !== 'undefined' && 
    (navigator.mediaDevices?.getUserMedia !== undefined || (navigator as any).getUserMedia !== undefined) &&
    typeof MediaRecorder !== 'undefined'
  );
  
  // Task creation state
  const [createTask, setCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState<Date | undefined>(undefined);
  
  // Marcas search state (FASE 5 UI update)
  const [marcasSearch, setMarcasSearch] = useState("");
  
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

  const form = useForm<VisitaFormData>({
    resolver: zodResolver(visitaFormSchema),
    defaultValues: {
      entidadeId: "",
      contactoId: "",
      dataVisita: new Date(),
      notas: "",
      marcasEntregues: [],
      marcasIds: [],
      proximaVisita: undefined,
    },
  });

  const selectedEntidadeId = form.watch("entidadeId");
  const selectedMarcasIds = form.watch("marcasIds") || [];
  const filteredContactos = contactos?.filter(c => c.entidadeId === selectedEntidadeId);

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
      
      setLocation("/visitas");
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
        contactoId: data.contactoId || null,
        dataVisita: data.dataVisita.toISOString(),
        notas: data.notas || null,
        proximaVisita: data.proximaVisita?.toISOString() || null,
        marcasEntregues: data.marcasEntregues || [],
        latitude: gpsLocation?.latitude || null,
        longitude: gpsLocation?.longitude || null,
        locationAccuracy: gpsLocation?.accuracy || null,
        createdByUserId: createdByUserId || null,
        assignedUserId: assignedUserId || null,
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
    if (data.contactoId) formData.append("contactoId", data.contactoId);
    formData.append("dataVisita", data.dataVisita.toISOString());
    if (data.notas) formData.append("notas", data.notas);
    if (data.proximaVisita) formData.append("proximaVisita", data.proximaVisita.toISOString());
    if (data.marcasEntregues) formData.append("marcasEntregues", JSON.stringify(data.marcasEntregues));
    if (data.marcasIds && data.marcasIds.length > 0) formData.append("marcasIds", JSON.stringify(data.marcasIds));
    
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
    
    // Hook into mutation to upload pending clips after visita is created
    const originalMutate = createMutation.mutate;
    createMutation.mutate(formData, {
      onSuccess: async (visitaData) => {
        // Upload pending audio clips if any
        if (pendingClips.length > 0 && visitaData.id) {
          try {
            await Promise.all(
              pendingClips.map(async (clip) => {
                const formData = new FormData();
                formData.append('audio', clip);
                const response = await fetch(`/api/visitas/${visitaData.id}/audio`, {
                  method: 'POST',
                  credentials: 'include',
                  body: formData,
                });
                return response.ok;
              })
            );
            setPendingClips([]);
          } catch (error) {
            console.error("Failed to upload pending clips:", error);
            toast({ 
              title: "Atenção", 
              description: "Visita criada mas alguns áudios não foram enviados.",
              variant: "destructive"
            });
          }
        }
      },
    });
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

  // FASE 7.2: Recording functions
  const uploadRecordedAudio = async (blob: Blob, visitaId?: string) => {
    try {
      const file = new File([blob], `visita-audio-${Date.now()}.webm`, { type: 'audio/webm' });
      
      if (!visitaId) {
        // Nova visita - guardar em pendingClips
        setPendingClips(prev => [...prev, file]);
        toast({ title: "Áudio gravado", description: "Será enviado quando criares a visita." });
        return;
      }
      
      // Edição - enviar imediato
      const formData = new FormData();
      formData.append('audio', file);
      
      const response = await fetch(`/api/visitas/${visitaId}/audio`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Failed to upload audio');
      queryClient.invalidateQueries({ queryKey: ["/api/visitas", visitaId, "audio"] });
      toast({ title: "Sucesso", description: "Áudio gravado e enviado!" });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao enviar áudio.", variant: "destructive" });
    }
  };

  const startRecording = async () => {
    if (!supportsRecording) {
      toast({ title: "Erro", description: "Gravação de áudio não suportada neste dispositivo.", variant: "destructive" });
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await uploadRecordedAudio(audioBlob);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (error) {
      toast({ title: "Erro", description: "Permissão de microfone negada ou indisponível.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
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
          <h1 className="text-xl font-semibold text-foreground">Nova Visita</h1>
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
                          {entidade.nome} ({entidade.tipoEntidade})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactoId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contacto</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || ""}
                    disabled={!selectedEntidadeId}
                  >
                    <FormControl>
                      <SelectTrigger className="h-12" data-testid="select-contacto">
                        <SelectValue placeholder={selectedEntidadeId ? "Selecione o contacto" : "Selecione primeiro a entidade"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredContactos?.map((contacto) => (
                        <SelectItem key={contacto.id} value={contacto.id}>
                          {contacto.nome} {contacto.funcao && `- ${contacto.funcao}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      placeholder="Descreva os pontos principais da visita..."
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
              <div className="flex items-center justify-between">
                <FormLabel>Áudio da Visita</FormLabel>
                {supportsRecording && (
                  <Button
                    type="button"
                    variant={isRecording ? "destructive" : "outline"}
                    size="sm"
                    onClick={isRecording ? stopRecording : startRecording}
                    data-testid="button-record-audio-form"
                  >
                    <Mic className="h-3 w-3 mr-1" />
                    {isRecording ? `Parar (${recordingTime}s)` : "Gravar"}
                  </Button>
                )}
              </div>
              
              {isRecording && (
                <div className="p-3 bg-destructive/10 border border-destructive rounded-md flex items-center gap-2">
                  <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                  <p className="text-sm text-destructive font-medium">A gravar... {recordingTime}s</p>
                </div>
              )}
              
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
              
              {pendingClips.length > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-xs font-medium mb-2 text-blue-900 dark:text-blue-100">Áudios gravados nesta sessão ({pendingClips.length}):</p>
                  <div className="space-y-2">
                    {pendingClips.map((clip, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-background rounded">
                        <Volume2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        <span className="flex-1">{clip.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setPendingClips(prev => prev.filter((_, i) => i !== idx))}
                          className="h-6 w-6"
                          data-testid={`button-remove-clip-${idx}`}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                A IA irá transcrever automaticamente o áudio
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
                disabled={createMutation.isPending || (createTask && !taskTitle)}
                data-testid="button-guardar"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    A criar visita...
                  </>
                ) : (
                  createTask ? "Criar Visita e Tarefa" : "Criar Visita"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
