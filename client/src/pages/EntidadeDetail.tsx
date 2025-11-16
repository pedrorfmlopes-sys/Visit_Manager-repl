import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, MapPin, Phone, Mail, Globe, Edit, Building2, Users, UserCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ContactoCard } from "@/components/ContactoCard";
import { VisitaCard } from "@/components/VisitaCard";
import { LocationPreview } from "@/components/LocationPreview";
import type { EntidadeWithRelations } from "@shared/schema";

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

  const { data: entidade, isLoading } = useQuery<EntidadeWithRelations>({
    queryKey: ["/api/entidades", entidadeId],
    enabled: !!entidadeId,
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/entidades/${entidadeId}/editar`)}
            data-testid="button-editar"
          >
            <Edit className="h-5 w-5" />
          </Button>
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
    </div>
  );
}
