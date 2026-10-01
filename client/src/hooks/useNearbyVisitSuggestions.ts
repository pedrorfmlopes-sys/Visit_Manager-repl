import { useEffect, useState, useRef } from 'react';
import { useAuth } from './useAuth';
import { apiRequest } from '@/lib/queryClient';

export interface NearbySuggestion {
  tipo: 'tarefa_atrasada' | 'visita_atrasada' | 'sem_visita_recente' | 'nunca_visitada';
  entidadeId: string;
  entidadeNome: string;
  visitaId?: string;
  tarefaId?: string;
  tarefaTitulo?: string;
  dataVisita?: string;
  diasDesdeUltimaVisita?: number;
  distanciaMetros: number;
}

const COOLDOWN_HOURS = 4;
const POLLING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'visit-manager:proximity-alert-cooldowns';

export function useNearbyVisitSuggestions() {
  const { user, empresa, isLoading } = useAuth();
  const [suggestion, setSuggestion] = useState<NearbySuggestion | null>(null);
  const [isActive, setIsActive] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const cooldownMapRef = useRef<Record<string, number>>(
    (() => {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      } catch {
        return {};
      }
    })(),
  );
  const lastRequestRef = useRef(0);

  // Check if feature is enabled
  useEffect(() => {
    if (isLoading || !user || !empresa) {
      setIsActive(false);
      return;
    }

    // Only active for agents, if empresa has GPS enabled
    const enableGPS = empresa.mostrarGPS === true;
    const companyAllowsIt =
      empresa.uiSettings?.gpsProximity?.enabled !== false;

    setIsActive(enableGPS && companyAllowsIt && user.role === 'agent');
  }, [user, empresa, isLoading]);

  // Start geolocation watch
  useEffect(() => {
    if (!isActive) return;

    let watchId: number | null = null;

    const startWatch = () => {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          async (position) => {
            const now = Date.now();
            if (now - lastRequestRef.current < POLLING_INTERVAL_MS) return;
            lastRequestRef.current = now;
            const { latitude, longitude } = position.coords;

            try {
              const response = await apiRequest('POST', '/api/visitas/proximidade', {
                lat: latitude,
                lng: longitude,
              });

              const data = await response.json() as {
                sugestao: NearbySuggestion | null;
                suggestions?: NearbySuggestion[];
              };

              if (data.sugestao) {
                // Check cooldown
                const lastShownTime = cooldownMapRef.current[data.sugestao.entidadeId];
                const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;

                if (!lastShownTime || now - lastShownTime > cooldownMs) {
                  setSuggestion(data.sugestao);
                  cooldownMapRef.current[data.sugestao.entidadeId] = now;
                  localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify(cooldownMapRef.current),
                  );
                  if (
                    typeof Notification !== 'undefined' &&
                    Notification.permission === 'granted'
                  ) {
                    new Notification(`Visita próxima: ${data.sugestao.entidadeNome}`, {
                      body: buildSuggestionMessage(data.sugestao),
                      tag: `proximity-${data.sugestao.entidadeId}`,
                    });
                  }
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

export function buildSuggestionMessage(suggestion: NearbySuggestion): string {
  if (suggestion.tipo === 'tarefa_atrasada') {
    return `Tarefa atrasada: ${suggestion.tarefaTitulo ?? 'tarefa pendente'} (${suggestion.distanciaMetros} m).`;
  }
  if (suggestion.tipo === 'visita_atrasada') {
    return `Há uma visita de acompanhamento atrasada a ${suggestion.distanciaMetros} m.`;
  }
  if (suggestion.tipo === 'nunca_visitada') {
    return `Esta entidade ainda não foi visitada e está a ${suggestion.distanciaMetros} m.`;
  }
  return `Última visita há ${suggestion.diasDesdeUltimaVisita} dias (${suggestion.distanciaMetros} m).`;
}
