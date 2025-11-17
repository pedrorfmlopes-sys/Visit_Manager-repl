import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Building2, Globe, Mail, MapPin, Phone, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { PTEnrichmentResult, FuzzyMatch, WebScanData } from '@/lib/enrichmentUtils';

interface PTCompanySearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (data: PTEnrichmentResult) => void;
  placeholder?: string;
  existingEntityId?: number;
  disabled?: boolean;
  className?: string;
}

export function PTCompanySearch({
  value,
  onChange,
  onSelect,
  placeholder = 'Nome da empresa...',
  existingEntityId,
  disabled = false,
  className = '',
}: PTCompanySearchProps) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!value || value.trim().length === 0) {
      setDebouncedValue('');
      setShowSuggestions(false);
      return;
    }
    
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, 500);

    return () => clearTimeout(timer);
  }, [value]);

  const { data, isLoading, isFetching, error } = useQuery<PTEnrichmentResult>({
    queryKey: ['/api/enrichment/pt-intelligent-search', debouncedValue, existingEntityId],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/enrichment/pt-intelligent-search', {
        nome: debouncedValue,
        existingEntityId: existingEntityId,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to search' }));
        throw new Error(errorData.message || 'PT search failed');
      }
      
      const result = await response.json();
      
      return {
        fuzzyMatches: result.fuzzyMatches || [],
        webScanData: result.webScanData || undefined,
        enrichmentSource: result.enrichmentSource || 'none',
      };
    },
    enabled: debouncedValue.length >= 3,
    staleTime: 60000,
    retry: 1,
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Erro na pesquisa",
        description: error instanceof Error ? error.message : "Não foi possível pesquisar empresas",
        variant: "destructive",
      });
      setShowSuggestions(false);
    }
  }, [error, toast]);

  useEffect(() => {
    if (debouncedValue.length >= 3 && data) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [data, debouncedValue]);

  const handleSelectMatch = useCallback((match: FuzzyMatch) => {
    onChange(match.candidate);
    setShowSuggestions(false);
    if (onSelect) {
      onSelect({
        fuzzyMatches: [match],
        enrichmentSource: 'fuzzy',
      });
    }
  }, [onChange, onSelect]);

  const handleSelectWebScan = useCallback(() => {
    if (!data?.webScanData) return;
    
    if (data.webScanData.nome) {
      onChange(data.webScanData.nome);
    }
    setShowSuggestions(false);
    if (onSelect) {
      onSelect({
        fuzzyMatches: [],
        webScanData: data.webScanData,
        enrichmentSource: 'webscan',
      });
    }
  }, [data?.webScanData, onChange, onSelect]);

  const getScoreColor = (score: number): string => {
    if (score >= 0.90) return 'text-green-600 dark:text-green-400';
    if (score >= 0.75) return 'text-blue-600 dark:text-blue-400';
    if (score >= 0.60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-muted-foreground';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 0.90) return 'Correspondência exata';
    if (score >= 0.75) return 'Correspondência forte';
    if (score >= 0.60) return 'Possível correspondência';
    return 'Correspondência fraca';
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (debouncedValue.length >= 3 && (data?.fuzzyMatches.length || data?.webScanData)) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          data-testid="input-pt-company-search"
        />
        {(isLoading || isFetching) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" data-testid="loader-searching" />
          </div>
        )}
      </div>

      {showSuggestions && data && (
        <Card className="absolute z-50 mt-1 w-full max-h-96 overflow-y-auto" data-testid="card-suggestions">
          <CardContent className="p-2 space-y-1">
            {data.fuzzyMatches.length > 0 ? (
              <>
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  Empresas na base de dados
                </div>
                {data.fuzzyMatches.map((match, index) => (
                  <button
                    key={`${match.id}-${index}`}
                    onClick={() => handleSelectMatch(match)}
                    className="w-full text-left p-3 rounded-md hover-elevate active-elevate-2"
                    data-testid={`button-match-${match.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <span className="font-medium truncate">{match.candidate}</span>
                        </div>
                        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {match.website && (
                            <div className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              <span className="truncate">{match.website}</span>
                            </div>
                          )}
                          {match.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span className="truncate">{match.email}</span>
                            </div>
                          )}
                          {match.morada && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{match.morada}</span>
                            </div>
                          )}
                          {match.telefone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <span className="truncate">{match.telefone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge variant="outline" className="text-xs">
                          <span className={getScoreColor(match.score)}>
                            {Math.round(match.score * 100)}%
                          </span>
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {getScoreLabel(match.score)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="font-medium">Nenhuma empresa encontrada</p>
                <p className="text-xs mt-1">
                  Nenhuma correspondência na base de dados para "{debouncedValue}"
                </p>
                <p className="text-xs mt-2">
                  Pode preencher os dados manualmente
                </p>
              </div>
            )}

            <div className="border-t pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSuggestions(false)}
                className="w-full text-xs"
                data-testid="button-close-suggestions"
              >
                Fechar sugestões
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
