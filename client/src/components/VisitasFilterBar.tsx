import { useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, startOfWeek, endOfWeek, subDays } from "date-fns";
import { pt } from "date-fns/locale";

export interface VisitasFilters {
  search?: string;
  from?: string;
  to?: string;
  userId?: string;
  marcaId?: string;
  hasAudioToTranscribe?: boolean;
  entidadeId?: string;
  contactoId?: string;
}

interface VisitasFilterBarProps {
  filters: VisitasFilters;
  onFilterChange: (filters: VisitasFilters) => void;
  showAdminFilters?: boolean;
  users?: { id: string; email: string }[];
  marcas?: { id: string; nome: string }[];
  entidades?: { id: string; nome: string }[];
  contactos?: { id: string; nome: string }[];
}

export function VisitasFilterBar({
  filters,
  onFilterChange,
  showAdminFilters = false,
  users = [],
  marcas = [],
  entidades = [],
  contactos = [],
}: VisitasFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const today = new Date();
  const weekStart = startOfWeek(today, { locale: pt });
  const weekEnd = endOfWeek(today, { locale: pt });
  
  const handleDateFilter = (from: string, to: string) => {
    onFilterChange({ ...filters, from, to });
  };
  
  const handleClear = () => {
    onFilterChange({});
  };
  
  const activeFilters = Object.entries(filters).filter(([, v]) => v !== undefined && v !== "").length;

  return (
    <div className="space-y-2">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Pesquisar visitas..."
          value={filters.search || ""}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value || undefined })}
          className="pl-10 pr-4"
          data-testid="input-search-visitas"
        />
      </div>

      {/* Quick date filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={!filters.from ? "default" : "outline"}
          size="sm"
          onClick={() => handleClear()}
          data-testid="filter-all-dates"
        >
          Tudo
        </Button>
        <Button
          variant={filters.from === format(today, "yyyy-MM-dd") ? "default" : "outline"}
          size="sm"
          onClick={() => {
            const todayStr = format(today, "yyyy-MM-dd");
            handleDateFilter(todayStr, todayStr);
          }}
          data-testid="filter-today"
        >
          Hoje
        </Button>
        <Button
          variant={filters.from === format(weekStart, "yyyy-MM-dd") ? "default" : "outline"}
          size="sm"
          onClick={() => handleDateFilter(format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd"))}
          data-testid="filter-this-week"
        >
          Esta semana
        </Button>
        <Button
          variant={filters.from === format(subDays(today, 30), "yyyy-MM-dd") ? "default" : "outline"}
          size="sm"
          onClick={() => handleDateFilter(format(subDays(today, 30), "yyyy-MM-dd"), format(today, "yyyy-MM-dd"))}
          data-testid="filter-last-30-days"
        >
          Últimos 30 dias
        </Button>
        
        {activeFilters > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            data-testid="button-clear-filters"
          >
            <X className="h-4 w-4" />
            Limpar ({activeFilters})
          </Button>
        )}
      </div>

      {/* Audio filter */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="audio-filter"
          checked={filters.hasAudioToTranscribe || false}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              hasAudioToTranscribe: e.target.checked || undefined,
            })
          }
          className="h-4 w-4 rounded border-input cursor-pointer"
          data-testid="checkbox-audio-to-transcribe"
        />
        <label htmlFor="audio-filter" className="text-sm cursor-pointer">
          Com áudio por transcrever
        </label>
      </div>

      {/* Entity & Contact filters */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
        {entidades.length > 0 && (
          <select
            value={filters.entidadeId || ""}
            onChange={(e) =>
              onFilterChange({ ...filters, entidadeId: e.target.value || undefined })
            }
            className="text-sm p-2 rounded border border-input bg-background"
            data-testid="select-entidade-filter"
          >
            <option value="">Todas as entidades</option>
            {entidades.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        )}
        
        {contactos.length > 0 && (
          <select
            value={filters.contactoId || ""}
            onChange={(e) =>
              onFilterChange({ ...filters, contactoId: e.target.value || undefined })
            }
            className="text-sm p-2 rounded border border-input bg-background"
            data-testid="select-contacto-filter"
          >
            <option value="">Todos os contactos</option>
            {contactos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Admin filters */}
      {showAdminFilters && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          {users.length > 0 && (
            <select
              value={filters.userId || ""}
              onChange={(e) =>
                onFilterChange({ ...filters, userId: e.target.value || undefined })
              }
              className="text-sm p-2 rounded border border-input bg-background"
              data-testid="select-user-filter"
            >
              <option value="">Todos os utilizadores</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          )}
          
          {marcas.length > 0 && (
            <select
              value={filters.marcaId || ""}
              onChange={(e) =>
                onFilterChange({ ...filters, marcaId: e.target.value || undefined })
              }
              className="text-sm p-2 rounded border border-input bg-background"
              data-testid="select-marca-filter"
            >
              <option value="">Todas as marcas</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
