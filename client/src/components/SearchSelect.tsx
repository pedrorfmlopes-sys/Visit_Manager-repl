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
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  searchMinChars?: number;
}

export function SearchSelect({
  value,
  onChange,
  fetchOptions,
  placeholder = "Pesquisar...",
  label,
  disabled = false,
  searchMinChars = 1,
}: SearchSelectProps) {
  const [searchInput, setSearchInput] = useState("");
  const [options, setOptions] = useState<SearchSelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchInput, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch options on debounced search
  useEffect(() => {
    async function fetchSearch() {
      if (debouncedSearch.length < searchMinChars) {
        setOptions([]);
        setShowDropdown(false);
        return;
      }

      setIsLoading(true);
      try {
        const results = await fetchOptions(debouncedSearch);
        setOptions(results);
        setShowDropdown(results.length > 0);
      } catch (error) {
        console.error("[SearchSelect] Error fetching options:", error);
        setOptions([]);
        setShowDropdown(false);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSearch();
  }, [debouncedSearch, fetchOptions, searchMinChars]);

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
  };

  const handleInputFocus = () => {
    if (options.length > 0) {
      setShowDropdown(true);
    }
  };

  return (
    <div ref={containerRef} className="w-full">
      {label && <Label className="mb-2 block">{label}</Label>}

      <div className="relative">
        <div className="relative">
          <Input
            type="text"
            value={
              value && selectedLabel && !searchInput
                ? selectedLabel
                : searchInput
            }
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={placeholder}
            disabled={disabled}
            className="pr-10"
            data-testid="input-search-select"
          />

          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-auto">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : value && selectedLabel && !searchInput ? (
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
          <Card className="absolute z-50 w-full mt-2 p-2 shadow-lg max-h-64 overflow-y-auto">
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
