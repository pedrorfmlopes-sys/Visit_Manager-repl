import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import DOMPurify from 'dompurify';
import { ArrowLeft, Calendar, Download, MapPin, Clock, User, Building2, FileText, Share2, CheckCircle2, MessageCircle, Link as LinkIcon, Copy, Mail, Sparkles, Bell, Volume2, Trash2, Loader2, Mic } from "lucide-react";
import { format, addDays } from "date-fns";
import { pt } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { VisitaWithRelations, Tarefa, InsertTarefa, Lembrete, VisitasAudio } from "@shared/schema";
import { downloadNextVisitICS } from "@/lib/calendarExport";
import { LocationPreview } from "@/components/LocationPreview";
import { TarefaCard } from "@/components/TarefaCard";
import { ShareDialog, useShareActions } from "@/components/ShareDialog";
import { EmailAIDialog } from "@/components/EmailAIDialog";
import { formatVisitForSharing } from "@/lib/shareFormatters";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { syncManager } from "@/lib/syncManager";
import { insertTarefaSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function VisitaDetail() {
  const [, params] = useRoute("/visitas/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const visitaId = params?.id;
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [pdfProDialogOpen, setPdfProDialogOpen] = useState(false);
  const [pdfProOptions, setPdfProOptions] = useState({
    includePhotos: true,
    includeTasks: true,
    includeIA: true,
    includeCharts: true,
    type: 'interno' as 'interno' | 'cliente'
  });
  const { data: currentUser } = useCurrentUser();
  const isAdmin = useIsAdmin();
  
  const { isOnline, shareViaWhatsApp, shareViaEmail, copyToClipboard, copyLink } = useShareActions();

  const { data: visita, isLoading } = useQuery<VisitaWithRelations>({
    queryKey: ["/api/visitas", visitaId],
    enabled: !!visitaId,
  });

  const { data: tarefas = [] } = useQuery<Tarefa[]>({
    queryKey: ["/api/tarefas"],
    select: (data) => data.filter((t) => t.visitaId === visitaId),
  });

  const { data: allLembretes } = useQuery<Lembrete[]>({
    queryKey: ['/api/lembretes'],
  });

  // FASE 6: Audio clips
  const { data: audioClips = [] } = useQuery<VisitasAudio[]>({
    queryKey: ["/api/visitas", visitaId, "audio"],
    enabled: !!visitaId,
  });

  const visitReminders = allLembretes?.filter(l => 
    l.entidadeId === visita?.entidadeId || l.visitaId === visitaId
  ) || [];

  const deleteAudioMutation = useMutation({
    mutationFn: async (audioId: string) => {
      const response = await fetch(`/api/visitas/${visitaId}/audio/${audioId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete audio');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitas", visitaId, "audio"] });
      toast({ title: "Áudio removido", description: "O clip de áudio foi removido com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao remover áudio.", variant: "destructive" });
    },
  });

  const transcribeMutation = useMutation({
    mutationFn: async (audioId: string) => {
      const response = await fetch(`/api/visitas/${visitaId}/audio/${audioId}/transcrever`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to transcribe audio');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitas", visitaId, "audio"] });
      toast({ title: "Sucesso", description: "Áudio transcrito com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha na transcrição.", variant: "destructive" });
    },
  });

  // FASE 14: AI Summary mutation
  const generateAISummaryMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/visitas/${visitaId}/ia-resumo`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to generate AI summary');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitas", visitaId] });
      toast({ title: "Sucesso", description: "Resumo IA gerado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao gerar resumo IA.", variant: "destructive" });
    },
  });

  // FASE 7: Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [supportsRecording, setSupportsRecording] = useState(
    typeof navigator !== 'undefined' && 
    (navigator.mediaDevices?.getUserMedia !== undefined || (navigator as any).getUserMedia !== undefined) &&
    typeof MediaRecorder !== 'undefined'
  );

  const uploadRecordedAudio = async (blob: Blob) => {
    if (!visitaId) return;
    try {
      const file = new File([blob], `visita-${visitaId}-${Date.now()}.webm`, { type: 'audio/webm' });
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

  const tomorrow = addDays(new Date(), 1);
  
  const form = useForm<InsertTarefa>({
    resolver: zodResolver(insertTarefaSchema),
    defaultValues: {
      titulo: visita ? `Follow-up visita — ${visita.gabinete?.nome || visita.entidade?.nome || ""}` : "",
      descricao: visita?.notas || "",
      visitaId: visitaId,
      entidadeId: visita?.entidadeId || visita?.gabineteId || undefined,
      assignedUserId: currentUser?.id || undefined,
      dueDate: tomorrow,
      repeatInterval: "none",
      status: "pending",
      createdByUserId: currentUser?.id || "",
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: InsertTarefa) => {
      const cleanedData = {
        ...data,
        entidadeId: data.entidadeId || undefined,
        visitaId: data.visitaId || undefined,
        assignedUserId: data.assignedUserId || undefined,
        dueDate: data.dueDate || undefined,
      };
      await apiRequest("POST", "/api/tarefas", cleanedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/visitas", visitaId] });
      toast({
        title: "Sucesso",
        description: "Tarefa criada com sucesso",
      });
      setIsTaskDialogOpen(false);
      form.reset();
    },
    onError: async (error: Error, data) => {
      const isNetworkError = error.message.includes('fetch') || !navigator.onLine;
      
      if (isNetworkError) {
        await syncManager.queueTarefaCreation(data);
        toast({
          title: "Tarefa guardada",
          description: "Será sincronizada automaticamente quando voltar online.",
        });
        setIsTaskDialogOpen(false);
        form.reset();
        return;
      }
      
      toast({
        title: "Erro",
        description: "Falha ao criar tarefa",
        variant: "destructive",
      });
    },
  });

  const handleCreateTask = () => {
    form.reset({
      titulo: `Follow-up visita — ${visita?.gabinete?.nome || visita?.entidade?.nome || ""}`,
      descricao: visita?.notas || "",
      visitaId: visitaId,
      entidadeId: visita?.entidadeId || visita?.gabineteId || undefined,
      assignedUserId: isAdmin ? undefined : currentUser?.id,
      dueDate: tomorrow,
      repeatInterval: "none",
      status: "pending",
      createdByUserId: currentUser?.id || "",
    });
    setIsTaskDialogOpen(true);
  };

  const onSubmitTask = (data: InsertTarefa) => {
    createTaskMutation.mutate(data);
  };


  const handleExportNextVisit = () => {
    if (visita?.gabinete && visita.proximaVisita) {
      downloadNextVisitICS(visita.gabinete, visita.contacto || undefined, new Date(visita.proximaVisita));
      toast({
        title: "Exportado",
        description: "Próxima visita exportada para calendário!",
      });
    }
  };

  const handleExportPDF = async () => {
    if (!visita) return;

    if (!isOnline) {
      toast({
        title: "Offline",
        description: "A exportação PDF só está disponível quando estiver online.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/visitas/${visitaId}/pdf`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const fileName = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `Visita-${visita.gabinete?.nome || visita.entidade?.nome || visita.id}-${format(new Date(visita.dataVisita), 'yyyy-MM-dd')}.pdf`;
      
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Exportado",
        description: "Relatório PDF descarregado com sucesso!",
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar PDF. Por favor, tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleExportPDFPro = async () => {
    if (!visita) return;

    if (!isOnline) {
      toast({
        title: "Offline",
        description: "A exportação PDF PRO só está disponível quando estiver online.",
        variant: "destructive",
      });
      return;
    }

    try {
      const queryParams = new URLSearchParams({
        includePhotos: pdfProOptions.includePhotos.toString(),
        includeTasks: pdfProOptions.includeTasks.toString(),
        includeIA: pdfProOptions.includeIA.toString(),
        includeCharts: pdfProOptions.includeCharts.toString(),
        type: pdfProOptions.type
      });

      const response = await fetch(`/api/pdf/visita/${visitaId}/pro?${queryParams}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF PRO');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const fileName = `Visita-PRO-${visita.gabinete?.nome || visita.entidade?.nome || visita.id}-${format(new Date(visita.dataVisita), 'yyyy-MM-dd')}.pdf`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Exportado",
        description: "Relatório PDF PRO descarregado com sucesso!",
      });
      setPdfProDialogOpen(false);
    } catch (error) {
      console.error('Error downloading PDF PRO:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar PDF PRO. Por favor, tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleAddToCalendar = async () => {
    if (!visita) return;

    if (!isOnline) {
      toast({
        title: "Offline",
        description: "A adição ao calendário só está disponível quando estiver online.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/visitas/${visitaId}/ics`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast({
            title: "Acesso Negado",
            description: "Não tem permissão para exportar esta visita.",
            variant: "destructive",
          });
          return;
        }
        throw new Error('Failed to generate calendar file');
      }

      // Get the ICS content
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const fileName = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `Visita-${visita.gabinete?.nome || visita.entidade?.nome || visita.id}-${format(new Date(visita.dataVisita), 'yyyy-MM-dd')}.ics`;
      
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Adicionado ao Calendário",
        description: "Ficheiro .ics descarregado! Abra-o para adicionar ao seu calendário.",
      });
    } catch (error) {
      console.error('Error downloading ICS:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar ficheiro de calendário. Por favor, tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleShare = () => {
    setShareDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">A carregar visita...</p>
        </div>
      </div>
    );
  }

  if (!visita) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Visita não encontrada</p>
          <Button onClick={() => setLocation("/visitas")} className="mt-4">
            Voltar às visitas
          </Button>
        </div>
      </div>
    );
  }

  const gpsLocation = visita.latitude && visita.longitude
    ? {
        latitude: visita.latitude,
        longitude: visita.longitude,
        accuracy: visita.locationAccuracy || "0",
        timestamp: new Date(visita.createdAt || Date.now()).getTime(),
      }
    : null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/visitas")}
              data-testid="button-voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold text-foreground">Detalhes da Visita</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            data-testid="button-share"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Reminder Banner */}
        {visitReminders.length > 0 && (
          <Alert data-testid="alert-visit-reminders">
            <Bell className="h-4 w-4" />
            <AlertTitle>Existem lembretes pendentes</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-2">
              <span>
                {visitReminders.length === 1 
                  ? 'Existe um lembrete pendente para esta entidade.' 
                  : `Existem ${visitReminders.length} lembretes pendentes para esta entidade.`}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLocation('/lembretes')}
                data-testid="button-view-reminders"
              >
                Ver Lembretes
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {visita.gabinete?.nome}
                </CardTitle>
                <CardDescription className="mt-1">
                  {visita.gabinete?.morada}
                </CardDescription>
              </div>
              <Badge variant="secondary">
                {format(new Date(visita.dataVisita), "dd MMM yyyy", { locale: pt })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {format(new Date(visita.dataVisita), "HH:mm", { locale: pt })}
            </div>
            
            {visita.contacto && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{visita.contacto.nome}</span>
                {visita.contacto.funcao && (
                  <Badge variant="outline" className="text-xs">{visita.contacto.funcao}</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {visita.notas && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notas da Visita</CardTitle>
            </CardHeader>
            <CardContent>
              {visita.notas.includes('<') ? (
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(visita.notas) }}
                  data-testid="notas-formatted"
                />
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap">{visita.notas}</p>
              )}
            </CardContent>
          </Card>
        )}

        {visita.resumoIa && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Resumo da IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground whitespace-pre-wrap">{visita.resumoIa}</p>
            </CardContent>
          </Card>
        )}

        {visita.transcricaoAudio && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transcrição de Áudio</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {visita.transcricaoAudio}
              </p>
            </CardContent>
          </Card>
        )}

        {visita.marcasEntregues && visita.marcasEntregues.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Marcas Entregues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {visita.marcasEntregues.map((marca, idx) => (
                  <Badge key={idx} variant="secondary">{marca}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* FASE 5: Marcas Faladas */}
        {visita.marcas && visita.marcas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Marcas Faladas Nesta Visita</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {visita.marcas.map((visitaMarca) => (
                  <Badge key={visitaMarca.id} variant="default">
                    {visitaMarca.marca.nome}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* FASE 6: Áudio da Visita */}
        {audioClips.length > 0 || supportsRecording ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Áudio da Visita
                </CardTitle>
                {supportsRecording && (
                  <Button
                    variant={isRecording ? "destructive" : "outline"}
                    size="sm"
                    onClick={isRecording ? stopRecording : startRecording}
                    data-testid="button-record-audio"
                  >
                    <Mic className="h-3 w-3 mr-1" />
                    {isRecording ? `Parar (${recordingTime}s)` : "Gravar"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isRecording && (
                <div className="mb-3 p-3 bg-destructive/10 border border-destructive rounded-md flex items-center gap-2">
                  <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                  <p className="text-sm text-destructive font-medium">A gravar... {recordingTime}s</p>
                </div>
              )}
              {audioClips.length > 0 && (
              <div className="space-y-3">
                {audioClips.map((clip) => (
                  <div key={clip.id} className="p-3 border rounded-md bg-muted/30">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <a
                        href={clip.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
                        data-testid={`link-audio-${clip.id}`}
                      >
                        <Volume2 className="h-3 w-3" />
                        Ouvir
                      </a>
                      <div className="flex items-center gap-2">
                        {!clip.transcricao && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => transcribeMutation.mutate(clip.id)}
                            disabled={transcribeMutation.isPending}
                            data-testid={`button-transcribe-${clip.id}`}
                          >
                            {transcribeMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            <span className="ml-1 text-xs">Transcrever</span>
                          </Button>
                        )}
                        {clip.transcricao && (
                          <Badge variant="secondary" className="text-xs">Transcrito</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAudioMutation.mutate(clip.id)}
                          disabled={deleteAudioMutation.isPending}
                          data-testid={`button-delete-audio-${clip.id}`}
                          className="h-7 w-7"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {clip.transcricao && (
                      <div className="text-xs text-muted-foreground p-2 bg-background rounded">
                        <p className="font-medium mb-1">Transcrição:</p>
                        <p className="whitespace-pre-wrap">{clip.transcricao}</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(clip.createdAt).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                ))}
              </div>
              )}
              {audioClips.length === 0 && !isRecording && supportsRecording && (
                <p className="text-sm text-muted-foreground">Nenhum áudio ainda. Clica em "Gravar" para começar!</p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* FASE 14: AI Summary, Key Points and Suggested Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Análise IA da Visita
              </CardTitle>
              {!visita.resumoIa && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateAISummaryMutation.mutate()}
                  disabled={generateAISummaryMutation.isPending}
                  data-testid="button-generate-ai-summary"
                >
                  {generateAISummaryMutation.isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" />
                      Gerar Resumo
                    </>
                  )}
                </Button>
              )}
              {visita.resumoIa && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => generateAISummaryMutation.mutate()}
                  disabled={generateAISummaryMutation.isPending}
                  data-testid="button-regenerate-ai-summary"
                  title="Atualizar análise IA"
                >
                  {generateAISummaryMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {visita.resumoIa ? (
              <>
                {/* Resumo IA */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Resumo Executivo</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{visita.resumoIa}</p>
                </div>

                {/* Pontos-Chave */}
                {visita.pontosChaveIA && visita.pontosChaveIA.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Pontos-Chave</p>
                    <ul className="space-y-1">
                      {(typeof visita.pontosChaveIA === 'string' 
                        ? JSON.parse(visita.pontosChaveIA) 
                        : visita.pontosChaveIA
                      ).map((ponto: string, idx: number) => (
                        <li key={idx} className="text-sm text-foreground flex gap-2">
                          <span className="text-primary font-bold">•</span>
                          <span>{ponto}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tarefas Sugeridas */}
                {visita.tarefasSugeridasIA && visita.tarefasSugeridasIA.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Tarefas Sugeridas</p>
                    <div className="space-y-2">
                      {(typeof visita.tarefasSugeridasIA === 'string' 
                        ? JSON.parse(visita.tarefasSugeridasIA) 
                        : visita.tarefasSugeridasIA
                      ).map((tarefa: any, idx: number) => (
                        <div key={idx} className="p-2 bg-muted/30 rounded-md border border-muted">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-foreground">{tarefa.titulo}</span>
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                              data-testid={`badge-priority-${tarefa.prioridade}-${idx}`}
                            >
                              {tarefa.prioridade === 'alta' && 'Alta'}
                              {tarefa.prioridade === 'normal' && 'Normal'}
                              {tarefa.prioridade === 'baixa' && 'Baixa'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">{tarefa.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            Prazo sugerido: {tarefa.prazo_sugerido_dias} dias
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">
                  Clique em "Gerar Resumo" para analisar automaticamente esta visita com IA
                </p>
                <p className="text-xs text-muted-foreground">
                  A análise incluirá: resumo executivo, pontos-chave e tarefas de follow-up sugeridas
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {gpsLocation && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Localização GPS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LocationPreview
                location={gpsLocation}
                error={null}
                isLoading={false}
                onRequestLocation={() => {}}
                showMap={true}
              />
            </CardContent>
          </Card>
        )}

        {visita.proximaVisita && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Próxima Visita
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">
                {format(new Date(visita.proximaVisita), "PPP 'às' HH:mm", { locale: pt })}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportNextVisit}
                className="mt-3"
                data-testid="button-export-proxima"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Adicionar ao Calendário
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Tarefas desta Visita
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateTask}
                data-testid="button-criar-tarefa"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Criar Tarefa
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tarefas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma tarefa criada para esta visita
              </p>
            ) : (
              <div className="space-y-2">
                {tarefas.map((tarefa) => (
                  <TarefaCard key={tarefa.id} tarefa={tarefa} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={handleAddToCalendar}
                disabled={!isOnline || !visita}
                data-testid="button-add-to-calendar"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Adicionar ao Calendário
              </Button>
            </TooltipTrigger>
            {!isOnline && (
              <TooltipContent>
                <p>A adição ao calendário só está disponível quando estiver online.</p>
              </TooltipContent>
            )}
          </Tooltip>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={!isOnline || !visita}
            data-testid="button-export-pdf"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
          <Button
            variant="default"
            onClick={() => setPdfProDialogOpen(true)}
            disabled={!isOnline || !visita}
            data-testid="button-export-pdf-pro"
          >
            <Download className="h-4 w-4 mr-2" />
            PDF PRO
          </Button>
          <Button
            variant="outline"
            onClick={() => setEmailDialogOpen(true)}
            data-testid="button-generate-email"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Gerar Email
          </Button>
          <Button
            variant="outline"
            onClick={handleShare}
            data-testid="button-share-link"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Partilhar Link
          </Button>
        </div>
      </main>

      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Tarefa</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitTask)} className="space-y-4">
              <FormField
                control={form.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Título da tarefa" data-testid="input-titulo" />
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
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder="Descrição detalhada da tarefa"
                        rows={4}
                        data-testid="input-descricao"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado *</FormLabel>
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

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsTaskDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createTaskMutation.isPending || (!isOnline && !navigator.onLine)}
                  data-testid="button-save"
                >
                  {createTaskMutation.isPending ? "A guardar..." : "Criar Tarefa"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title="Partilhar Visita"
        description={`Partilhar detalhes da visita a ${visita?.gabinete?.nome || visita?.entidade?.nome || ""}`}
        options={[
          {
            icon: MessageCircle,
            label: "Enviar por WhatsApp",
            action: () => shareViaWhatsApp(formatVisitForSharing(visita)),
            disabled: !isOnline,
          },
          {
            icon: Mail,
            label: "Enviar por Email",
            action: () => shareViaEmail(formatVisitForSharing(visita), `Visita - ${visita?.gabinete?.nome || visita?.entidade?.nome || ""}`),
            disabled: !isOnline,
          },
          {
            icon: Download,
            label: "Exportar PDF",
            action: handleExportPDF,
            disabled: !isOnline,
          },
          {
            icon: LinkIcon,
            label: "Copiar Link",
            action: () => copyLink(`/visitas/${visita?.id}`),
          },
          {
            icon: FileText,
            label: "Copiar Visita (texto)",
            action: () => copyToClipboard(formatVisitForSharing(visita), "Visita copiada!"),
          },
        ]}
      />

      <EmailAIDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        visitaId={visitaId}
        defaultTemplate="followup_pos_visita"
      />

      <Dialog open={pdfProDialogOpen} onOpenChange={setPdfProDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar PDF PRO</DialogTitle>
            <CardDescription>Configure as opções do relatório profissional</CardDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="pdf-photos" className="flex flex-col gap-1">
                <span>Incluir Fotos</span>
                <span className="text-sm text-muted-foreground">Adicionar imagens ao relatório</span>
              </Label>
              <Switch
                id="pdf-photos"
                checked={pdfProOptions.includePhotos}
                onCheckedChange={(checked) => setPdfProOptions(prev => ({ ...prev, includePhotos: checked }))}
                data-testid="switch-pdf-photos"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="pdf-tasks" className="flex flex-col gap-1">
                <span>Incluir Tarefas</span>
                <span className="text-sm text-muted-foreground">Listar tarefas relacionadas</span>
              </Label>
              <Switch
                id="pdf-tasks"
                checked={pdfProOptions.includeTasks}
                onCheckedChange={(checked) => setPdfProOptions(prev => ({ ...prev, includeTasks: checked }))}
                data-testid="switch-pdf-tasks"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="pdf-ia" className="flex flex-col gap-1">
                <span>Resumo IA</span>
                <span className="text-sm text-muted-foreground">Gerar sumário inteligente</span>
              </Label>
              <Switch
                id="pdf-ia"
                checked={pdfProOptions.includeIA}
                onCheckedChange={(checked) => setPdfProOptions(prev => ({ ...prev, includeIA: checked }))}
                data-testid="switch-pdf-ia"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="pdf-charts" className="flex flex-col gap-1">
                <span>Gráficos</span>
                <span className="text-sm text-muted-foreground">Incluir visualizações</span>
              </Label>
              <Switch
                id="pdf-charts"
                checked={pdfProOptions.includeCharts}
                onCheckedChange={(checked) => setPdfProOptions(prev => ({ ...prev, includeCharts: checked }))}
                data-testid="switch-pdf-charts"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pdf-type">Tipo de Relatório</Label>
              <Select 
                value={pdfProOptions.type} 
                onValueChange={(value: 'interno' | 'cliente') => setPdfProOptions(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger id="pdf-type" data-testid="select-pdf-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interno">Interno (completo)</SelectItem>
                  <SelectItem value="cliente">Cliente (simplificado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setPdfProDialogOpen(false)}
              data-testid="button-pdf-pro-cancel"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExportPDFPro}
              data-testid="button-pdf-pro-export"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
