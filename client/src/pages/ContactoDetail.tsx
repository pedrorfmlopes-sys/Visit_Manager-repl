import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, User, Phone, Mail, Building2, Edit, Share2, MessageCircle, Link as LinkIcon, Copy, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShareDialog, useShareActions } from "@/components/ShareDialog";
import { formatContactForSharing } from "@/lib/shareFormatters";
import type { ContactoWithRelations } from "@shared/schema";

export default function ContactoDetail() {
  const [, params] = useRoute("/contactos/:id/detalhes");
  const [, setLocation] = useLocation();
  const contactoId = params?.id;
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  
  const { isOnline, shareViaWhatsApp, shareViaEmail, copyToClipboard, copyLink } = useShareActions();

  const { data: contacto, isLoading } = useQuery<ContactoWithRelations>({
    queryKey: ["/api/contactos", contactoId],
    enabled: !!contactoId,
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
      </main>

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title="Partilhar Contacto"
        description={`Partilhar informações de ${contacto.nome}`}
        options={shareOptions}
      />
    </div>
  );
}
