import { MapPin, Navigation, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { GeolocationData } from "@/hooks/useGeolocation";

interface LocationPreviewProps {
  location: GeolocationData | null;
  error: string | null;
  isLoading: boolean;
  onRequestLocation: () => void;
  showMap?: boolean;
}

export function LocationPreview({
  location,
  error,
  isLoading,
  onRequestLocation,
  showMap = false,
}: LocationPreviewProps) {
  const getMapUrl = () => {
    if (!location) return '';
    return `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`;
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!location) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={onRequestLocation}
        disabled={isLoading}
        className="w-full"
        data-testid="button-get-location"
      >
        <Navigation className="mr-2 h-4 w-4" />
        {isLoading ? 'A obter localização...' : 'Obter localização GPS'}
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Localização da Visita
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Latitude</p>
            <p className="font-medium" data-testid="text-latitude">{parseFloat(location.latitude).toFixed(6)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Longitude</p>
            <p className="font-medium" data-testid="text-longitude">{parseFloat(location.longitude).toFixed(6)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Precisão: ±{Math.round(parseFloat(location.accuracy))}m
          </Badge>
        </div>

        {showMap && (
          <a
            href={getMapUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Button variant="outline" size="sm" className="w-full" data-testid="button-view-map">
              <MapPin className="mr-2 h-4 w-4" />
              Ver no Mapa
            </Button>
          </a>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRequestLocation}
          disabled={isLoading}
          className="w-full"
          data-testid="button-update-location"
        >
          {isLoading ? 'A atualizar...' : 'Atualizar localização'}
        </Button>
      </CardContent>
    </Card>
  );
}
