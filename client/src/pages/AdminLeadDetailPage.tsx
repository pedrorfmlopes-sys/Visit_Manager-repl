import { useRoute, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, ExternalLink, Mic, Wand2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useAudioTranscription } from "@/hooks/useAudioTranscription";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Marca, VisitaWithRelations, Contacto } from "@shared/schema";

type Lead = {
  id: string;
  titulo: string;
  descricao: string | null;
  marca: string | null;
  estado: string;
  valorPrevisto: string | null;
  moeda: string | null;
  entidadeId: string;
  contactoId: string;
  visitaId: string | null;
  odooLeadId: string | null;
  createdAt: string;
  updatedAt: string;
  entidadeNome?: string | null;
  contactoNome?: string | null;
  visitaData?: string | null;
  contactosAssociados?: Contacto[] | null;
  marcas?: Marca[] | null;
};

type LeadResponse =
  | { lead: Lead }
  | { success: false; notEnabled?: boolean; message?: string };

export default function AdminLeadDetailPage() {
  const [_, params] = useRoute("/admin/leads/:id");
  const id = params?.id as string | undefined;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const search = useSearch();

  // FASE-LEADS-NEW-03: Parse query params for create mode (with context)
  const searchParams = new URLSearchParams(search);
  const visitaIdFromQuery = searchParams.get("visitaId");
  const entidadeId = searchParams.get("entidadeId");
  const contactoIdFromQuery = searchParams.get("contactoId");
  const rawReturnTo = searchParams.get("returnTo");
  const returnTo = rawReturnTo ? decodeURIComponent(rawReturnTo) : null;
  const isCreateMode = id === "new";
  const hasContext = isCreateMode && !!entidadeId && !!contactoIdFromQuery;

  // FASE-LEADS-CONTEXTO-02: Fetch visita data for context display
  const { data: visitaData } = useQuery<VisitaWithRelations>({
    queryKey: ["/api/visitas", visitaIdFromQuery],
    enabled: isCreateMode && !!visitaIdFromQuery,
  });

  const { data, isLoading, isError } = useQuery<LeadResponse>({
    queryKey: ["/api/crm/leads", id],
    enabled: !!id && !isCreateMode, // FASE-LEADS-NEW-02: Skip query in create mode
    queryFn: async () => {
      const resp = await fetch(`/api/crm/leads/${id}`, {
        credentials: "include",
      });
      return resp.json();
    },
  });

  if (!id) {
    return <p className="p-4 text-sm text-muted-foreground">ID de lead inválido.</p>;
  }

  // FASE-LEADS-NEW-02: Show loading only for existing leads
  if (!isCreateMode && isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">A carregar lead...</p>;
  }

  if (!isCreateMode && (isError || !data || ("success" in data && data.success === false && !data.notEnabled))) {
    return (
      <div className="p-4">
        <p className="text-sm text-destructive">
          Erro ao carregar lead. Tenta recarregar a página.
        </p>
      </div>
    );
  }

  if (!isCreateMode && data && "success" in data && data.notEnabled) {
    return (
      <p className="p-4 text-sm text-amber-600">
        Módulo de Leads CRM está desativado para esta empresa.
      </p>
    );
  }

  // FASE-LEADS-CONTEXTO-02: Build contactos list from visita data
  const contactosDisponiveis: Array<{ id: string; nome: string; origem: string }> = [];
  if (visitaData) {
    // Contacto principal da visita
    if (visitaData.contacto) {
      contactosDisponiveis.push({
        id: visitaData.contacto.id,
        nome: visitaData.contacto.nome || "Sem nome",
        origem: "Contacto principal",
      });
    }
    // Contactos presentes na visita
    if (visitaData.contactosPresentes && Array.isArray(visitaData.contactosPresentes)) {
      visitaData.contactosPresentes.forEach((c) => {
        if (!contactosDisponiveis.find((cd) => cd.id === c.id)) {
          contactosDisponiveis.push({
            id: c.id,
            nome: c.nome || "Sem nome",
            origem: "Presente nesta visita",
          });
        }
      });
    }
  }

  // FASE-LEADS-NEW-03: Create empty lead for new mode (with context from query and visita)
  const lead = isCreateMode 
    ? {
        id: "new",
        titulo: "",
        descricao: null,
        marca: null,
        estado: "novo",
        valorPrevisto: null,
        moeda: "EUR",
        entidadeId: entidadeId || "",
        contactoId: contactoIdFromQuery || "",
        visitaId: visitaIdFromQuery || null,
        odooLeadId: null,
        createdAt: "",
        updatedAt: "",
        entidadeNome: visitaData?.entidade?.nome || null,
        contactoNome: visitaData?.contacto?.nome || null,
        visitaData: null,
        contactosAssociados: null,
        marcas: null,
      }
    : (data as { lead: Lead }).lead;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const target = visitaIdFromQuery
              ? `/visitas/${visitaIdFromQuery}`
              : "/admin/leads";

            console.log("[AdminLeadDetail] header back target:", {
              visitaIdFromQuery,
              returnTo,
              target,
            });

            setLocation(target);
          }}
          data-testid="button-voltar-leads"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold">
          {isCreateMode ? "Novo lead" : `Lead: ${lead.titulo}`}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {isCreateMode && !hasContext && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded text-sm text-amber-800 dark:text-amber-200 mb-4">
              Nota: Para pre-preencher contexto, abra este formulário a partir de uma visita existente.
            </div>
          )}
          {(isCreateMode || !isCreateMode) ? (
            <LeadDetailForm 
              lead={lead} 
              isCreateMode={isCreateMode} 
              visitaId={visitaIdFromQuery || null} 
              returnTo={returnTo || null}
              entidadeId={entidadeId || null}
              contactoId={contactoIdFromQuery || null}
              hasContext={hasContext}
              contactosDisponiveis={contactosDisponiveis}
            />
          ) : null}
        </div>
        {!isCreateMode && (
          <div>
            <OdooCrmCard leadId={lead.id} odooLeadId={lead.odooLeadId} />
          </div>
        )}
      </div>
    </div>
  );
}

function LeadDetailForm({ 
  lead, 
  isCreateMode = false, 
  visitaId = null,
  returnTo = null,
  entidadeId = null,
  contactoId = null,
  hasContext = false,
  contactosDisponiveis = [],
}: { 
  lead: Lead; 
  isCreateMode?: boolean;
  visitaId?: string | null;
  returnTo?: string | null;
  entidadeId?: string | null;
  contactoId?: string | null;
  hasContext?: boolean;
  contactosDisponiveis?: Array<{ id: string; nome: string; origem: string }>;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [marcasSearch, setMarcasSearch] = useState("");
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [summarizing, setSummarizing] = useState(false);
  
  // FASE-AUDIO-CORE-03: Use unified audio transcription hook (same as Visitas)
  const audio = useAudioTranscription();

  const { data: marcas = [] } = useQuery<Marca[]>({
    queryKey: ["/api/marcas", "onlyAtivas"],
    queryFn: async () => {
      const response = await fetch("/api/marcas?onlyAtivas=true", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch marcas");
      return response.json();
    },
  });

  const [form, setForm] = useState({
    titulo: lead.titulo,
    descricao: lead.descricao ?? "",
    marcasIds: lead.marcas?.map((m) => m.id) ?? [],
    estado: lead.estado ?? "novo",
    valorPrevisto: lead.valorPrevisto ?? "",
    moeda: lead.moeda ?? "EUR",
    // FASE-LEADS-CONTEXTO-02: Contacto selection for create mode
    contactoId: isCreateMode ? (contactoId || "") : (lead.contactoId || ""),
  });

  const [saving, setSaving] = useState(false);

  // FASE-AUDIO-CORE-04: Handler for transcribing recorded audio
  const handleTranscreverLead = async () => {
    try {
      const text = await audio.transcribe();
      if (!text) {
        toast({
          title: "Transcrição vazia",
          description: "O áudio não contém texto reconhecível.",
          variant: "destructive",
        });
        return;
      }
      setForm((f) => ({
        ...f,
        descricao: f.descricao ? f.descricao + "\n\n" + text : text,
      }));
      toast({
        title: "Sucesso",
        description: "Áudio transcrito e adicionado à descrição.",
      });
    } catch (error: any) {
      console.error("[AdminLeadDetailPage] Erro na transcrição:", error);
      const errorMsg = error instanceof Error ? error.message : "Falha na transcrição de áudio.";
      toast({
        title: "Erro na transcrição",
        description: errorMsg || "Falha na transcrição de áudio.",
        variant: "destructive",
      });
    }
  };

  // Handle text summarization
  const handleSummarizeText = async () => {
    if (!form.descricao.trim()) {
      toast({
        title: "Sem texto",
        description: "Não há texto para melhorar.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSummarizing(true);
      const response = await fetch("/api/crm/leads/ai/summarize", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: form.descricao,
          titulo: form.titulo,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to summarize text");
      }

      setForm((f) => ({ ...f, descricao: data.text }));
      toast({
        title: "Texto melhorado",
        description: "Descrição foi atualizada com a versão melhorada da IA.",
      });
    } catch (error: any) {
      console.error("[Lead AI] Summarize error:", error);
      toast({
        title: "Falha ao melhorar texto",
        description: error?.message || "Não foi possível melhorar o texto.",
        variant: "destructive",
      });
    } finally {
      setSummarizing(false);
    }
  };

  const handleChange =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };

  const handleSave = async () => {
    try {
      setSaving(true);

      const body: any = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        marcasIds: form.marcasIds && form.marcasIds.length > 0 ? form.marcasIds : undefined,
        estado: form.estado || "novo",
        valorPrevisto: form.valorPrevisto ? Number(form.valorPrevisto) : null,
        moeda: form.moeda || "EUR",
      };

      // FASE-LEADS-CONTEXTO-02: POST for create mode (read contactoId from form)
      if (isCreateMode) {
        if (!entidadeId) {
          throw new Error("Contexto incompleto: entidade ausente");
        }
        // FASE-LEADS-CONTEXTO-02: Validate contactoId selection
        if (!form.contactoId) {
          throw new Error("Neste momento é obrigatório associar um contacto ao lead.");
        }
        body.visitaId = visitaId || null;
        body.entidadeId = entidadeId;
        body.contactoId = form.contactoId; // Read from form state
      }

      const method = isCreateMode ? "POST" : "PATCH";
      const endpoint = isCreateMode ? "/api/crm/leads" : `/api/crm/leads/${lead.id}`;

      const resp = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const json = await resp.json();

      if (!resp.ok || json.success === false) {
        throw new Error(json.message || `HTTP ${resp.status}`);
      }

      toast({
        title: isCreateMode ? "Lead criado" : "Lead atualizado",
        description: isCreateMode ? "Novo lead foi criado." : "Os dados do lead foram guardados.",
      });

      // FASE-LEADS-NEW-02: After create, navigate to detail or back to returnTo
      if (isCreateMode && json.lead?.id) {
        const createdId = json.lead.id;
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] }),
          visitaId && queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", { visitaId }] }),
        ]);

        // BUG-FIX: Navigate based on visitaId priority (if created from visita)
        const target = visitaId
          ? `/visitas/${visitaId}`
          : `/admin/leads/${createdId}`;

        console.log("[AdminLeadDetail] handleSave target:", {
          visitaId,
          returnTo,
          createdId,
          target,
        });

        navigate(target);
      } else {
        // Edit mode - navigate to leads list
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", lead.id] }),
          queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", { visitaId: lead.visitaId }] }),
          queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", { entidadeId: lead.entidadeId }] }),
          queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", { contactoId: lead.contactoId }] }),
        ]);
        navigate("/admin/leads");
      }
    } catch (error: any) {
      console.error("[CRM Leads] Save lead error:", error);
      toast({
        title: "Erro ao guardar lead",
        description: error?.message || "Não foi possível guardar as alterações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="mb-4" data-testid="card-lead-contexto">
        <CardHeader>
          <CardTitle className="text-sm">Contexto do lead</CardTitle>
          <CardDescription className="text-xs">
            Entidade, contacto e visita associados a este lead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Entidade</div>
              {lead.entidadeNome ? (
                <button
                  type="button"
                  className="underline-offset-2 hover:underline text-left"
                  onClick={() => navigate(`/entidades/${lead.entidadeId}?returnTo=${encodeURIComponent(`/admin/leads/${lead.id}`)}`)}
                  data-testid="link-lead-entidade"
                >
                  {lead.entidadeNome}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Sem entidade associada
                </span>
              )}
            </div>

            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Contacto principal</div>
              {lead.contactoNome ? (
                <button
                  type="button"
                  className="underline-offset-2 hover:underline text-left"
                  onClick={() => navigate(`/contactos/${lead.contactoId}?returnTo=${encodeURIComponent(`/admin/leads/${lead.id}`)}`)}
                  data-testid="link-lead-contacto"
                >
                  {lead.contactoNome}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Sem contacto associado
                </span>
              )}
            </div>

            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Visita</div>
              {lead.visitaId && lead.visitaData ? (
                <button
                  type="button"
                  className="underline-offset-2 hover:underline text-left"
                  onClick={() => navigate(`/visitas/${lead.visitaId}?returnTo=${encodeURIComponent(`/admin/leads/${lead.id}`)}`)}
                  data-testid="link-lead-visita"
                >
                  {new Date(lead.visitaData).toLocaleDateString()}
                </button>
              ) : lead.visitaId ? (
                <button
                  type="button"
                  className="underline-offset-2 hover:underline text-left"
                  onClick={() => navigate(`/visitas/${lead.visitaId}?returnTo=${encodeURIComponent(`/admin/leads/${lead.id}`)}`)}
                  data-testid="link-lead-visita"
                >
                  Ver visita
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Sem visita associada
                </span>
              )}
            </div>
          </div>

          {lead.contactosAssociados && lead.contactosAssociados.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              <div className="text-xs text-muted-foreground font-medium">Outros contactos envolvidos:</div>
              <div className="flex flex-wrap gap-2">
                {lead.contactosAssociados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/contactos/${c.id}?returnTo=${encodeURIComponent(`/admin/leads/${lead.id}`)}`)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-secondary text-secondary-foreground hover:underline"
                    data-testid={`chip-contacto-${c.id}`}
                  >
                    {c.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {lead.marcas && lead.marcas.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              <div className="text-xs text-muted-foreground font-medium">Marcas associadas:</div>
              <div className="flex flex-wrap gap-2">
                {lead.marcas.map((marca) => (
                  <Badge key={marca.id} variant="secondary" data-testid={`badge-lead-detalhe-marca-${marca.id}`}>
                    {marca.nome}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Editar Lead</CardTitle>
          <CardDescription>
            Edita os dados principais deste lead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="lead-titulo">Título *</Label>
            <Input
              id="lead-titulo"
              value={form.titulo}
              onChange={handleChange("titulo")}
              data-testid="input-lead-titulo"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="lead-descricao">Descrição</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={audio.isRecording ? "destructive" : "outline"}
                  onClick={() => (audio.isRecording ? audio.stopRecording() : audio.startRecording())}
                  data-testid="button-lead-dictate"
                >
                  <Mic className="h-4 w-4 mr-1" />
                  {audio.isRecording ? "Parar" : "Dictar"}
                </Button>
                
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleTranscreverLead}
                  disabled={!audio.hasAudio || audio.isTranscribing}
                  data-testid="button-lead-transcribe-audio"
                >
                  {audio.isTranscribing ? "A transcrever..." : "Transcrever áudio"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const text = await audio.selectFileAndTranscribe();
                      setForm((f) => ({ ...f, descricao: (f.descricao || "") ? f.descricao + "\n\n" + text : text }));
                      toast({
                        title: "Ficheiro transcrito",
                        description: "Texto adicionado à descrição.",
                      });
                    } catch (error) {
                      // Error already handled by hook
                    }
                  }}
                  disabled={audio.isTranscribing}
                  data-testid="button-lead-upload-file"
                >
                  Ficheiro
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSummarizeText}
                  disabled={summarizing || !form.descricao.trim()}
                  data-testid="button-lead-enhance"
                >
                  <Wand2 className="h-4 w-4 mr-1" />
                  {summarizing ? "A gerar..." : "IA"}
                </Button>
              </div>
            </div>
            {audio.isRecording && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                A gravar há {audio.recordingSeconds}s
              </p>
            )}
            <Textarea
              id="lead-descricao"
              value={form.descricao}
              onChange={handleChange("descricao")}
              rows={3}
              data-testid="textarea-lead-descricao"
            />
          </div>

          {/* FASE-LEADS-CONTEXTO-02: Contacto selection field in create mode */}
          {isCreateMode && (
            <div className="space-y-1">
              <Label htmlFor="lead-contacto">Contacto *</Label>
              <Select
                value={form.contactoId}
                onValueChange={(value) => setForm((f) => ({ ...f, contactoId: value }))}
              >
                <SelectTrigger id="lead-contacto" data-testid="select-lead-contacto">
                  <SelectValue placeholder="Seleciona um contacto" />
                </SelectTrigger>
                <SelectContent>
                  {contactosDisponiveis.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Nenhum contacto disponível
                    </div>
                  ) : (
                    contactosDisponiveis.map((contacto) => (
                      <SelectItem key={contacto.id} value={contacto.id}>
                        {contacto.nome} ({contacto.origem})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {contactosDisponiveis.length > 0
                  ? "Seleciona o contacto para este lead"
                  : "Nenhum contacto disponível nesta visita"}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Marcas</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    data-testid="button-lead-edit-marcas-dropdown"
                  >
                    {form.marcasIds?.length
                      ? `${form.marcasIds.length} marca${form.marcasIds.length === 1 ? "" : "s"} selecionada${form.marcasIds.length === 1 ? "" : "s"}`
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
                      data-testid="input-lead-edit-marcas-search"
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
                          const isSelected = form.marcasIds?.includes(marca.id);
                          return (
                            <div
                              key={marca.id}
                              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted"
                              onClick={() => {
                                const newIds = isSelected
                                  ? (form.marcasIds || []).filter((id) => id !== marca.id)
                                  : [...(form.marcasIds || []), marca.id];
                                setForm((f) => ({ ...f, marcasIds: newIds }));
                              }}
                              data-testid={`button-lead-edit-marca-${marca.id}`}
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
            </div>

            <div className="space-y-1">
              <Label htmlFor="lead-estado">Estado</Label>
              <select
                id="lead-estado"
                className="border rounded px-2 py-1 text-sm w-full bg-background"
                value={form.estado}
                onChange={handleChange("estado")}
                data-testid="select-lead-estado"
              >
                <option value="novo">Novo</option>
                <option value="em_analise">Em análise</option>
                <option value="proposta_enviada">Proposta enviada</option>
                <option value="ganho">Ganho</option>
                <option value="perdido">Perdido</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="lead-valor">Valor previsto</Label>
              <Input
                id="lead-valor"
                type="number"
                min="0"
                step="0.01"
                value={form.valorPrevisto}
                onChange={handleChange("valorPrevisto")}
                data-testid="input-lead-valor"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="lead-moeda">Moeda</Label>
            <Input
              id="lead-moeda"
              value={form.moeda}
              onChange={handleChange("moeda")}
              data-testid="input-lead-moeda"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => {
              const target = visitaId
                ? `/visitas/${visitaId}`
                : "/admin/leads";

              console.log("[AdminLeadDetail] cancel target:", {
                visitaId,
                returnTo,
                target,
              });

              navigate(target);
            }}
            data-testid="button-cancelar-lead"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.titulo.trim()}
            data-testid="button-guardar-lead"
          >
            {saving ? "A guardar..." : "Guardar alterações"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

type OdooStatusResponse =
  | { configured: true; baseUrl: string; isActive: boolean }
  | { configured: false; message?: string };

function OdooCrmCard({ leadId, odooLeadId }: { leadId: string; odooLeadId: string | null }) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const { data: odooStatus, isLoading: statusLoading } = useQuery<OdooStatusResponse>({
    queryKey: ["/api/integrations/odoo/status"],
    queryFn: async () => {
      const resp = await fetch("/api/integrations/odoo/status", {
        credentials: "include",
      });
      return resp.json();
    },
  });

  const handleSync = async () => {
    try {
      setSyncing(true);

      const resp = await fetch(`/api/crm/leads/${leadId}/odoo/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const json = await resp.json();

      if (!resp.ok || json.success === false) {
        throw new Error(json.message || `HTTP ${resp.status}`);
      }

      const message = json.created
        ? "Lead criado no Odoo."
        : "Lead sincronizado com Odoo.";

      toast({
        title: "Sucesso",
        description: message,
      });

      // Refazer fetch do lead para atualizar odooLeadId
      await queryClient.invalidateQueries({
        queryKey: ["/api/crm/leads", leadId],
      });
    } catch (error: any) {
      console.error("[Odoo Sync] Error:", error);
      toast({
        title: "Erro ao sincronizar",
        description: error?.message || "Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const isOdooConfigured = odooStatus && "configured" in odooStatus && odooStatus.configured;
  const odooBaseUrl = isOdooConfigured ? (odooStatus as any).baseUrl : null;
  const odooLeadUrl = odooLeadId && odooBaseUrl
    ? `${odooBaseUrl}/web#id=${odooLeadId}&model=crm.lead&view_type=form`
    : null;

  return (
    <Card data-testid="card-odoo-crm">
      <CardHeader>
        <CardTitle className="text-sm">Odoo CRM</CardTitle>
        <CardDescription className="text-xs">
          Sincronizar lead com Odoo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {statusLoading ? (
          <p className="text-xs text-muted-foreground">A carregar estado...</p>
        ) : !isOdooConfigured ? (
          <p className="text-xs text-amber-600">
            Odoo não está configurado ou está desligado para esta empresa.
          </p>
        ) : (
          <>
            {odooLeadId ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Lead sincronizado: <span className="font-mono text-xs">{odooLeadId}</span>
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSync}
                    disabled={syncing}
                    data-testid="button-sincronizar-odoo"
                  >
                    {syncing ? "A sincronizar..." : "Sincronizar"}
                  </Button>
                  {odooLeadUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(odooLeadUrl, "_blank")}
                      data-testid="button-abrir-odoo"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Abrir
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Lead não sincronizado com Odoo.
                </p>
                <Button
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  data-testid="button-criar-odoo"
                  className="w-full"
                >
                  {syncing ? "A criar..." : "Criar lead no Odoo"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
