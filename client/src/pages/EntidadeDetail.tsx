import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, MapPin, Phone, Mail, Globe, Edit, Building2, Users, UserCircle, Calendar, Sparkles, Linkedin, Facebook, Instagram, Share2, MessageCircle, Link as LinkIcon, Copy, FileText, Bell, AlertCircle, Download, Trash2, Store, Factory, Home, Handshake, Package, Briefcase, Flag } from "lucide-react";
import { SiX } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContactoCard } from "@/components/ContactoCard";
import { VisitaCard } from "@/components/VisitaCard";
import { LocationPreview } from "@/components/LocationPreview";
import { ShareDialog, useShareActions } from "@/components/ShareDialog";
import { EmailAIDialog } from "@/components/EmailAIDialog";
import { QuickActionButton } from "@/components/QuickActionButton";
import { formatEntityForSharing } from "@/lib/shareFormatters";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { EntidadeWithRelations, Lembrete } from "@shared/schema";
import { useState } from "react";

type OdooPartner = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  vat?: string | null;
  city?: string | null;
  country?: string | null;
  street?: string | null;
};

export default function EntidadeDetail() {
  const [, params] = useRoute("/entidades/:id");
  const [, setLocation] = useLocation();
  const entidadeId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [pdfProDialogOpen, setPdfProDialogOpen] = useState(false);
  const [odooPartner, setOdooPartner] = useState<OdooPartner | null>(null);
  const [odooPartnerLoading, setOdooPartnerLoading] = useState(false);
  const [odooPartnerError, setOdooPartnerError] = useState<string | null>(null);
  const [odooNotConfigured, setOdooNotConfigured] = useState(false);
  const [odooSearchOpen, setOdooSearchOpen] = useState(false);
  const [odooSearchTerm, setOdooSearchTerm] = useState("");
  const [odooSearchResults, setOdooSearchResults] = useState<OdooPartner[]>([]);
  const [odooSearchLoading, setOdooSearchLoading] = useState(false);
  const [odooSearchError, setOdooSearchError] = useState<string | null>(null);
  const [odooSearchNotConfigured, setOdooSearchNotConfigured] = useState(false);
  const [pdfProOptions, setPdfProOptions] = useState({
    includePhotos: true,
    includeTasks: true,
    includeIA: true,
    includeCharts: true,
    type: 'interno' as 'interno' | 'cliente'
  });
  
  const { isOnline, shareViaWhatsApp, shareViaEmail, copyToClipboard, copyLink } = useShareActions();

  const { data: entidade, isLoading } = useQuery<EntidadeWithRelations>({
    queryKey: ["/api/entidades", entidadeId],
    enabled: !!entidadeId,
  });
  
  const { data: allLembretes } = useQuery<Lembrete[]>({
    queryKey: ['/api/lembretes'],
  });

  const entityReminders = allLembretes?.filter(l => l.entidadeId === entidadeId) || [];

  // FASE CRM-LEADS-ENT-CONTACTO-STEP1: Load leads for this entity
  type Lead = {
    id: string;
    titulo: string;
    marca: string | null;
    estado: string;
    valorPrevisto: string | null;
    moeda: string | null;
    createdAt: string;
  };

  type LeadsResponse = 
    | { leads: Lead[] }
    | { success: false; notEnabled?: boolean; message?: string };

  const { data: entidadeLeadsData, isLoading: entidadeLeadsLoading } = useQuery<LeadsResponse>({
    queryKey: ["/api/crm/leads", { entidadeId: entidade?.id }],
    enabled: !!entidade?.id,
    queryFn: async () => {
      const params = new URLSearchParams({ entidadeId: entidade!.id });
      const resp = await fetch(`/api/crm/leads?${params.toString()}`, {
        credentials: "include",
      });
      return resp.json();
    },
  });

  const entidadeLeadsDisabled =
    entidadeLeadsData &&
    "success" in entidadeLeadsData &&
    entidadeLeadsData.success === false &&
    entidadeLeadsData.notEnabled === true;

  const entidadeLeads: Lead[] =
    entidadeLeadsData && "leads" in entidadeLeadsData ? entidadeLeadsData.leads : [];

  // Delete entidade mutation
  const deleteEntidadeMutation = useMutation({
    mutationFn: async () => {
      if (!entidadeId) throw new Error("Entidade ID is required");
      await apiRequest('DELETE', `/api/entidades/${entidadeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entidades"] });
      toast({
        title: "Sucesso",
        description: "Entidade eliminada com sucesso",
      });
      setLocation("/entidades");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao eliminar entidade",
        variant: "destructive",
      });
    },
  });
  
  // PT Enrichment mutation
  const ptEnrichMutation = useMutation({
    mutationFn: async () => {
      if (!entidadeId || !entidade) throw new Error("Entity data required");
      
      const searchResponse = await apiRequest('POST', '/api/enrichment/pt-intelligent-search', {
        nome: entidade.nome,
        existingEntityId: entidadeId,
      });
      
      if (!searchResponse.ok) {
        const errorData = await searchResponse.json().catch(() => ({ message: 'PT search failed' }));
        throw new Error(errorData.message || 'Failed to search for enrichment data');
      }
      
      const searchData = await searchResponse.json();
      
      if (searchData.enrichmentSource === 'none' || 
          (!searchData.fuzzyMatches?.length && !searchData.webScanData)) {
        return { enrichmentSource: 'none' };
      }
      
      const dataToApply = searchData.fuzzyMatches?.[0] || searchData.webScanData;
      
      const updatePayload: any = {};
      if (dataToApply.domain && !entidade.domain) updatePayload.domain = dataToApply.domain;
      if (dataToApply.website && !entidade.website) updatePayload.website = dataToApply.website;
      if (dataToApply.logoUrl && !entidade.logoUrl) updatePayload.logoUrl = dataToApply.logoUrl;
      if (dataToApply.morada && !entidade.morada) updatePayload.morada = dataToApply.morada;
      if (dataToApply.telefone && !entidade.telefone) updatePayload.telefone = dataToApply.telefone;
      if (dataToApply.email && !entidade.email) updatePayload.email = dataToApply.email;
      if (dataToApply.descricao && !entidade.descricao) updatePayload.descricao = dataToApply.descricao;
      
      if (Object.keys(updatePayload).length > 0) {
        await apiRequest('PATCH', `/api/entidades/${entidadeId}`, updatePayload);
      }
      
      return searchData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/entidades", entidadeId] });
      
      if (data.enrichmentSource === 'none') {
        toast({
          title: "Sem enriquecimento",
          description: "Não foram encontrados dados adicionais para esta entidade.",
        });
      } else {
        toast({
          title: "Entidade enriquecida",
          description: data.enrichmentSource === 'fuzzy' 
            ? "Dados atualizados da base de dados local" 
            : data.enrichmentSource === 'webscan'
            ? "Dados atualizados da pesquisa online (IA)"
            : "Dados atualizados de múltiplas fontes",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enriquecer",
        description: error.message || "Não foi possível enriquecer a entidade.",
        variant: "destructive",
      });
    },
  });

  // @deprecated Legacy enrichment mutation (use ptEnrichMutation instead)
  const enrichMutation = useMutation({
    mutationFn: async () => {
      if (!entidadeId) throw new Error("Entity ID is required");
      
      const response = await apiRequest('POST', '/api/enrichment/full', {
        entityId: entidadeId,
      });
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/entidades", entidadeId] });
      
      if (data.enrichmentSource === 'none') {
        toast({
          title: "Sem enriquecimento",
          description: "Não foram encontrados dados adicionais para esta entidade.",
        });
      } else {
        toast({
          title: "Entidade enriquecida",
          description: `Dados atualizados com informações de ${data.enrichmentSource}.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enriquecer",
        description: error.message || "Não foi possível enriquecer a entidade.",
        variant: "destructive",
      });
    },
  });

  const handleExportPDFPro = async () => {
    if (!entidade) return;

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

      const response = await fetch(`/api/pdf/entidade/${entidadeId}/pro?${queryParams}`, {
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
      
      const fileName = `Entidade-PRO-${entidade.nome}-${new Date().toISOString().split('T')[0]}.pdf`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Exportado",
        description: "Relatório PDF PRO da entidade descarregado com sucesso!",
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">A carregar entidade...</p>
        </div>
      </div>
    );
  }

  if (!entidade) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Entidade não encontrada</p>
          <Button onClick={() => setLocation("/entidades")} className="mt-4">
            Voltar às entidades
          </Button>
        </div>
      </div>
    );
  }

  const gpsLocation = entidade.latitude && entidade.longitude
    ? {
        latitude: entidade.latitude,
        longitude: entidade.longitude,
        accuracy: "0",
        timestamp: new Date(entidade.createdAt || Date.now()).getTime(),
      }
    : null;

  // Helper functions for quick actions
  const handleWebsite = () => {
    if (!isOnline) {
      toast({
        title: "Sem internet",
        description: "Esta ação requer ligação à internet.",
        variant: "destructive",
      });
      return;
    }
    if (entidade.website) {
      window.open(entidade.website, '_blank');
    }
  };

  const handlePhoneCall = () => {
    if (entidade.telefone) {
      window.location.href = `tel:${entidade.telefone}`;
    }
  };

  const handleEmail = () => {
    if (!isOnline) {
      toast({
        title: "Sem internet",
        description: "Esta ação requer ligação à internet.",
        variant: "destructive",
      });
      return;
    }
    if (entidade.email) {
      window.location.href = `mailto:${entidade.email}`;
    }
  };

  const handleMaps = () => {
    if (!isOnline) {
      toast({
        title: "Sem internet",
        description: "Esta ação requer ligação à internet.",
        variant: "destructive",
      });
      return;
    }
    if (entidade.morada) {
      const address = `${entidade.morada}, ${entidade.cidade || ''} ${entidade.codigoPostal || ''}`.trim();
      const encodedAddress = encodeURIComponent(address);
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
  };

  const handleSocialLink = (url: string) => {
    if (!isOnline) {
      toast({
        title: "Sem internet",
        description: "Esta ação requer ligação à internet.",
        variant: "destructive",
      });
      return;
    }
    window.open(url, '_blank');
  };

  const handleFetchOdooPartner = async () => {
    if (!entidade?.odooPartnerId) {
      return;
    }

    const partnerId = Number(entidade.odooPartnerId);
    if (Number.isNaN(partnerId)) {
      setOdooPartnerError("ID de parceiro inválido");
      return;
    }

    setOdooPartnerLoading(true);
    setOdooPartnerError(null);
    setOdooNotConfigured(false);
    setOdooPartner(null);

    try {
      const response = await fetch(`/api/integrations/odoo/partner/${partnerId}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) {
          setOdooPartnerError("Parceiro não encontrado no Odoo");
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.notConfigured) {
        setOdooNotConfigured(true);
        setOdooPartner(null);
        return;
      }

      if (data.partner) {
        setOdooPartner(data.partner);
      }
    } catch (error: any) {
      console.error("[Odoo] Error fetching partner:", error);
      setOdooPartnerError("Erro ao carregar parceiro do Odoo");
    } finally {
      setOdooPartnerLoading(false);
    }
  };

  const handleSearchOdooPartners = async () => {
    const q = odooSearchTerm.trim();
    if (!q) {
      setOdooSearchError("Introduz um termo de pesquisa.");
      return;
    }

    setOdooSearchLoading(true);
    setOdooSearchError(null);
    setOdooSearchNotConfigured(false);
    setOdooSearchResults([]);

    try {
      const response = await fetch(`/api/integrations/odoo/search-partner?q=${encodeURIComponent(q)}`, {
        method: "GET",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      if (data.notConfigured) {
        setOdooSearchNotConfigured(true);
        setOdooSearchResults([]);
        return;
      }

      setOdooSearchResults(data.results ?? []);
    } catch (error: any) {
      console.error("[Odoo] Error searching partners for entidade:", error);
      setOdooSearchError(
        error?.message || "Erro ao pesquisar parceiros no Odoo."
      );
    } finally {
      setOdooSearchLoading(false);
    }
  };

  const handleLinkOdooPartnerToEntidade = async (partner: OdooPartner) => {
    if (!entidade?.id) return;

    try {
      const response = await fetch(`/api/entidades/${entidade.id}/odoo-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ odooPartnerId: partner.id }),
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/entidades", entidadeId] });
      
      setOdooSearchOpen(false);
      setOdooSearchResults([]);
      setOdooSearchTerm("");
      setOdooSearchError(null);

      setTimeout(() => {
        handleFetchOdooPartner();
      }, 100);

      toast({
        title: "Sucesso",
        description: `Entidade ligada ao parceiro Odoo "${partner.name}"`,
      });
    } catch (error: any) {
      console.error("[Odoo] Error linking entidade to partner:", error);
      setOdooSearchError(
        error?.message || "Erro ao ligar a entidade ao parceiro Odoo."
      );
    }
  };

  const handleUnlinkOdooPartnerFromEntidade = async () => {
    if (!entidade?.id) return;

    try {
      const response = await fetch(`/api/entidades/${entidade.id}/odoo-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ odooPartnerId: null }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/entidades", entidadeId] });
      
      setOdooPartner(null);
      setOdooPartnerError(null);
      setOdooNotConfigured(false);
      setOdooSearchOpen(false);
      setOdooSearchResults([]);
      setOdooSearchTerm("");
      setOdooSearchError(null);
      setOdooSearchNotConfigured(false);

      toast({
        title: "Ligação removida",
        description: "A entidade deixou de estar ligada ao parceiro Odoo.",
      });
    } catch (error) {
      console.error("[Odoo] Error unlinking partner from entidade:", error);
      setOdooPartnerError("Erro ao remover ligação ao parceiro Odoo.");
      toast({
        title: "Erro",
        description: "Não foi possível remover a ligação ao parceiro Odoo.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/entidades")}
              data-testid="button-voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">{entidade.nome}</h1>
              {entidade.entidadeTipo && (
                <Badge variant="outline" className="mt-1 no-default-hover-elevate no-default-active-elevate flex items-center gap-1 w-fit" data-testid="badge-tipo">
                  {/* FASE 30: Show icon from entidade.entidadeTipo.icon */}
                  {(() => {
                    const iconMap = {
                      Building2, Store, Factory, Briefcase, Users, Home, Handshake, Package,
                    };
                    const iconName = entidade.entidadeTipo.icon ?? "Building2";
                    const IconComponent = iconMap[iconName as keyof typeof iconMap] ?? Building2;
                    return <IconComponent className="h-3 w-3" />;
                  })()}
                  {entidade.entidadeTipo.nome}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => ptEnrichMutation.mutate()}
              disabled={ptEnrichMutation.isPending}
              data-testid="button-enrich-pt"
              title="Enriquecer com IA (Portugal)"
            >
              {ptEnrichMutation.isPending ? (
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPdfProDialogOpen(true)}
              disabled={!isOnline || !entidade}
              data-testid="button-export-pdf-pro"
              title="Exportar PDF PRO"
            >
              <Download className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShareDialogOpen(true)}
              data-testid="button-share"
              title="Partilhar"
            >
              <Share2 className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation(`/entidades/${entidadeId}/editar`)}
              data-testid="button-editar"
            >
              <Edit className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteEntidadeMutation.mutate()}
              disabled={true}
              data-testid="button-deletar"
              title="Entidades só podem ser eliminadas pelo Admin nas configurações"
            >
              <Trash2 className="h-5 w-5 text-muted-foreground opacity-50" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Reminder Banner */}
        {entityReminders.length > 0 && (
          <Alert data-testid="alert-entity-reminders">
            <Bell className="h-4 w-4" />
            <AlertTitle>Existem lembretes pendentes</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-2">
              <span>
                {entityReminders.length === 1 
                  ? 'Existe um lembrete pendente para esta entidade.' 
                  : `Existem ${entityReminders.length} lembretes pendentes para esta entidade.`}
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

        {/* FASE CRM-LEADS-ENT-CONTACTO-STEP1: Leads desta entidade */}
        <Card data-testid="card-leads-entidade">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Flag className="w-4 h-4" />
              Leads desta entidade
            </CardTitle>
            <CardDescription className="text-xs">
              Todas as oportunidades associadas a contactos e visitas desta entidade.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {entidadeLeadsDisabled && (
              <p className="text-xs text-amber-600">
                O módulo de Leads CRM está desativado para esta empresa.
              </p>
            )}

            {!entidadeLeadsDisabled && entidadeLeadsLoading && (
              <p className="text-sm text-muted-foreground">A carregar leads...</p>
            )}

            {!entidadeLeadsDisabled && !entidadeLeadsLoading && entidadeLeads.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ainda não existem leads associados a esta entidade.
              </p>
            )}

            {!entidadeLeadsDisabled && !entidadeLeadsLoading && entidadeLeads.length > 0 && (
              <div className="space-y-2">
                {entidadeLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between border rounded-md px-3 py-2 text-sm"
                    data-testid={`row-lead-entidade-${lead.id}`}
                  >
                    <div>
                      <div className="font-medium">{lead.titulo}</div>
                      <div className="text-xs text-muted-foreground">
                        {lead.marca ? `Marca: ${lead.marca} · ` : ""}
                        Estado: {lead.estado}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      {lead.valorPrevisto
                        ? `${lead.valorPrevisto} ${lead.moeda || "EUR"}`
                        : "—"}
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Informação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {entidade.assignedUser && (
              <div>
                <p className="text-sm text-muted-foreground">Atribuído a</p>
                <p className="font-medium" data-testid="text-assigned-user">
                  {entidade.assignedUser.firstName && entidade.assignedUser.lastName
                    ? `${entidade.assignedUser.firstName} ${entidade.assignedUser.lastName}`
                    : entidade.assignedUser.email}
                </p>
              </div>
            )}
            
            {entidade.nif && (
              <div>
                <p className="text-sm text-muted-foreground">NIF</p>
                <p className="font-medium" data-testid="text-nif">{entidade.nif}</p>
              </div>
            )}

            {entidade.morada && (
              <div>
                <p className="text-sm text-muted-foreground">Morada</p>
                <p className="font-medium" data-testid="text-morada">{entidade.morada}</p>
              </div>
            )}

            {(entidade.codigoPostal || entidade.cidade) && (
              <div>
                <p className="text-sm text-muted-foreground">Localização</p>
                <p className="font-medium" data-testid="text-localizacao">
                  {entidade.codigoPostal} {entidade.cidade}
                </p>
              </div>
            )}

            <Separator />

            {entidade.telefone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${entidade.telefone}`} className="text-primary hover:underline" data-testid="link-telefone">
                  {entidade.telefone}
                </a>
              </div>
            )}

            {entidade.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${entidade.email}`} className="text-primary hover:underline" data-testid="link-email">
                  {entidade.email}
                </a>
              </div>
            )}

            {entidade.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a
                  href={entidade.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                  data-testid="link-website"
                >
                  {entidade.website}
                </a>
              </div>
            )}

            {entidade.notas && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Notas</p>
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-notas">{entidade.notas}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {entidade.website && (
                <QuickActionButton
                  icon={Globe}
                  label="Website"
                  onClick={handleWebsite}
                  disabled={!isOnline}
                  testId="button-quick-website"
                />
              )}
              {entidade.telefone && (
                <QuickActionButton
                  icon={Phone}
                  label="Ligar"
                  onClick={handlePhoneCall}
                  testId="button-quick-phone"
                />
              )}
              {entidade.email && (
                <QuickActionButton
                  icon={Mail}
                  label="Email"
                  onClick={handleEmail}
                  disabled={!isOnline}
                  testId="button-quick-email"
                />
              )}
              {entidade.morada && (
                <QuickActionButton
                  icon={MapPin}
                  label="Morada"
                  onClick={handleMaps}
                  disabled={!isOnline}
                  testId="button-quick-maps"
                />
              )}
              {entidade.linkedinUrl && (
                <QuickActionButton
                  icon={Linkedin}
                  label="LinkedIn"
                  onClick={() => handleSocialLink(entidade.linkedinUrl!)}
                  disabled={!isOnline}
                  testId="button-quick-linkedin"
                />
              )}
              {entidade.instagramUrl && (
                <QuickActionButton
                  icon={Instagram}
                  label="Instagram"
                  onClick={() => handleSocialLink(entidade.instagramUrl!)}
                  disabled={!isOnline}
                  testId="button-quick-instagram"
                />
              )}
              {entidade.facebookUrl && (
                <QuickActionButton
                  icon={Facebook}
                  label="Facebook"
                  onClick={() => handleSocialLink(entidade.facebookUrl!)}
                  disabled={!isOnline}
                  testId="button-quick-facebook"
                />
              )}
              {entidade.xUrl && (
                <QuickActionButton
                  icon={SiX}
                  label="X"
                  onClick={() => handleSocialLink(entidade.xUrl!)}
                  disabled={!isOnline}
                  testId="button-quick-x"
                />
              )}
              <QuickActionButton
                icon={Sparkles}
                label="Gerar Email"
                onClick={() => setEmailDialogOpen(true)}
                testId="button-quick-generate-email"
              />
            </div>
          </CardContent>
        </Card>

        {/* Enriched Data */}
        {(entidade.descricao || entidade.industry || entidade.logoUrl || 
          entidade.linkedinUrl || entidade.facebookUrl || entidade.instagramUrl || 
          entidade.xUrl || entidade.enrichmentSource) && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Dados Enriquecidos
                </CardTitle>
                {entidade.enrichmentSource && (
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate" data-testid="badge-enrichment-source">
                    {entidade.enrichmentSource}
                  </Badge>
                )}
              </div>
              {entidade.lastEnrichedAt && (
                <CardDescription data-testid="text-last-enriched">
                  Última atualização: {new Date(entidade.lastEnrichedAt).toLocaleDateString('pt-PT')}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {entidade.logoUrl && (
                <div className="flex items-center justify-center p-4 bg-muted rounded-md">
                  <img 
                    src={entidade.logoUrl} 
                    alt={`${entidade.nome} logo`}
                    className="max-h-20 max-w-full object-contain"
                    data-testid="img-logo"
                  />
                </div>
              )}
              
              {entidade.descricao && (
                <div>
                  <p className="text-sm text-muted-foreground">Descrição</p>
                  <p className="text-sm" data-testid="text-description">{entidade.descricao}</p>
                </div>
              )}
              
              {entidade.industry && (
                <div>
                  <p className="text-sm text-muted-foreground">Indústria</p>
                  <p className="text-sm font-medium" data-testid="text-industry">{entidade.industry}</p>
                </div>
              )}
              
              {(entidade.linkedinUrl || entidade.facebookUrl || entidade.instagramUrl || entidade.xUrl) && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Redes Sociais</p>
                    <div className="flex flex-wrap gap-2">
                      {entidade.linkedinUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          data-testid="link-linkedin"
                        >
                          <a href={entidade.linkedinUrl} target="_blank" rel="noopener noreferrer">
                            <Linkedin className="h-4 w-4 mr-2" />
                            LinkedIn
                          </a>
                        </Button>
                      )}
                      {entidade.facebookUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          data-testid="link-facebook"
                        >
                          <a href={entidade.facebookUrl} target="_blank" rel="noopener noreferrer">
                            <Facebook className="h-4 w-4 mr-2" />
                            Facebook
                          </a>
                        </Button>
                      )}
                      {entidade.instagramUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          data-testid="link-instagram"
                        >
                          <a href={entidade.instagramUrl} target="_blank" rel="noopener noreferrer">
                            <Instagram className="h-4 w-4 mr-2" />
                            Instagram
                          </a>
                        </Button>
                      )}
                      {entidade.xUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          data-testid="link-x"
                        >
                          <a href={entidade.xUrl} target="_blank" rel="noopener noreferrer">
                            <SiX className="h-4 w-4 mr-2" />
                            X
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Odoo Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Odoo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!entidade.odooPartnerId ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Esta entidade ainda não está ligada a nenhum parceiro Odoo.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setOdooSearchOpen(true);
                      setOdooSearchError(null);
                      setOdooSearchResults([]);
                    }}
                    data-testid="button-odoo-open-search"
                  >
                    Ligar a Odoo
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm">
                  <span className="text-muted-foreground">Ligado ao parceiro Odoo </span>
                  <span className="font-medium" data-testid="text-odoo-partner-id">
                    #{entidade.odooPartnerId}
                  </span>
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleFetchOdooPartner}
                    disabled={odooPartnerLoading}
                    data-testid="button-odoo-fetch-partner"
                  >
                    {odooPartnerLoading ? (
                      <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    ) : null}
                    Ver detalhes do parceiro
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={handleUnlinkOdooPartnerFromEntidade}
                    data-testid="button-odoo-unlink-partner"
                  >
                    Remover ligação
                  </Button>
                </div>

                {odooPartnerLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    A carregar...
                  </div>
                )}

                {odooNotConfigured && (
                  <Alert data-testid="alert-odoo-not-configured">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Integração não configurada</AlertTitle>
                    <AlertDescription>
                      Integração Odoo ainda não está configurada para esta empresa.
                    </AlertDescription>
                  </Alert>
                )}

                {odooPartnerError && (
                  <Alert variant="destructive" data-testid="alert-odoo-error">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erro</AlertTitle>
                    <AlertDescription>{odooPartnerError}</AlertDescription>
                  </Alert>
                )}

                {odooPartner && (
                  <div className="space-y-3 pt-2 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Nome</p>
                      <p className="font-medium" data-testid="text-odoo-partner-name">
                        {odooPartner.name}
                      </p>
                    </div>

                    {odooPartner.email && (
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="text-sm" data-testid="text-odoo-partner-email">
                          {odooPartner.email}
                        </p>
                      </div>
                    )}

                    {(odooPartner.phone || odooPartner.mobile) && (
                      <div>
                        <p className="text-sm text-muted-foreground">Telefone</p>
                        <p className="text-sm" data-testid="text-odoo-partner-phone">
                          {odooPartner.phone || odooPartner.mobile}
                        </p>
                      </div>
                    )}

                    {odooPartner.vat && (
                      <div>
                        <p className="text-sm text-muted-foreground">NIF</p>
                        <p className="text-sm" data-testid="text-odoo-partner-vat">
                          {odooPartner.vat}
                        </p>
                      </div>
                    )}

                    {(odooPartner.city || odooPartner.country) && (
                      <div>
                        <p className="text-sm text-muted-foreground">Localização</p>
                        <p className="text-sm" data-testid="text-odoo-partner-location">
                          {[odooPartner.city, odooPartner.country]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    )}

                    {odooPartner.street && (
                      <div>
                        <p className="text-sm text-muted-foreground">Rua</p>
                        <p className="text-sm" data-testid="text-odoo-partner-street">
                          {odooPartner.street}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Geolocation */}
        {gpsLocation && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Geolocalização
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LocationPreview 
                location={gpsLocation} 
                error={null}
                isLoading={false}
                onRequestLocation={() => {}}
              />
            </CardContent>
          </Card>
        )}

        {/* Contacts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                Contactos
                {entidade.contactos && entidade.contactos.length > 0 && (
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                    {entidade.contactos.length}
                  </Badge>
                )}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/contactos/novo?entidadeId=${entidadeId}`)}
                data-testid="button-novo-contacto"
              >
                Novo Contacto
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {entidade.contactos && entidade.contactos.length > 0 ? (
              <div className="space-y-2">
                {entidade.contactos.map((contacto) => (
                  <ContactoCard
                    key={contacto.id}
                    contacto={contacto}
                    onClick={() => setLocation(`/contactos/${contacto.id}`)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sem contactos associados
              </p>
            )}
          </CardContent>
        </Card>

        {/* Visits */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Visitas Recentes
                {entidade.visitas && entidade.visitas.length > 0 && (
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                    {entidade.visitas.length}
                  </Badge>
                )}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/visitas/nova?entidadeId=${entidadeId}`)}
                data-testid="button-nova-visita"
              >
                Nova Visita
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {entidade.visitas && entidade.visitas.length > 0 ? (
              <div className="space-y-2">
                {entidade.visitas.slice(0, 5).map((visita) => (
                  <VisitaCard
                    key={visita.id}
                    visita={visita}
                    onClick={() => setLocation(`/visitas/${visita.id}`)}
                  />
                ))}
                {entidade.visitas.length > 5 && (
                  <Button
                    variant="ghost"
                    className="w-full mt-2"
                    onClick={() => setLocation(`/visitas?entidadeId=${entidadeId}`)}
                  >
                    Ver todas as visitas ({entidade.visitas.length})
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sem visitas registadas
              </p>
            )}
          </CardContent>
        </Card>
      </main>

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title="Partilhar Entidade"
        description={`Partilhar informações de ${entidade.nome}`}
        options={[
          {
            icon: MessageCircle,
            label: "Enviar por WhatsApp",
            action: () => shareViaWhatsApp(formatEntityForSharing(entidade)),
            disabled: !isOnline,
          },
          {
            icon: Mail,
            label: "Enviar por Email",
            action: () => shareViaEmail(formatEntityForSharing(entidade), `Entidade - ${entidade.nome}`),
            disabled: !isOnline,
          },
          {
            icon: LinkIcon,
            label: "Copiar Link",
            action: () => copyLink(`/entidades/${entidade.id}`),
          },
          {
            icon: FileText,
            label: "Copiar Entidade (texto)",
            action: () => copyToClipboard(formatEntityForSharing(entidade), "Entidade copiada!"),
          },
        ]}
      />

      <EmailAIDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        entidadeId={entidadeId}
        defaultTemplate="envio_catalogo"
      />

      <Dialog open={odooSearchOpen} onOpenChange={setOdooSearchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Procurar parceiro Odoo</DialogTitle>
            <DialogDescription>
              Pesquisa por nome ou email para ligar esta entidade a um parceiro do Odoo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Nome ou email..."
                value={odooSearchTerm}
                onChange={(e) => setOdooSearchTerm(e.target.value)}
                data-testid="input-odoo-search-term"
              />
              <Button
                onClick={handleSearchOdooPartners}
                disabled={odooSearchLoading}
                data-testid="button-odoo-search"
              >
                {odooSearchLoading ? "A pesquisar..." : "Pesquisar"}
              </Button>
            </div>

            {odooSearchNotConfigured && (
              <Alert data-testid="alert-odoo-search-not-configured">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Integração não configurada</AlertTitle>
                <AlertDescription>
                  Integração Odoo ainda não está configurada para esta empresa.
                </AlertDescription>
              </Alert>
            )}

            {odooSearchError && (
              <Alert variant="destructive" data-testid="alert-odoo-search-error">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{odooSearchError}</AlertDescription>
              </Alert>
            )}

            {!odooSearchLoading && !odooSearchNotConfigured && (
              <div className="space-y-2 max-h-64 overflow-auto" data-testid="list-odoo-search-results">
                {odooSearchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Sem resultados. Tenta outro termo de pesquisa.
                  </p>
                )}

                {odooSearchResults.map((partner) => (
                  <button
                    key={partner.id}
                    type="button"
                    onClick={() => handleLinkOdooPartnerToEntidade(partner)}
                    className="w-full text-left border rounded-md px-3 py-2 hover:bg-muted focus:outline-none"
                    data-testid={`button-odoo-select-partner-${partner.id}`}
                  >
                    <p className="font-medium">{partner.name}</p>
                    {partner.email && (
                      <p className="text-xs text-muted-foreground">
                        {partner.email}
                      </p>
                    )}
                    {(partner.city || partner.country) && (
                      <p className="text-xs text-muted-foreground">
                        {[partner.city, partner.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pdfProDialogOpen} onOpenChange={setPdfProDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar PDF PRO</DialogTitle>
            <CardDescription>Configure as opções do relatório profissional da entidade</CardDescription>
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
