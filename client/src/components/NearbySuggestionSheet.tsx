import { useLocation } from 'wouter';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MapPin, X } from 'lucide-react';
import type { NearbySuggestion } from '@/hooks/useNearbyVisitSuggestions';

interface NearbySuggestionSheetProps {
  suggestion: NearbySuggestion | null;
  onDismiss: () => void;
}

export function NearbySuggestionSheet({ suggestion, onDismiss }: NearbySuggestionSheetProps) {
  const [, setLocation] = useLocation();

  if (!suggestion) {
    return null;
  }

  const isAgendada = suggestion.tipo === 'visita_agendada';

  const handleOpenVisit = () => {
    if (suggestion.visitaId) {
      setLocation(`/visitas/${suggestion.visitaId}`);
      onDismiss();
    }
  };

  const handleCreateVisit = () => {
    setLocation(`/visitas/nova?entidadeId=${suggestion.entidadeId}&tipoSugestao=${suggestion.tipo}`);
    onDismiss();
  };

  return (
    <Sheet open={!!suggestion} onOpenChange={(open) => !open && onDismiss()}>
      <SheetContent side="bottom" className="sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            <SheetTitle>
              {isAgendada ? 'Visita Agendada Próxima' : 'Entidade Sem Visita Recente'}
            </SheetTitle>
            <button
              onClick={onDismiss}
              className="ml-auto"
              data-testid="button-close-suggestion"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </SheetHeader>

        <SheetDescription className="space-y-4 mt-4">
          <div>
            <p className="font-semibold text-foreground text-lg">
              {suggestion.entidadeNome}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {suggestion.distanciaMetros}m de distância
            </p>
          </div>

          {isAgendada ? (
            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900">
              <p className="text-sm text-foreground">
                Tens uma visita agendada para <strong>{suggestion.dataVisita}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                O que queres fazer?
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900">
              <p className="text-sm text-foreground">
                Não registas visita há <strong>{suggestion.diasDesdeUltimaVisita} dias</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Queres registar ou agendar uma visita?
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            {isAgendada ? (
              <>
                <Button
                  className="flex-1"
                  onClick={handleOpenVisit}
                  data-testid="button-open-visit"
                >
                  Abrir Visita
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCreateVisit}
                  data-testid="button-create-new-visit"
                >
                  Nova Visita
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="flex-1"
                  onClick={handleCreateVisit}
                  data-testid="button-create-visit-now"
                >
                  Registar Agora
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onDismiss}
                  data-testid="button-dismiss-suggestion"
                >
                  Ignorar
                </Button>
              </>
            )}
          </div>
        </SheetDescription>
      </SheetContent>
    </Sheet>
  );
}
