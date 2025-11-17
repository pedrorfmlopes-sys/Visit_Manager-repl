import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, MapPin, Phone, Mail, Globe, Edit, Building2, Users, UserCircle, Calendar, Sparkles, Linkedin, Facebook, Instagram, Share2, MessageCircle, Link as LinkIcon, Copy, FileText } from "lucide-react";
import { SiX } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ContactoCard } from "@/components/ContactoCard";
import { VisitaCard } from "@/components/VisitaCard";
import { LocationPreview } from "@/components/LocationPreview";
import { ShareDialog, useShareActions } from "@/components/ShareDialog";
import { QuickActionButton } from "@/components/QuickActionButton";
import { formatEntityForSharing } from "@/lib/shareFormatters";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { EntidadeWithRelations } from "@shared/schema";
import { useState } from "react";

const tipoLabels: Record<string, string> = {
  Gabinete: "Gabinete",
  Cliente: "Cliente",
  Distribuidor: "Distribuidor",
  Obra: "Obra",
  Parceiro: "Parceiro",
  Outro: "Outro",
};

export default function EntidadeDetail() {
  const [, params] = useRoute("/entidades/:id");
  const [, setLocation] = useLocation();
  const entidadeId = params?.id;
  const { toast } = useToast();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  
  const { isOnline, shareViaWhatsApp, shareViaEmail, copyToClipboard, copyLink } = useShareActions();

  const { data: entidade, isLoading } = useQuery<EntidadeWithRelations>({
    queryKey: ["/api/entidades", entidadeId],
    enabled: !!entidadeId,
  });
  
  // Enrichment mutation
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
              onClick={() => enrichMutation.mutate()}
              disabled={enrichMutation.isPending}
              data-testid="button-enrich"
              title="Enriquecer dados"
            >
              {enrichMutation.isPending ? (
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
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
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
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
    </div>
  );
}
