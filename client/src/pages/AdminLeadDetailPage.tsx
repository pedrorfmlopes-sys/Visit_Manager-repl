import { useRoute, useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  ExternalLink,
  Mic,
  Wand2,
  Download,
  FileText,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAudioTranscription } from "@/hooks/useAudioTranscription";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EntidadeSearchSelect,
  ContactoSearchSelect,
  VisitaSearchSelect,
} from "@/components/crm/SearchSelects";
import type { Marca, VisitaWithRelations, Contacto } from "@shared/schema";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useAuth } from "@/hooks/useAuth";

type OdooLeadAttachment = {
  id: number;
  name: string;
  mimetype: string | null;
  fileSize: number | null;
  createdAt: string;
  downloadUrl: string;
};

type Lead = {
  id: string;
  titulo: string;
  descricao: string | null;
  descricaoHtml?: string | null;
  tipoLead: string | null;
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

type EmpresaLeadTypeSettings = {
  uiSettings?: {
    odoo?: {
      leadTypeFieldName?: string | null;
      leadTypeFieldVerified?: boolean;
      leadTypeFieldLabel?: string | null;
      leadTypeFieldType?: string | null;
      leadTypeFieldOptions?: Array<{ value: string; label: string }> | null;
    } | null;
  } | null;
};

function htmlToPlainText(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<\/div>\s*<div[^>]*>/gi, "\n")
    .replace(/<\/li>\s*<li[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function plainTextToHtml(value: string | null | undefined) {
  if (!value) return "";
  const text = value.trim();
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

type LeadResponse =
  | { lead: Lead }
  | { success: false; notEnabled?: boolean; message?: string };

export default function AdminLeadDetailPage() {
  const [_, params] = useRoute("/admin/leads/:id");
  const id = params?.id as string | undefined;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  const search = useSearch();

  // Parse query params for create mode (with context)
  const searchParams = new URLSearchParams(search);
  const visitaIdFromQuery = searchParams.get("visitaId");
  const entidadeId = searchParams.get("entidadeId");
  const contactoIdFromQuery = searchParams.get("contactoId");
  const rawReturnTo = searchParams.get("returnTo");
  const returnTo = rawReturnTo ? decodeURIComponent(rawReturnTo) : null;
  const isCreateMode = id === "new";
  const hasContext = isCreateMode && !!entidadeId && !!contactoIdFromQuery;
  const isCreateFromVisit = isCreateMode && !!visitaIdFromQuery;

  const { data: visitaData } = useQuery<VisitaWithRelations>({
    queryKey: ["/api/visitas", visitaIdFromQuery],
    enabled: isCreateMode && !!visitaIdFromQuery,
  });

  const { data, isLoading, isError } = useQuery<LeadResponse>({
    queryKey: ["/api/crm/leads", id],
    enabled: !!id && !isCreateMode,
    queryFn: async () => {
      const resp = await fetch(`/api/crm/leads/${id}`, {
        credentials: "include",
      });
      return resp.json();
    },
  });

  if (!id) {
    return (
      <p className="p-4 text-sm text-muted-foreground">ID de lead inválido.</p>
    );
  }

  if (!isCreateMode && isLoading) {
    return (
      <p className="p-4 text-sm text-muted-foreground">A carregar lead...</p>
    );
  }

  if (
    !isCreateMode &&
    (isError ||
      !data ||
      ("success" in data && data.success === false && !data.notEnabled))
  ) {
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

  // Contactos disponíveis quando se vem de uma visita
  const contactosDisponiveis: Array<{ id: string; nome: string; origem: string }> = [];
  if (visitaData) {
    if (visitaData.contacto) {
      contactosDisponiveis.push({
        id: visitaData.contacto.id,
        nome: visitaData.contacto.nome || "Sem nome",
        origem: "Contacto principal",
      });
    }
    if (visitaData.contactosPresentes && Array.isArray(visitaData.contactosPresentes)) {
      visitaData.contactosPresentes.forEach((c: Contacto) => {
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

  const lead = isCreateMode
    ? {
        id: "new",
        titulo: "",
        descricao: null,
        descricaoHtml: null,
        tipoLead: null,
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
          {isCreateMode && !hasContext && isCreateFromVisit && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded text-sm text-amber-800 dark:text-amber-200 mb-4">
              Nota: Para pré-preencher contexto, abre este formulário a partir de
              uma visita existente.
            </div>
          )}

          <LeadDetailForm
            lead={lead}
            isCreateMode={isCreateMode}
            isCreateFromVisit={isCreateFromVisit}
            visitaId={visitaIdFromQuery || null}
            returnTo={returnTo || null}
            entidadeId={entidadeId || null}
            contactoId={contactoIdFromQuery || null}
            hasContext={hasContext}
            contactosDisponiveis={contactosDisponiveis}
            canEdit={isAdmin || user?.odooLeadAccess !== "view"}
          />
        </div>

        {!isCreateMode && (
          <div className="space-y-4">
            <OdooCrmCard
              leadId={lead.id}
              odooLeadId={lead.odooLeadId}
              canPublish={isAdmin || user?.odooLeadAccess !== "view"}
            />
            {(isAdmin || user?.odooLeadCanViewAttachments) && (
              <OdooAttachmentsSection
                leadId={lead.id}
                odooLeadId={lead.odooLeadId}
                canUpload={isAdmin || user?.odooLeadAccess === "publish"}
              />
            )}
            {(isAdmin || user?.odooLeadCanViewChatter) && (
              <OdooChatterSection
                leadId={lead.id}
                odooLeadId={lead.odooLeadId}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LeadDetailForm({
  lead,
  isCreateMode = false,
  isCreateFromVisit = false,
  visitaId = null,
  returnTo = null,
  entidadeId = null,
  contactoId = null,
  hasContext = false,
  contactosDisponiveis = [],
  canEdit = true,
}: {
  lead: Lead;
  isCreateMode?: boolean;
  isCreateFromVisit?: boolean;
  visitaId?: string | null;
  returnTo?: string | null;
  entidadeId?: string | null;
  contactoId?: string | null;
  hasContext?: boolean;
  contactosDisponiveis?: Array<{ id: string; nome: string; origem: string }>;
  canEdit?: boolean;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [marcasSearch, setMarcasSearch] = useState("");
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [summarizing, setSummarizing] = useState(false);

  const audio = useAudioTranscription();

  const { data: marcas = [] } = useQuery<Marca[]>({
    queryKey: ["/api/marcas", "onlyAtivas"],
    queryFn: async () => {
      const response = await fetch("/api/marcas?onlyAtivas=true", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch marcas");
      return response.json();
    },
  });

  const { data: empresaSettings } = useQuery<EmpresaLeadTypeSettings>({
    queryKey: ["/api/admin/empresa", "lead-type-settings"],
    queryFn: async () => {
      const response = await fetch("/api/admin/empresa", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch empresa settings");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const [form, setForm] = useState({
    titulo: lead.titulo,
    descricao: lead.descricao ?? "",
    descricaoHtml: lead.descricaoHtml ?? plainTextToHtml(lead.descricao),
    tipoLead: lead.tipoLead ?? "",
    marcasIds: lead.marcas?.map((m) => m.id) ?? [],
    estado: lead.estado ?? "novo",
    valorPrevisto: lead.valorPrevisto ?? "",
    moeda: lead.moeda ?? "EUR",
    contactoId: isCreateMode ? contactoId || "" : lead.contactoId || "",
    entidadeId: isCreateMode && !isCreateFromVisit ? "" : lead.entidadeId || "",
    visitaId: isCreateMode && !isCreateFromVisit ? null : lead.visitaId || null,
  });

  const [saving, setSaving] = useState(false);
  const configuredLeadTypeOptions = Array.isArray(
    empresaSettings?.uiSettings?.odoo?.leadTypeFieldOptions
  )
    ? empresaSettings.uiSettings?.odoo?.leadTypeFieldOptions
        ?.filter(
          (option): option is { value: string; label: string } =>
            typeof option?.label === "string" && option.label.trim().length > 0
        )
        .map((option) => option.label)
    : [];
  const leadTypeFieldEnabled =
    Boolean(empresaSettings?.uiSettings?.odoo?.leadTypeFieldName?.trim()) &&
    empresaSettings?.uiSettings?.odoo?.leadTypeFieldVerified === true;
  const leadTypeFieldType =
    empresaSettings?.uiSettings?.odoo?.leadTypeFieldType ?? null;
  const leadTypeFieldLabel =
    empresaSettings?.uiSettings?.odoo?.leadTypeFieldLabel?.trim() ||
    "Tipo de Lead";
  const leadTypeOptions =
    leadTypeFieldType === "selection" ? configuredLeadTypeOptions : [];
  const normalizedLeadTypeOptions =
    form.tipoLead && !leadTypeOptions.includes(form.tipoLead)
      ? [...leadTypeOptions, form.tipoLead]
      : leadTypeOptions;

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
        descricaoHtml: (() => {
          const currentPlain = htmlToPlainText(f.descricaoHtml);
          const nextPlain = currentPlain ? currentPlain + "\n\n" + text : text;
          return plainTextToHtml(nextPlain);
        })(),
      }));
      toast({
        title: "Sucesso",
        description: "Áudio transcrito e adicionado à descrição.",
      });
    } catch (error: any) {
      console.error("[AdminLeadDetailPage] Erro na transcrição:", error);
      const errorMsg =
        error instanceof Error ? error.message : "Falha na transcrição de áudio.";
      toast({
        title: "Erro na transcrição",
        description: errorMsg || "Falha na transcrição de áudio.",
        variant: "destructive",
      });
    }
  };

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

      setForm((f) => ({
        ...f,
        descricao: data.text,
        descricaoHtml: plainTextToHtml(data.text),
      }));
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
    (
      e:
        | React.ChangeEvent<HTMLInputElement>
        | React.ChangeEvent<HTMLTextAreaElement>
        | React.ChangeEvent<HTMLSelectElement>
    ) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };

  const handleSave = async () => {
    try {
      setSaving(true);

      const body: any = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        descricaoHtml: form.descricaoHtml.trim() || null,
        marcasIds: form.marcasIds ?? [],
        estado: form.estado || "novo",
        valorPrevisto: form.valorPrevisto ? Number(form.valorPrevisto) : null,
        moeda: form.moeda || "EUR",
      };
      if (leadTypeFieldEnabled) {
        body.tipoLead = form.tipoLead || null;
      }

      if (isCreateMode) {
        if (isCreateFromVisit) {
          if (!entidadeId) {
            throw new Error("Contexto incompleto: entidade ausente");
          }
          if (!form.contactoId) {
            throw new Error("Neste momento é obrigatório associar um contacto ao lead.");
          }
          body.visitaId = visitaId || null;
          body.entidadeId = entidadeId;
          body.contactoId = form.contactoId;
        } else {
          if (!form.entidadeId && !form.contactoId) {
            throw new Error(
              "Tens de associar pelo menos uma Entidade ou um Contacto ao lead."
            );
          }
          body.entidadeId = form.entidadeId || null;
          body.contactoId = form.contactoId || null;
          body.visitaId = form.visitaId || null;
        }
      } else {
        if (!form.entidadeId && !form.contactoId) {
          throw new Error(
            "Tens de associar pelo menos uma Entidade ou um Contacto ao lead."
          );
        }
        body.entidadeId = form.entidadeId || null;
        body.contactoId = form.contactoId || null;
        body.visitaId = form.visitaId || null;
      }

      const method = isCreateMode ? "POST" : "PATCH";
      const endpoint = isCreateMode
        ? "/api/crm/leads"
        : `/api/crm/leads/${lead.id}`;

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

      if (json.approvalRequired) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/crm/leads/approvals"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", lead.id] }),
        ]);
        toast({
          title: "Alterações enviadas para aprovação",
          description:
            "O administrador recebeu o pedido. O Odoo só será atualizado depois da aprovação.",
        });
        navigate(returnTo || "/leads");
        return;
      }

      const savedLeadId = isCreateMode ? json.lead?.id : lead.id;
      const shouldAutoSyncToOdoo =
        !isCreateMode && Boolean(lead.odooLeadId) && Boolean(savedLeadId);

      let syncWarning: string | null = null;
      if (shouldAutoSyncToOdoo) {
        const syncResp = await fetch(`/api/crm/leads/${savedLeadId}/odoo/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ forceAppToOdoo: true }),
        });

        const syncJson = await syncResp.json().catch(() => ({}));
        if (!syncResp.ok || syncJson.success === false) {
          syncWarning =
            syncJson.details ||
            syncJson.message ||
            "A sincronização com o Odoo falhou.";
        }
      }

      toast({
        title: syncWarning
          ? "Lead guardado; Odoo por sincronizar"
          : isCreateMode
            ? "Lead criado"
            : "Lead atualizado",
        description: syncWarning
          ? `A alteração ficou guardada na app. ${syncWarning}`
          : isCreateMode
            ? "Novo lead foi criado."
            : shouldAutoSyncToOdoo
              ? "Os dados do lead foram guardados e sincronizados com o Odoo."
              : "Os dados do lead foram guardados.",
        variant: syncWarning ? "destructive" : "default",
      });

      if (isCreateMode && json.lead?.id) {
        const createdId = json.lead.id;
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] }),
          visitaId &&
            queryClient.invalidateQueries({
              queryKey: ["/api/crm/leads", { visitaId }],
            }),
        ]);

        let target = `/admin/leads/${createdId}`;

        if (returnTo) {
          target = returnTo;
        } else if (visitaId) {
          target = `/visitas/${visitaId}`;
        }

        navigate(target);
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] }),
          queryClient.invalidateQueries({
            queryKey: ["/api/crm/leads", lead.id],
          }),
          queryClient.invalidateQueries({
            queryKey: ["/api/crm/leads", { visitaId: lead.visitaId }],
          }),
          queryClient.invalidateQueries({
            queryKey: ["/api/crm/leads", { entidadeId: lead.entidadeId }],
          }),
          queryClient.invalidateQueries({
            queryKey: ["/api/crm/leads", { contactoId: lead.contactoId }],
          }),
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
          {!isCreateFromVisit && canEdit && (
            <div className="space-y-3 pb-3 border-b">
              <EntidadeSearchSelect
                value={form.entidadeId}
                selectedLabelOverride={
                  form.entidadeId === lead.entidadeId ? lead.entidadeNome : null
                }
                onChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    entidadeId: value || "",
                    contactoId: "",
                    visitaId: null,
                  }))
                }
                label="Entidade (opcional)"
                placeholder="Pesquisar entidade..."
              />

              {/* Contacto: opcional, mas filtra pela entidade se existir */}
              <ContactoSearchSelect
                value={form.contactoId}
                selectedLabelOverride={
                  form.contactoId === lead.contactoId ? lead.contactoNome : null
                }
                onChange={(value) =>
                  setForm((f) => ({ ...f, contactoId: value || "" }))
                }
                entidadeId={isCreateMode ? form.entidadeId || undefined : undefined}
                label="Contacto (opcional)"
                placeholder="Pesquisar contacto..."
              />

              {/* Visita opcional – só faz sentido depois de escolher Entidade */}
              <VisitaSearchSelect
                value={form.visitaId}
                onChange={(value) =>
                  setForm((f) => ({ ...f, visitaId: value || null }))
                }
                entidadeId={form.entidadeId || undefined}
                label="Visita (opcional)"
                placeholder="Pesquisar visita..."
                disabled={!form.entidadeId}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Entidade</div>
              {lead.entidadeNome ? (
                <button
                  type="button"
                  className="underline-offset-2 hover:underline text-left"
                  onClick={() =>
                    navigate(
                      `/entidades/${lead.entidadeId}?returnTo=${encodeURIComponent(
                        `/admin/leads/${lead.id}`
                      )}`
                    )
                  }
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
              <div className="text-xs text-muted-foreground">
                Contacto principal
              </div>
              {lead.contactoNome ? (
                <button
                  type="button"
                  className="underline-offset-2 hover:underline text-left"
                  onClick={() =>
                    navigate(
                      `/contactos/${lead.contactoId}/detalhes?returnTo=${encodeURIComponent(
                        `/admin/leads/${lead.id}`
                      )}`
                    )
                  }
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
                  onClick={() =>
                    navigate(
                      `/visitas/${lead.visitaId}?returnTo=${encodeURIComponent(
                        `/admin/leads/${lead.id}`
                      )}`
                    )
                  }
                  data-testid="link-lead-visita"
                >
                  {new Date(lead.visitaData).toLocaleDateString()}
                </button>
              ) : lead.visitaId ? (
                <button
                  type="button"
                  className="underline-offset-2 hover:underline text-left"
                  onClick={() =>
                    navigate(
                      `/visitas/${lead.visitaId}?returnTo=${encodeURIComponent(
                        `/admin/leads/${lead.id}`
                      )}`
                    )
                  }
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
              <div className="text-xs text-muted-foreground font-medium">
                Outros contactos envolvidos:
              </div>
              <div className="flex flex-wrap gap-2">
                {lead.contactosAssociados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      navigate(
                        `/contactos/${c.id}/detalhes?returnTo=${encodeURIComponent(
                          `/admin/leads/${lead.id}`
                        )}`
                      )
                    }
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
              <div className="text-xs text-muted-foreground font-medium">
                Marcas associadas:
              </div>
              <div className="flex flex-wrap gap-2">
                {lead.marcas.map((marca) => (
                  <Badge
                    key={marca.id}
                    variant="secondary"
                    data-testid={`badge-lead-detalhe-marca-${marca.id}`}
                  >
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
          <CardDescription>Edita os dados principais deste lead.</CardDescription>
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
                  onClick={() =>
                    audio.isRecording
                      ? audio.stopRecording()
                      : audio.startRecording()
                  }
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
                      setForm((f) => ({
                        ...f,
                        descricao: (f.descricao || "")
                          ? f.descricao + "\n\n" + text
                          : text,
                        descricaoHtml: (() => {
                          const currentPlain = htmlToPlainText(f.descricaoHtml);
                          const nextPlain = currentPlain
                            ? currentPlain + "\n\n" + text
                            : text;
                          return plainTextToHtml(nextPlain);
                        })(),
                      }));
                      toast({
                        title: "Ficheiro transcrito",
                        description: "Texto adicionado à descrição.",
                      });
                    } catch {
                      // já tratamos erro no hook
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
            <RichTextEditor
              content={form.descricaoHtml}
              onChange={(content) =>
                setForm((f) => ({
                  ...f,
                  descricaoHtml: content,
                  descricao: htmlToPlainText(content),
                }))
              }
              placeholder="Escreve a descrição do lead..."
              className="bg-background"
            />
          </div>

          {isCreateMode && isCreateFromVisit && (
            <div className="space-y-1">
              <Label htmlFor="lead-contacto">Contacto *</Label>
              <Select
                value={form.contactoId}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, contactoId: value }))
                }
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
            {leadTypeFieldEnabled && (
            <div className="space-y-1">
              <Label htmlFor="lead-tipo">{leadTypeFieldLabel}</Label>
              {leadTypeFieldType === "selection" ? (
              <select
                id="lead-tipo"
                className="border rounded px-2 py-1 text-sm w-full bg-background"
                value={form.tipoLead}
                onChange={handleChange("tipoLead")}
                data-testid="select-lead-tipo"
              >
                <option value="">Seleciona um tipo</option>
                {normalizedLeadTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              ) : (
                <Input
                  id="lead-tipo"
                  value={form.tipoLead}
                  onChange={handleChange("tipoLead")}
                  data-testid="input-lead-tipo"
                />
              )}
            </div>
            )}

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
                      ? `${form.marcasIds.length} marca${
                          form.marcasIds.length === 1 ? "" : "s"
                        } selecionada${
                          form.marcasIds.length === 1 ? "" : "s"
                        }`
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
                    {marcas.filter((marca) =>
                      marca.nome
                        .toLowerCase()
                        .includes(marcasSearch.toLowerCase()),
                    ).length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhuma marca encontrada
                      </div>
                    ) : (
                      marcas
                        .filter((marca) =>
                          marca.nome
                            .toLowerCase()
                            .includes(marcasSearch.toLowerCase())
                        )
                        .map((marca) => {
                          const isSelected = form.marcasIds?.includes(marca.id);
                          return (
                            <div
                              key={marca.id}
                              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted"
                              onClick={() => {
                                const newIds = isSelected
                                  ? (form.marcasIds || []).filter(
                                      (id) => id !== marca.id
                                    )
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
              const target = visitaId ? `/visitas/${visitaId}` : "/admin/leads";
              navigate(target);
            }}
            data-testid="button-cancelar-lead"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canEdit || saving || !form.titulo.trim()}
            data-testid="button-guardar-lead"
          >
            {!canEdit
              ? "Apenas consulta"
              : saving
                ? "A guardar..."
                : "Guardar alterações"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

type OdooStatusResponse =
  | { configured: true; baseUrl: string; isActive: boolean }
  | { configured: false; message?: string };

function OdooChatterSection({
  leadId,
  odooLeadId,
}: {
  leadId: string;
  odooLeadId: string | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [messageBody, setMessageBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const { data, isLoading, isError } = useQuery<{
    success: boolean;
    canPublish: boolean;
    recipients: Array<{
      id: number;
      name: string;
      email: string | null;
    }>;
    messages: Array<{
      id: number;
      date: string | null;
      body: string | null;
      authorName: string | null;
      messageType: string;
    }>;
  }>({
    queryKey: ["lead-odoo-chatter", leadId],
    queryFn: async () => {
      const response = await fetch(
        `/api/crm/leads/${leadId}/odoo/chatter`,
        { credentials: "include" },
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message || "Erro ao carregar mensagens");
      }
      return json;
    },
    enabled: !!odooLeadId,
  });

  if (!odooLeadId) return null;

  const publishMessage = async () => {
    try {
      setIsPublishing(true);
      const response = await fetch(
        `/api/crm/leads/${leadId}/odoo/chatter`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: messageBody }),
        },
      );
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message || "Erro ao publicar a mensagem");
      }
      setMessageBody("");
      setConfirmOpen(false);
      await qc.invalidateQueries({ queryKey: ["lead-odoo-chatter", leadId] });
      toast({
        title: "Mensagem publicada",
        description: "A mensagem já está disponível no Chatter do Odoo.",
      });
    } catch (error: any) {
      toast({
        title: "Não foi possível publicar",
        description: error?.message || "Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Card data-testid="card-odoo-chatter">
      <CardHeader>
        <CardTitle className="text-sm">Mensagens (Odoo)</CardTitle>
        <CardDescription className="text-xs">
          Histórico recente visível no chatter do lead
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data?.canPublish && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <Label htmlFor="odoo-chatter-message">Nova mensagem</Label>
            <Textarea
              id="odoo-chatter-message"
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              maxLength={5000}
              rows={4}
              placeholder="Escreva uma atualização para o Chatter..."
              data-testid="textarea-odoo-chatter-message"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {messageBody.length}/5000
              </span>
              <Button
                type="button"
                size="sm"
                disabled={!messageBody.trim() || isPublishing}
                onClick={() => setConfirmOpen(true)}
                data-testid="button-publish-odoo-chatter"
              >
                Publicar no Odoo
              </Button>
            </div>
          </div>
        )}
        {isLoading && (
          <p className="text-xs text-muted-foreground">A carregar mensagens...</p>
        )}
        {isError && (
          <p className="text-xs text-destructive">
            Não foi possível carregar as mensagens.
          </p>
        )}
        {!isLoading && !isError && !data?.messages.length && (
          <p className="text-xs text-muted-foreground">Sem mensagens.</p>
        )}
        {data?.messages.map((message) => (
          <div key={message.id} className="rounded-md border p-3">
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>{message.authorName || "Odoo"}</span>
              <span>
                {message.date
                  ? new Date(message.date.replace(" ", "T") + "Z").toLocaleString()
                  : ""}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {message.body || "Mensagem sem texto."}
            </p>
          </div>
        ))}
      </CardContent>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar esta mensagem no Odoo?</AlertDialogTitle>
            <AlertDialogDescription>
              A mensagem ficará assinada com o seu nome e email. Os seguidores
              abaixo poderão ser notificados de acordo com as preferências do Odoo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3 text-sm">
            {data?.recipients?.length ? (
              data.recipients.map((recipient) => (
                <div key={recipient.id}>
                  <span className="font-medium">{recipient.name}</span>
                  {recipient.email ? (
                    <span className="text-muted-foreground"> · {recipient.email}</span>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">
                Este lead não tem seguidores ativos identificados no Odoo.
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPublishing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPublishing || !messageBody.trim()}
              onClick={(event) => {
                event.preventDefault();
                void publishMessage();
              }}
              data-testid="button-confirm-publish-odoo-chatter"
            >
              {isPublishing ? "A publicar..." : "Confirmar publicação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function OdooAttachmentsSection({
  leadId,
  odooLeadId,
  canUpload,
}: {
  leadId: string;
  odooLeadId: string | null;
  canUpload: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasOdooLead = !!odooLeadId;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["lead-odoo-attachments", leadId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/leads/${leadId}/odoo/attachments`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao carregar anexos");
      return res.json() as Promise<{
        success: boolean;
        attachments?: OdooLeadAttachment[];
      }>;
    },
    enabled: hasOdooLead,
  });

  if (!hasOdooLead) {
    return (
      <div className="mt-2 text-xs text-slate-500">
        Este lead ainda não existe no Odoo, por isso não há anexos para mostrar.
      </div>
    );
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const resp = await fetch(`/api/crm/leads/${leadId}/odoo/attachments`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const json = await resp.json();

      if (!resp.ok || !json.success) {
        toast({
          title: "Erro",
          description:
            json?.message ||
            "Erro ao enviar o ficheiro para o Odoo. Tenta novamente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: "Ficheiro enviado para o Odoo com sucesso.",
      });

      await qc.invalidateQueries({
        queryKey: ["lead-odoo-attachments", leadId],
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Erro no upload de anexo Odoo", err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao enviar o ficheiro para o Odoo.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mt-2 text-xs text-slate-500">
        A carregar anexos do Odoo...
      </div>
    );
  }

  if (isError || !data?.success) {
    return (
      <div className="mt-2 text-xs text-red-500">
        Erro ao carregar anexos do Odoo.
      </div>
    );
  }

  const attachments = data.attachments ?? [];

  return (
    <Card data-testid="card-odoo-attachments">
      <CardHeader>
        <CardTitle className="text-sm">Anexos (Odoo)</CardTitle>
        <CardDescription className="text-xs">
          Ficheiros anexados no Odoo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canUpload && <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
            <span
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
              data-testid="button-upload-attachment"
            >
              + Carregar ficheiro
            </span>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
              data-testid="input-file-attachment"
            />
          </label>
          {isUploading && (
            <span className="text-[11px] text-slate-500">
              A enviar ficheiro...
            </span>
          )}
        </div>}

        {attachments.length === 0 ? (
          <div className="text-xs text-slate-500">
            Sem anexos registados no Odoo para este lead.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <AttachmentChip key={att.id} attachment={att} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttachmentChip({ attachment }: { attachment: OdooLeadAttachment }) {
  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "?";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <a
      href={attachment.downloadUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-300 transition-colors"
      data-testid={`link-attachment-${attachment.id}`}
    >
      <FileText className="h-3 w-3 flex-shrink-0" />
      <span className="truncate max-w-[120px]">{attachment.name}</span>
      <span className="text-slate-500 dark:text-slate-400 text-[10px]">
        ({formatFileSize(attachment.fileSize)})
      </span>
      <Download className="h-3 w-3 flex-shrink-0 ml-0.5" />
    </a>
  );
}

function OdooCrmCard({
  leadId,
  odooLeadId,
  canPublish,
}: {
  leadId: string;
  odooLeadId: string | null;
  canPublish: boolean;
}) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);

  const { data: odooStatus, isLoading: statusLoading } =
    useQuery<OdooStatusResponse>({
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

      const message = json.approvalRequired
        ? "Pedido enviado ao administrador para aprovação."
        : json.created
          ? "Lead criado no Odoo."
          : json.pulled
            ? "Lead atualizado a partir do Odoo."
            : "Lead sincronizado com Odoo.";

      toast({
        title: json.approvalRequired ? "Pedido enviado" : "Sucesso",
        description: message,
      });

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

  const handlePull = async () => {
    try {
      setPulling(true);

      const resp = await fetch(`/api/crm/leads/${leadId}/odoo/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const json = await resp.json();

      if (!resp.ok || json.success === false) {
        throw new Error(json.message || `HTTP ${resp.status}`);
      }

      toast({
        title: "Sucesso",
        description: "Lead atualizada a partir do Odoo.",
      });

      await queryClient.invalidateQueries({
        queryKey: ["/api/crm/leads", leadId],
      });
    } catch (error: any) {
      console.error("[Odoo Pull] Error:", error);
      toast({
        title: "Erro ao atualizar do Odoo",
        description: error?.message || "Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setPulling(false);
    }
  };

  const isOdooConfigured =
    odooStatus && "configured" in odooStatus && odooStatus.configured;
  const odooBaseUrl = isOdooConfigured ? (odooStatus as any).baseUrl : null;
  const odooLeadUrl =
    odooLeadId && odooBaseUrl
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
                  Lead sincronizado:{" "}
                  <span className="font-mono text-xs">{odooLeadId}</span>
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePull}
                    disabled={pulling || syncing}
                    data-testid="button-atualizar-do-odoo"
                  >
                    {pulling ? "A atualizar..." : "Atualizar do Odoo"}
                  </Button>
                  {canPublish && (
                    <Button
                      size="sm"
                      onClick={handleSync}
                      disabled={syncing || pulling}
                      data-testid="button-sincronizar-odoo"
                    >
                      {syncing ? "A sincronizar..." : "Sincronizar"}
                    </Button>
                  )}
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
                {canPublish && (
                  <Button
                    size="sm"
                    onClick={handleSync}
                    disabled={syncing}
                    data-testid="button-criar-odoo"
                    className="w-full"
                  >
                    {syncing ? "A criar..." : "Criar lead no Odoo"}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
