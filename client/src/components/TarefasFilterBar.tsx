import { useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, startOfWeek, endOfWeek, subDays } from "date-fns";
import { pt } from "date-fns/locale";

export interface TarefasFilters {
  search?: string;
  status?: "pending" | "done";
  overdue?: boolean;
  assignedUserId?: string;
  entidadeId?: string;
  visitaId?: string;
}

interface TarefasFilterBarProps {
  filters: TarefasFilters;
  onFilterChange: (filters: TarefasFilters) => void;
  showAdminFilters?: boolean;
  users?: { id: string; email: string }[];
  entidades?: { id: string; nome: string }[];
  visitas?: { id: string; titulo: string }[];
  tarefasSettings?: {
    enableFilterStatus?: boolean;
    enableFilterOverdue?: boolean;
    enableFilterAssignedUser?: boolean;
    enableFilterEntidade?: boolean;
    enableFilterVisita?: boolean;
  };
}

export function TarefasFilterBar({
  filters,
  onFilterChange,
  showAdminFilters = false,
  users = [],
  entidades = [],
  visitas = [],
  tarefasSettings,
}: TarefasFilterBarProps) {
  const handleClear = () => {
    onFilterChange({});
  };
  
  // Settings with safe defaults (true = show by default)
  const showStatus = tarefasSettings?.enableFilterStatus ?? true;
  const showOverdue = tarefasSettings?.enableFilterOverdue ?? true;
  const showAssignedUser = tarefasSettings?.enableFilterAssignedUser ?? true;
  const showEntidade = tarefasSettings?.enableFilterEntidade ?? true;
  const showVisita = tarefasSettings?.enableFilterVisita ?? true;
  
  const activeFilters = Object.entries(filters).filter(([, v]) => v !== undefined && v !== "").length;

  return (
    <div className="space-y-2">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Pesquisar tarefas..."
          value={filters.search || ""}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value || undefined })}
          className="pl-10 pr-4"
          data-testid="input-search-tarefas"
        />
      </div>

      {/* Status filters */}
      {showStatus && (
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filters.status === undefined ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange({ ...filters, status: undefined })}
            data-testid="filter-all-status"
          >
            Todas
          </Button>
          <Button
            variant={filters.status === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange({ ...filters, status: "pending" })}
            data-testid="filter-pending"
          >
            Pendentes
          </Button>
          <Button
            variant={filters.status === "done" ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange({ ...filters, status: "done" })}
            data-testid="filter-done"
          >
            Concluídas
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
      )}

      {/* Overdue filter */}
      {showOverdue && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="overdue-filter"
            checked={filters.overdue || false}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                overdue: e.target.checked || undefined,
              })
            }
            className="h-4 w-4 rounded border-input cursor-pointer"
            data-testid="checkbox-overdue"
          />
          <label htmlFor="overdue-filter" className="text-sm cursor-pointer">
            Apenas em atraso
          </label>
        </div>
      )}

      {/* Visit filter */}
      {showVisita && visitas.length > 0 && (
        <div>
          <select
            value={filters.visitaId || ""}
            onChange={(e) =>
              onFilterChange({ ...filters, visitaId: e.target.value || undefined })
            }
            className="text-sm p-2 rounded border border-input bg-background w-full"
            data-testid="select-visita-filter"
          >
            <option value="">Todas as visitas</option>
            {visitas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.titulo}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Admin filters */}
      {showAdminFilters && (showAssignedUser || showEntidade) && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          {showAssignedUser && users.length > 0 && (
            <select
              value={filters.assignedUserId || ""}
              onChange={(e) =>
                onFilterChange({ ...filters, assignedUserId: e.target.value || undefined })
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
          
          {showEntidade && entidades.length > 0 && (
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
        </div>
      )}
    </div>
  );
}
