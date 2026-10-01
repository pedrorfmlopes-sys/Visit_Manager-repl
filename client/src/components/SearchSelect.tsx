import { useState, useEffect, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { ChevronDown, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

/**
 * FASE SS-02: Generic SearchSelect Component
 * Reusable async search dropdown for CRM entities, contacts, and visits
 */

export interface SearchSelectOption {
  id: string;
  label: string;
  extraInfo?: string | null;
}

export interface SearchSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  fetchOptions: (query: string) => Promise<SearchSelectOption[]>;
  selectedLabelOverride?: string | null;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  searchMinChars?: number;
}

export function SearchSelect({
  value,
  onChange,
  fetchOptions,
  selectedLabelOverride = null,
  placeholder = "Pesquisar...",
  label,
  disabled = false,
  searchMinChars = 0,
}: SearchSelectProps) {
  const [searchInput, setSearchInput] = useState("");
  const [options, setOptions] = useState<SearchSelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchInput, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    async function fetchSearch() {
      if (!showDropdown) return;

      if (debouncedSearch.length < searchMinChars) {
        setOptions([]);
        return;
      }

      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      try {
        const results = await fetchOptions(debouncedSearch);
        if (requestId !== requestIdRef.current) return;
        setOptions(results);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("[SearchSelect] Error fetching options:", error);
        setOptions([]);
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    }

    fetchSearch();
  }, [debouncedSearch, fetchOptions, searchMinChars, showDropdown]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectOption = (option: SearchSelectOption) => {
    onChange(option.id);
    setSelectedLabel(option.label);
    setSearchInput("");
    setShowDropdown(false);
    setOptions([]);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSelectedLabel(null);
    setSearchInput("");
    setShowDropdown(false);
    setOptions([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  return (
    <div ref={containerRef} className="w-full">
      {label && <Label className="mb-2 block">{label}</Label>}

      <div className="relative">
        <div className="relative">
          <Input
            type="text"
            value={
              !searchInput
                ? selectedLabelOverride || selectedLabel || ""
                : searchInput
            }
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={placeholder}
            disabled={disabled}
            className="pr-10"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls="search-select-results"
            data-testid="input-search-select"
          />

          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-auto">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : value &&
              (selectedLabel || selectedLabelOverride) &&
              !searchInput ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClear}
                className="h-6 w-6 p-0"
                data-testid="button-clear-selection"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {showDropdown && (
          <Card
            id="search-select-results"
            role="listbox"
            className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto overscroll-contain p-2 shadow-lg"
            data-testid="search-select-results"
          >
            {isLoading && options.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                A carregar...
              </div>
            ) : options.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Sem resultados
              </div>
            ) : (
              <div className="space-y-1">
                {options.map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={option.id === value}
                    variant="ghost"
                    className="w-full justify-start gap-3 h-auto py-3 px-3 hover-elevate flex-col items-start"
                    onClick={() => handleSelectOption(option)}
                    data-testid={`button-option-${option.id}`}
                  >
                    <span className="font-medium text-foreground text-sm">
                      {option.label}
                    </span>
                    {option.extraInfo && (
                      <span className="text-xs text-muted-foreground">
                        {option.extraInfo}
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
