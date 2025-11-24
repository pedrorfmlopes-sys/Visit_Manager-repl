import { useEffect, useState, useRef } from 'react';
import { useAuth } from './useAuth';
import { queryClient, apiRequest } from '@/lib/queryClient';

export interface NearbySuggestion {
  tipo: 'visita_agendada' | 'sem_visita_recente';
  entidadeId: string;
  entidadeNome: string;
  visitaId?: string;
  dataVisita?: string;
  diasDesdeUltimaVisita?: number;
  distanciaMetros: number;
}

const COOLDOWN_HOURS = 4;
const POLLING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useNearbyVisitSuggestions() {
  const { user, empresa, isLoading } = useAuth();
  const [suggestion, setSuggestion] = useState<NearbySuggestion | null>(null);
  const [isActive, setIsActive] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const cooldownMapRef = useRef<Record<string, number>>({});

  // Check if feature is enabled
  useEffect(() => {
    if (isLoading || !user || !empresa) {
      setIsActive(false);
      return;
    }

    // Only active for agents, if empresa has GPS enabled
    const enableGPS = empresa.mostrarGPS === true;
    const userAllowsIt = user.userSettings?.localizacao?.enableNearbySuggestions !== false;

    setIsActive(enableGPS && userAllowsIt && user.role === 'agent');
  }, [user, empresa, isLoading]);

  // Start geolocation watch
  useEffect(() => {
    if (!isActive) return;

    let watchId: number | null = null;

    const startWatch = () => {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;

            try {
              const response = await apiRequest('/api/visitas/proximidade', {
                method: 'POST',
                body: { lat: latitude, lng: longitude },
              });

              const data = await response.json();

              if (data.sugestao) {
                // Check cooldown
                const lastShownTime = cooldownMapRef.current[data.sugestao.entidadeId];
                const now = Date.now();
                const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;

                if (!lastShownTime || now - lastShownTime > cooldownMs) {
                  setSuggestion(data.sugestao);
                  cooldownMapRef.current[data.sugestao.entidadeId] = now;
                }
              }
            } catch (error) {
              console.error('Error getting nearby suggestions:', error);
            }
          },
          (error) => {
            console.error('Geolocation error:', error);
          },
          {
            enableHighAccuracy: false,
            maximumAge: 30000,
            timeout: 10000,
          }
        );

        watchIdRef.current = watchId;
      }
    };

    // Start immediately
    startWatch();

    // Cleanup
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isActive]);

  const dismissSuggestion = () => {
    setSuggestion(null);
  };

  return {
    suggestion,
    dismissSuggestion,
    isActive,
  };
}
