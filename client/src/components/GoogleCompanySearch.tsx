import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Database,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import type {
  FuzzyMatch,
  PTEnrichmentResult,
  WebScanData,
} from "@/lib/enrichmentUtils";

interface GoogleCompanySearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (data: PTEnrichmentResult) => void;
  placeholder?: string;
  existingEntityId?: string;
  tipoEntidade?: string;
  countryCode?: string;
  disabled?: boolean;
  className?: string;
}
interface UserSettingsResponse {
  userSettings?: {
    entitySearch?: { hideAiFallbackPrompt?: boolean };
    [key: string]: unknown;
  };
}

function ResultDetails({ match }: { match: FuzzyMatch }) {
  return (
    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      {match.website && <div className="flex items-center gap-1"><Globe className="h-3 w-3" /><span className="truncate">{match.website}</span></div>}
      {match.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" /><span className="truncate">{match.email}</span></div>}
      {match.morada && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /><span className="truncate">{match.morada}</span></div>}
      {match.telefone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /><span className="truncate">{match.telefone}</span></div>}
      {match.nif && <div className="truncate">NIF/VAT: {match.nif}</div>}
    </div>
  );
}

export function GoogleCompanySearch({
  value,
  onChange,
  onSelect,
  placeholder = "Nome da empresa...",
  existingEntityId,
  tipoEntidade,
  countryCode = "PT",
  disabled = false,
  className = "",
}: GoogleCompanySearchProps) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<WebScanData | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!value.trim()) {
      setDebouncedValue("");
      setShowSuggestions(false);
      setAiSuggestion(null);
      return;
    }
    const timer = setTimeout(() => setDebouncedValue(value.trim()), 500);
    return () => clearTimeout(timer);
  }, [value]);

  const { data, isLoading, isFetching } = useQuery<PTEnrichmentResult>({
    queryKey: [
      "/api/enrichment/pt-intelligent-search",
      debouncedValue,
      existingEntityId,
      tipoEntidade,
    ],
    queryFn: async () => {
      const response = await apiRequest(
        "POST",
        "/api/enrichment/pt-intelligent-search",
        { nome: debouncedValue, existingEntityId, tipoEntidade },
      );
      return response.json();
    },
    enabled: debouncedValue.length >= 3,
    staleTime: 60_000,
    retry: 1,
  });

  const { data: settingsData } = useQuery<UserSettingsResponse>({
    queryKey: ["/api/user/settings"],
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (debouncedValue.length >= 3 && data) setShowSuggestions(true);
  }, [data, debouncedValue]);

  const aiMutation = useMutation({
    mutationFn: async () => {
      if (dontAskAgain) {
        const currentSettings = settingsData?.userSettings ?? {};
        await apiRequest("PATCH", "/api/user/settings", {
          userSettings: {
            entitySearch: { hideAiFallbackPrompt: true },
          },
        });
        queryClient.invalidateQueries({ queryKey: ["/api/user/settings"] });
      }
      const response = await apiRequest("POST", "/api/enrichment/entity-ai", {
        name: debouncedValue,
        countryCode,
      });
      const payload = await response.json();
      return payload.suggestion as WebScanData | null;
    },
    onSuccess: (suggestion) => setAiSuggestion(suggestion),
  });

  const selectMatch = (match: FuzzyMatch) => {
    onChange(match.candidate);
    setShowSuggestions(false);
    onSelect?.({ fuzzyMatches: [match], enrichmentSource: "fuzzy" });
  };

  const selectAiSuggestion = () => {
    if (!aiSuggestion) return;
    if (aiSuggestion.nome) onChange(aiSuggestion.nome);
    setShowSuggestions(false);
    onSelect?.({
      fuzzyMatches: [],
      webScanData: aiSuggestion,
      enrichmentSource: "webscan",
    });
  };

  const appMatches = data?.fuzzyMatches.filter((match) => match.source !== "odoo") ?? [];
  const odooMatches = data?.fuzzyMatches.filter((match) => match.source === "odoo") ?? [];
  const hasMatches = appMatches.length > 0 || odooMatches.length > 0;
  const hideAiPrompt = settingsData?.userSettings?.entitySearch?.hideAiFallbackPrompt === true;
  const canOfferAi = data?.settings?.aiFallbackEnabled !== false && !hideAiPrompt;

  const renderMatches = (title: string, matches: FuzzyMatch[], source: "app" | "odoo") => {
    if (!matches.length) return null;
    return (
      <div>
        <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
          {source === "odoo" ? <Database className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
          {title}
        </div>
        {matches.map((match) => (
          <button
            type="button"
            key={`${source}-${match.id}`}
            onClick={() => selectMatch(match)}
            className="w-full rounded-md p-3 text-left hover-elevate active-elevate-2"
            data-testid={`button-match-${match.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{match.candidate}</span>
                  <Badge variant="outline" className="text-[10px]">{source === "odoo" ? "Odoo" : "App"}</Badge>
                </div>
                <ResultDetails match={match} />
              </div>
              <span className="text-xs text-muted-foreground">{Math.round(match.score * 100)}%</span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => data && setShowSuggestions(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          data-testid="input-pt-company-search"
        />
        {(isLoading || isFetching) && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" data-testid="loader-searching" />
        )}
      </div>

      {showSuggestions && data && (
        <Card className="absolute z-50 mt-1 max-h-[28rem] w-full overflow-y-auto" data-testid="card-suggestions">
          <CardContent className="space-y-2 p-2">
            {renderMatches("Entidades na aplicação", appMatches, "app")}
            {renderMatches("Parceiros no Odoo", odooMatches, "odoo")}

            {data.odooUnavailable && (
              <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">O Odoo não respondeu; os resultados locais continuam disponíveis.</p>
            )}

            {!hasMatches && !aiSuggestion && (
              <div className="space-y-3 p-3 text-center text-sm">
                <Building2 className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
                <div>
                  <p className="font-medium">Nenhuma entidade encontrada</p>
                  <p className="text-xs text-muted-foreground">Pode preencher manualmente.</p>
                </div>
                {canOfferAi && (
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-left" data-testid="entity-ai-fallback-prompt">
                    <p className="text-sm">Quer pedir à IA para sugerir dados públicos desta entidade?</p>
                    {data.settings?.askBeforeAi !== false && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox checked={dontAskAgain} onCheckedChange={(checked) => setDontAskAgain(checked === true)} />
                        Não voltar a mostrar esta pergunta
                      </label>
                    )}
                    <Button type="button" size="sm" className="w-full gap-2" onClick={() => aiMutation.mutate()} disabled={aiMutation.isPending} data-testid="button-entity-ai-search">
                      {aiMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Pesquisar com IA
                    </Button>
                    {aiMutation.isError && <p className="text-xs text-destructive">A IA não está disponível. Continue manualmente.</p>}
                  </div>
                )}
              </div>
            )}

            {aiSuggestion && (
              <button type="button" onClick={selectAiSuggestion} className="w-full rounded-lg border border-teal-200 bg-teal-50 p-3 text-left" data-testid="button-entity-ai-result">
                <div className="flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4" />{aiSuggestion.nome || debouncedValue}</div>
                {aiSuggestion.morada && <p className="mt-1 text-xs text-muted-foreground">{aiSuggestion.morada}</p>}
                {aiSuggestion.website && <p className="text-xs text-muted-foreground">{aiSuggestion.website}</p>}
                <p className="mt-2 text-xs font-medium text-amber-700">Sugestão da IA: confirme os dados antes de utilizar.</p>
              </button>
            )}

            <Button type="button" variant="ghost" size="sm" onClick={() => setShowSuggestions(false)} className="w-full text-xs" data-testid="button-close-suggestions">Fechar sugestões</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
