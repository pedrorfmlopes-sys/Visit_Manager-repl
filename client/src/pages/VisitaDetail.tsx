import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Calendar, Download, MapPin, Clock, User, Building2, FileText, Share2 } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { VisitaWithRelations } from "@shared/schema";
import { downloadICS, downloadNextVisitICS } from "@/lib/calendarExport";
import { generateVisitPDF } from "@/lib/pdfExport";
import { LocationPreview } from "@/components/LocationPreview";

export default function VisitaDetail() {
  const [, params] = useRoute("/visitas/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const visitaId = params?.id;

  const { data: visita, isLoading } = useQuery<VisitaWithRelations>({
    queryKey: ["/api/visitas", visitaId],
    enabled: !!visitaId,
  });

  const handleExportToCalendar = () => {
    if (visita) {
      downloadICS(visita);
      toast({
        title: "Exportado",
        description: "Ficheiro .ics descarregado. Adicione ao seu calendário!",
      });
    }
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

  const handleExportPDF = () => {
    if (visita) {
      generateVisitPDF(visita);
      toast({
        title: "Exportado",
        description: "Relatório PDF descarregado com sucesso!",
      });
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/visitas/${visitaId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Visita - ${visita?.gabinete?.nome}`,
          text: `Detalhes da visita a ${visita?.gabinete?.nome}`,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link copiado",
        description: "Link único da visita copiado para a área de transferência!",
      });
    }
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
              <CardTitle className="text-base">Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground whitespace-pre-wrap">{visita.notas}</p>
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

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            variant="outline"
            onClick={handleExportToCalendar}
            data-testid="button-export-calendar"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Exportar para Calendário
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            data-testid="button-export-pdf"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
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
    </div>
  );
}
