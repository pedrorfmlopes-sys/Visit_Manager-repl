import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, User, Phone, Mail, Building2, Edit, Share2, MessageCircle, Link as LinkIcon, Copy, FileText, Globe, MapPin, Linkedin, Instagram, Facebook, Sparkles, Trash2, Calendar, Store, AlertCircle } from "lucide-react";
import { SiX } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

// Type to normalize different response formats from /api/visitas
type VisitasResponse =
  | VisitaWithRelations[]
  | { visitas: VisitaWithRelations[]; total?: number }
  | { items: VisitaWithRelations[]; total?: number };

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

  const { data: visitasResponse, isLoading: isLoadingVisitas } = useQuery<VisitasResponse>({
    queryKey: ["/api/visitas", "contacto-visitas", contactoId, periodFilter],
    enabled: !!contactoId,
    queryFn: async () => {
      const { from, to } = getDateRange();

      const params = new URLSearchParams({
        contactoId: contactoId || "",
        from: from.toISOString(),
        to: to.toISOString(),
      });

      const response = await fetch(`/api/visitas?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch visitas");
      }

      const data = await response.json();
      console.debug("[DEBUG ContactoDetail] /api/visitas response:", data);

      return data;
    },
  });

  // Normalize response to array format
  const visitasDoContacto: VisitaWithRelations[] = Array.isArray(visitasResponse)
    ? visitasResponse
    : (visitasResponse?.visitas ??
       (visitasResponse as any)?.items ??
       []);

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

  const handleFetchOdooPartner = async () => {
    if (!contacto?.odooPartnerId) return;

    const partnerIdNum = Number(contacto.odooPartnerId);
    if (Number.isNaN(partnerIdNum)) {
      setOdooPartnerError("ID de parceiro Odoo inválido.");
      return;
    }

    setOdooPartnerLoading(true);
    setOdooPartnerError(null);
    setOdooNotConfigured(false);

    try {
      const response = await fetch(`/api/integrations/odoo/partner/${partnerIdNum}`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 404) {
          setOdooPartner(null);
          setOdooPartnerError("Parceiro não encontrado no Odoo.");
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

      setOdooPartner(data.partner ?? null);
    } catch (error) {
      console.error("[Odoo] Error fetching partner for contacto:", error);
      setOdooPartnerError("Erro ao carregar parceiro do Odoo.");
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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.notConfigured) {
        setOdooSearchNotConfigured(true);
        setOdooSearchResults([]);
        return;
      }

      setOdooSearchResults(data.results ?? []);
    } catch (error) {
      console.error("[Odoo] Error searching partners for contacto:", error);
      setOdooSearchError("Erro ao pesquisar parceiros no Odoo.");
    } finally {
      setOdooSearchLoading(false);
    }
  };

  const handleLinkOdooPartnerToContacto = async (partner: OdooPartner) => {
    if (!contacto?.id) return;

    try {
      const response = await fetch(`/api/contactos/${contacto.id}/odoo-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ odooPartnerId: partner.id }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/contactos", contactoId] });

      setOdooSearchOpen(false);
      setOdooSearchResults([]);
      setOdooSearchTerm("");
      setOdooSearchError(null);
      setOdooSearchNotConfigured(false);

      setOdooPartner(null);
      setOdooNotConfigured(false);
      setOdooPartnerError(null);

      setTimeout(() => {
        handleFetchOdooPartner();
      }, 100);
    } catch (error) {
      console.error("[Odoo] Error linking partner to contacto:", error);
      setOdooSearchError("Erro ao ligar o contacto ao parceiro Odoo.");
    }
  };

  const handleUnlinkOdooPartnerFromContacto = async () => {
    if (!contacto?.id) return;

    try {
      const response = await fetch(`/api/contactos/${contacto.id}/odoo-link`, {
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

      queryClient.invalidateQueries({
        queryKey: ["/api/contactos", contactoId],
      });

      setOdooPartner(null);
      setOdooPartnerError(null);
      setOdooNotConfigured(false);

      setOdooSearchOpen(false);
      setOdooSearchResults([]);
      setOdooSearchTerm("");
      setOdooSearchError(null);
      setOdooSearchNotConfigured(false);

      if (contacto) {
        contacto.odooPartnerId = null as any;
      }

      toast({
        title: "Ligação removida",
        description: "O contacto deixou de estar ligado ao parceiro Odoo.",
      });
    } catch (error) {
      console.error("[Odoo] Error unlinking partner from contacto:", error);
      setOdooPartnerError("Erro ao remover ligação ao parceiro Odoo.");
      toast({
        title: "Erro",
        description: "Não foi possível remover a ligação ao parceiro Odoo.",
        variant: "destructive",
      });
    }
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

        {/* Odoo Integration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Odoo
            </CardTitle>
            {contacto.odooPartnerId ? (
              <CardDescription>Detalhes do parceiro Odoo associado a este contacto.</CardDescription>
            ) : (
              <CardDescription>Integração com parceiros Odoo para este contacto.</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {!contacto.odooPartnerId ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Este contacto ainda não está ligado a nenhum parceiro Odoo.
                </p>
                <p className="text-xs text-muted-foreground">
                  Podes ligar este contacto a um parceiro Odoo pesquisando por nome ou email.
                </p>
                <div className="mt-3">
                  <Button
                    size="sm"
                    onClick={() => {
                      setOdooSearchOpen(true);
                      setOdooSearchError(null);
                      setOdooSearchResults([]);
                    }}
                    data-testid="button-odoo-open-search-contacto"
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
                    #{contacto.odooPartnerId}
                  </span>
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleFetchOdooPartner}
                    disabled={odooPartnerLoading}
                    data-testid="button-odoo-fetch-partner-contacto"
                  >
                    {odooPartnerLoading ? "A carregar..." : "Ver detalhes do parceiro"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={handleUnlinkOdooPartnerFromContacto}
                    data-testid="button-odoo-unlink-partner-contacto"
                  >
                    Remover ligação
                  </Button>
                </div>

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
                          {[odooPartner.phone, odooPartner.mobile].filter(Boolean).join(" / ")}
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

                    {(odooPartner.street || odooPartner.city || odooPartner.country) && (
                      <div>
                        <p className="text-sm text-muted-foreground">Localização</p>
                        <p className="text-sm" data-testid="text-odoo-partner-location">
                          {[odooPartner.street, odooPartner.city, odooPartner.country]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
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
            {isLoadingVisitas ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted rounded-md animate-pulse" />
                ))}
              </div>
            ) : visitasDoContacto.length > 0 ? (
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
                Este contacto não tem visitas neste período
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

      <Dialog open={odooSearchOpen} onOpenChange={setOdooSearchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Procurar parceiro Odoo</DialogTitle>
            <DialogDescription>
              Pesquisa por nome ou email para ligar este contacto a um parceiro do Odoo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Nome ou email..."
                value={odooSearchTerm}
                onChange={(e) => setOdooSearchTerm(e.target.value)}
                data-testid="input-odoo-search-term-contacto"
              />
              <Button
                onClick={handleSearchOdooPartners}
                disabled={odooSearchLoading}
                data-testid="button-odoo-search-contacto"
              >
                {odooSearchLoading ? "A pesquisar..." : "Pesquisar"}
              </Button>
            </div>

            {odooSearchNotConfigured && (
              <Alert data-testid="alert-odoo-search-not-configured-contacto">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Integração não configurada</AlertTitle>
                <AlertDescription>
                  Integração Odoo ainda não está configurada para esta empresa.
                </AlertDescription>
              </Alert>
            )}

            {odooSearchError && (
              <Alert variant="destructive" data-testid="alert-odoo-search-error-contacto">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{odooSearchError}</AlertDescription>
              </Alert>
            )}

            {!odooSearchLoading && !odooSearchNotConfigured && (
              <div className="space-y-2 max-h-64 overflow-auto" data-testid="list-odoo-search-results-contacto">
                {odooSearchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Sem resultados. Tenta outro termo de pesquisa.
                  </p>
                )}

                {odooSearchResults.map((partner) => (
                  <button
                    key={partner.id}
                    type="button"
                    onClick={() => handleLinkOdooPartnerToContacto(partner)}
                    className="w-full text-left border rounded-md px-3 py-2 hover:bg-muted focus:outline-none"
                    data-testid={`button-odoo-select-partner-contacto-${partner.id}`}
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
    </div>
  );
}
