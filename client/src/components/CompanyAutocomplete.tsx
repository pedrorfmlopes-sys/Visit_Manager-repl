import { useState, useEffect, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { Building2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ClearbitCompany {
  name: string;
  domain: string;
  logo: string;
}

interface CompanyAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (company: ClearbitCompany) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CompanyAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Nome da empresa",
  disabled = false,
}: CompanyAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<ClearbitCompany[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debouncedValue = useDebounce(value, 500);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchSuggestions() {
      if (!debouncedValue || debouncedValue.length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch('/api/enrichment/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: debouncedValue }),
          credentials: 'include',
        });

        if (response.ok) {
          const results = await response.json();
          setSuggestions(results);
          setShowDropdown(results.length > 0);
        } else {
          setSuggestions([]);
          setShowDropdown(false);
        }
      } catch (error) {
        console.error('[CompanyAutocomplete] Error fetching suggestions:', error);
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSuggestions();
  }, [debouncedValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCompany = (company: ClearbitCompany) => {
    onChange(company.name);
    onSelect(company);
    setShowDropdown(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-10"
          data-testid="input-company-name"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Building2 className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {showDropdown && suggestions.length > 0 && (
        <Card className="absolute z-50 w-full mt-2 p-2 shadow-lg max-h-64 overflow-y-auto">
          {suggestions.map((company, index) => (
            <Button
              key={`${company.domain}-${index}`}
              variant="ghost"
              className="w-full justify-start gap-3 h-auto py-3 px-3 hover-elevate"
              onClick={() => handleSelectCompany(company)}
              data-testid={`button-company-${index}`}
            >
              {company.logo && (
                <img
                  src={company.logo}
                  alt={company.name}
                  className="h-8 w-8 rounded object-contain bg-muted"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="flex flex-col items-start flex-1">
                <span className="font-medium text-foreground">{company.name}</span>
                <span className="text-sm text-muted-foreground">{company.domain}</span>
              </div>
            </Button>
          ))}
        </Card>
      )}
    </div>
  );
}
