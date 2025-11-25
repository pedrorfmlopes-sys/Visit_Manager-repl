import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, User, Phone, Mail, Building2, Edit, Share2, MessageCircle, Link as LinkIcon, Copy, FileText, Globe, MapPin, Linkedin, Instagram, Facebook, Sparkles, Trash2, Calendar } from "lucide-react";
import { SiX } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShareDialog, useShareActions } from "@/components/ShareDialog";
import { EmailAIDialog } from "@/components/EmailAIDialog";
import { QuickActionButton } from "@/components/QuickActionButton";
import { formatContactForSharing } from "@/lib/shareFormatters";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { subDays, subMonths, startOfYear, endOfYear, format } from "date-fns";
import { pt } from "date-fns/locale";
import type { ContactoWithRelations, VisitaWithRelations } from "@shared/schema";

export default function ContactoDetail() {
  const [, params] = useRoute("/contactos/:id/detalhes");
  const [, setLocation] = useLocation();
  const contactoId = params?.id;
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // FASE 5: Filter period for visitas
  const [periodFilter, setPeriodFilter] = useState<"30" | "90" | "180" | "365" | "all">("90");
  
  const { isOnline, shareViaWhatsApp, shareViaEmail, copyToClipboard, copyLink } = useShareActions();

  const { data: contacto, isLoading } = useQuery<ContactoWithRelations>({
    queryKey: ["/api/contactos", contactoId],
    enabled: !!contactoId,
  });

  // FASE 5: Get all visitas filtered by this contacto and date range
  const getDateRange = () => {
    const now = new Date();
    switch (periodFilter) {
      case "30":
        return { from: subDays(now, 30), to: now };
      case "90":
        return { from: subDays(now, 90), to: now };
      case "180":
        return { from: subDays(now, 180), to: now };
      case "365":
        return { from: subDays(now, 365), to: now };
      case "all":
        return { from: new Date(2000, 0, 1), to: now };
      default:
        return { from: subDays(now, 90), to: now };
    }
  };

  const dateRange = getDateRange();

  const { data: visitasDoContacto = [] } = useQuery<VisitaWithRelations[]>({
    queryKey: ["/api/visitas", { contactoId, from: dateRange.from.toISOString(), to: dateRange.to.toISOString() }],
    queryFn: async () => {
      const params = new URLSearchParams({
        contactoId: contactoId || "",
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
      });
      const response = await fetch(`/api/visitas?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch visitas");
      return response.json();
    },
    enabled: !!contactoId,
  });

  // Delete contacto mutation
  const deleteContactoMutation = useMutation({
    mutationFn: async () => {
      if (!contactoId) throw new Error("Contacto ID is required");
      await apiRequest('DELETE', `/api/contactos/${contactoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contactos"] });
      toast({
        title: "Sucesso",
        description: "Contacto eliminado com sucesso",
      });
      setLocation("/contactos");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao eliminar contacto",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">A carregar contacto...</p>
        </div>
      </div>
    );
  }

  if (!contacto) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Contacto não encontrado</p>
          <Button onClick={() => setLocation("/contactos")} className="mt-4">
            Voltar aos contactos
          </Button>
        </div>
      </div>
    );
  }

  // Helper functions for quick actions
  const cleanPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('351') && !cleaned.startsWith('+')) {
      return `351${cleaned}`;
    }
    return cleaned.replace(/^\+/, '');
  };

  const handlePhoneCall = () => {
    if (contacto.telemovel) {
      window.location.href = `tel:${contacto.telemovel}`;
    }
  };

  const handleWhatsApp = () => {
    if (!isOnline) {
      toast({
        title: "Sem internet",
        description: "Esta ação requer ligação à internet.",
        variant: "destructive",
      });
      return;
    }
    if (contacto.telemovel) {
      const cleanNumber = cleanPhoneNumber(contacto.telemovel);
      window.open(`https://wa.me/${cleanNumber}`, '_blank');
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
    if (contacto.email) {
      window.location.href = `mailto:${contacto.email}`;
    }
  };

  const handleWebsite = () => {
    if (!isOnline) {
      toast({
        title: "Sem internet",
        description: "Esta ação requer ligação à internet.",
        variant: "destructive",
      });
      return;
    }
    if (contacto.entidade?.website) {
      window.open(contacto.entidade.website, '_blank');
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
    if (contacto.entidade?.morada) {
      const address = `${contacto.entidade.morada}, ${contacto.entidade.cidade || ''} ${contacto.entidade.codigoPostal || ''}`.trim();
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

  const shareText = formatContactForSharing(contacto);
  
  const shareOptions = [
    {
      icon: MessageCircle,
      label: "Enviar por WhatsApp",
      action: () => shareViaWhatsApp(shareText),
      disabled: !isOnline,
    },
    {
      icon: Mail,
      label: "Enviar por Email",
      action: () => shareViaEmail(shareText, `Contacto - ${contacto.nome}`),
      disabled: !isOnline,
    },
    {
      icon: LinkIcon,
      label: "Copiar Link",
      action: () => copyLink(`/contactos/${contacto.id}/detalhes`),
    },
    {
      icon: FileText,
      label: "Copiar Contacto (texto)",
      action: () => copyToClipboard(shareText, "Contacto copiado!"),
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/contactos")}
              data-testid="button-voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">{contacto.nome}</h1>
              {contacto.funcao && (
                <p className="text-sm text-muted-foreground">{contacto.funcao}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              onClick={() => setLocation(`/contactos/${contactoId}`)}
              data-testid="button-editar"
            >
              <Edit className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteContactoMutation.mutate()}
              disabled={true}
              data-testid="button-deletar"
              title="Contactos só podem ser eliminados pelo Admin nas configurações"
            >
              <Trash2 className="h-5 w-5 text-muted-foreground opacity-50" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informação de Contacto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contacto.entidade && (
              <div>
                <p className="text-sm text-muted-foreground">Entidade</p>
                <div
                  className="flex items-center gap-2 text-primary hover:underline cursor-pointer font-medium"
                  onClick={() => setLocation(`/entidades/${contacto.entidade!.id}`)}
                  data-testid="link-entidade"
                >
                  <Building2 className="h-4 w-4" />
                  {contacto.entidade.nome}
                </div>
              </div>
            )}

            <Separator />

            {contacto.telemovel && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`tel:${contacto.telemovel}`}
                  className="text-primary hover:underline"
                  data-testid="link-telemovel"
                >
                  {contacto.telemovel}
                </a>
              </div>
            )}

            {contacto.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`mailto:${contacto.email}`}
                  className="text-primary hover:underline"
                  data-testid="link-email"
                >
                  {contacto.email}
                </a>
              </div>
            )}

            {contacto.observacoes && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-observacoes">
                    {contacto.observacoes}
                  </p>
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
              {contacto.telemovel && (
                <QuickActionButton
                  icon={Phone}
                  label="Ligar"
                  onClick={handlePhoneCall}
                  testId="button-quick-phone"
                />
              )}
              {contacto.telemovel && (
                <QuickActionButton
                  icon={MessageCircle}
                  label="WhatsApp"
                  onClick={handleWhatsApp}
                  disabled={!isOnline}
                  testId="button-quick-whatsapp"
                />
              )}
              {contacto.email && (
                <QuickActionButton
                  icon={Mail}
                  label="Email"
                  onClick={handleEmail}
                  disabled={!isOnline}
                  testId="button-quick-email"
                />
              )}
              {contacto.entidade?.website && (
                <QuickActionButton
                  icon={Globe}
                  label="Website"
                  onClick={handleWebsite}
                  disabled={!isOnline}
                  testId="button-quick-website"
                />
              )}
              {contacto.entidade?.morada && (
                <QuickActionButton
                  icon={MapPin}
                  label="Morada"
                  onClick={handleMaps}
                  disabled={!isOnline}
                  testId="button-quick-maps"
                />
              )}
              {contacto.entidade?.linkedinUrl && (
                <QuickActionButton
                  icon={Linkedin}
                  label="LinkedIn"
                  onClick={() => handleSocialLink(contacto.entidade!.linkedinUrl!)}
                  disabled={!isOnline}
                  testId="button-quick-linkedin"
                />
              )}
              {contacto.entidade?.instagramUrl && (
                <QuickActionButton
                  icon={Instagram}
                  label="Instagram"
                  onClick={() => handleSocialLink(contacto.entidade!.instagramUrl!)}
                  disabled={!isOnline}
                  testId="button-quick-instagram"
                />
              )}
              {contacto.entidade?.facebookUrl && (
                <QuickActionButton
                  icon={Facebook}
                  label="Facebook"
                  onClick={() => handleSocialLink(contacto.entidade!.facebookUrl!)}
                  disabled={!isOnline}
                  testId="button-quick-facebook"
                />
              )}
              {contacto.entidade?.xUrl && (
                <QuickActionButton
                  icon={SiX}
                  label="X"
                  onClick={() => handleSocialLink(contacto.entidade!.xUrl!)}
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

        {/* FASE 5: Visitas em que participou */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Visitas em que participou
              </CardTitle>
              <Select value={periodFilter} onValueChange={(v: any) => setPeriodFilter(v)} data-testid="select-period-filter">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="180">Últimos 6 meses</SelectItem>
                  <SelectItem value="365">Último ano</SelectItem>
                  <SelectItem value="all">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {visitasDoContacto.length > 0 ? (
              <div className="space-y-2">
                {visitasDoContacto.map((visita) => (
                  <div
                    key={visita.id}
                    className="p-3 border rounded-md bg-muted/30 hover-elevate cursor-pointer"
                    onClick={() => setLocation(`/visitas/${visita.id}`)}
                    data-testid={`row-visita-${visita.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {visita.gabinete?.nome || visita.entidade?.nome}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(visita.dataVisita), "dd MMM yyyy 'às' HH:mm", { locale: pt })}
                        </div>
                        {visita.notas && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {visita.notas.replace(/<[^>]*>/g, '')}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">
                        Ver
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Este contacto ainda não está associado a nenhuma visita neste período
              </p>
            )}
          </CardContent>
        </Card>
      </main>

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title="Partilhar Contacto"
        description={`Partilhar informações de ${contacto.nome}`}
        options={shareOptions}
      />

      <EmailAIDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        contactoId={contactoId}
        defaultTemplate="agradecimento"
      />
    </div>
  );
}
