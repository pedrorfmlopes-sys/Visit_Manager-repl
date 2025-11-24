import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, MapPin, Phone, Mail, Globe, Edit, Building2, Users, UserCircle, Calendar, Sparkles, Linkedin, Facebook, Instagram, Share2, MessageCircle, Link as LinkIcon, Copy, FileText, Bell, AlertCircle, Download, Trash2 } from "lucide-react";
import { SiX } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const tipoLabels: Record<string, string> = {
  Gabinete: "Gabinete",
  Distribuidor: "Distribuidor",
  Parceiro: "Parceiro",
  Construtor: "Construtor",
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
              <Badge variant="outline" className="mt-1 no-default-hover-elevate no-default-active-elevate" data-testid="badge-tipo">
                {tipoLabels[entidade.tipoEntidade]}
              </Badge>
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
              disabled={deleteEntidadeMutation.isPending}
              data-testid="button-deletar"
            >
              <Trash2 className="h-5 w-5 text-destructive" />
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
