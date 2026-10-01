import { useState, useEffect } from 'react';

export interface GeolocationData {
  latitude: string;
  longitude: string;
  accuracy: string;
  timestamp: number;
}

export interface UseGeolocationReturn {
  location: GeolocationData | null;
  error: string | null;
  isLoading: boolean;
  requestLocation: () => void;
}

export function useGeolocation(autoRequest: boolean = false): UseGeolocationReturn {
  const [location, setLocation] = useState<GeolocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada pelo navegador');
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString(),
          accuracy: position.coords.accuracy.toString(),
          timestamp: position.timestamp,
        });
        setIsLoading(false);
      },
      (error) => {
        let errorMessage = 'Erro ao obter localização';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permissão de localização negada. Por favor, ative nas configurações.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Localização indisponível neste momento.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Timeout ao obter localização. Tente novamente.';
            break;
        }
        
        setError(errorMessage);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    if (autoRequest) {
      requestLocation();
    }
  }, [autoRequest]);

  return {
    location,
    error,
    isLoading,
    requestLocation,
  };
}
