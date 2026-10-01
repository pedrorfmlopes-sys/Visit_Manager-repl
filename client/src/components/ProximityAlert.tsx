import { MapPin, X } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  buildSuggestionMessage,
  useNearbyVisitSuggestions,
} from "@/hooks/useNearbyVisitSuggestions";

export function ProximityAlert() {
  const [, setLocation] = useLocation();
  const { suggestion, dismissSuggestion } = useNearbyVisitSuggestions();

  if (!suggestion) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-xl rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-xl"
      role="alert"
      data-testid="proximity-alert"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-amber-200 p-2">
          <MapPin className="h-5 w-5" />
        </div>
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setLocation(`/entidades/${suggestion.entidadeId}`)}
        >
          <p className="font-semibold">{suggestion.entidadeNome} está perto</p>
          <p className="mt-1 text-sm">{buildSuggestionMessage(suggestion)}</p>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={dismissSuggestion}
          aria-label="Fechar aviso"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
