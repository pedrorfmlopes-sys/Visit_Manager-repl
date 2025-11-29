import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Plus } from "lucide-react";
import { TarefaCard } from "@/components/TarefaCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  TarefasFilterBar,
  type TarefasFilters,
} from "@/components/TarefasFilterBar";
import type { TarefaWithRelations } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/use-user-context";
import { Button } from "@/components/ui/button";

export default function Tarefas() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<TarefasFilters>({});
  const [visitas, setVisitas] = useState<{ id: string; titulo: string }[]>([]);
  const { empresa } = useAuth();
  const isAdmin = useIsAdmin();

  // Fetch visitas for filter
  useEffect(() => {
    const fetchVisitas = async () => {
      try {
        const response = await fetch("/api/visitas", {
          credentials: "include",
        });
        if (response.ok) {
          const visitasData = await response.json();
          setVisitas(
            visitasData.map((v: any) => ({ id: v.id, titulo: v.titulo }))
          );
        }
      } catch (error) {
        console.error("Error fetching visitas:", error);
      }
    };

    fetchVisitas();
  }, []);

  // Build query string from filters
  const queryParams = new URLSearchParams();
  if (filters.search) queryParams.set("search", filters.search);
  if (filters.status) queryParams.set("status", filters.status);
  if (filters.overdue) queryParams.set("overdue", "true");
  if (filters.assignedUserId)
    queryParams.set("assignedUserId", filters.assignedUserId);
  if (filters.entidadeId) queryParams.set("entidadeId", filters.entidadeId);
  if (filters.visitaId) queryParams.set("visitaId", filters.visitaId);

  const { data: tarefas, isLoading } = useQuery<TarefaWithRelations[]>({
    queryKey: ["/api/tarefas", filters],
    queryFn: async () => {
      const response = await fetch(`/api/tarefas?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch tarefas");
      return response.json();
    },
  });

  const hasActiveFilters =
    !!filters.search ||
    !!filters.status ||
    !!filters.overdue ||
    !!filters.assignedUserId ||
    !!filters.entidadeId ||
    !!filters.visitaId;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h1 className="text-xl font-semibold text-foreground">Tarefas</h1>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/admin/tarefas")}
                  data-testid="button-go-admin-tarefas"
                >
                  Vista admin
                </Button>
              )}

              <Button
                size="icon"
                onClick={() => setLocation("/tarefas/nova")}
                data-testid="button-create-tarefa-header"
                title="Criar nova tarefa"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <TarefasFilterBar
            filters={filters}
            onFilterChange={setFilters}
            visitas={visitas}
            tarefasSettings={empresa?.uiSettings?.tarefas}
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : tarefas && tarefas.length > 0 ? (
          <div className="space-y-3">
            {tarefas.map((tarefa) => (
              <TarefaCard
                key={tarefa.id}
                tarefa={tarefa}
                onClick={() => setLocation(`/tarefas/${tarefa.id}`)}
              />
            ))}
          </div>
        ) : hasActiveFilters ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nenhum resultado"
            description="Não encontrámos tarefas com esse critério de pesquisa."
          />
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="Sem tarefas"
            description="Comece por criar a sua primeira tarefa."
            actionLabel="Nova Tarefa"
            onAction={() => setLocation("/tarefas/nova")}
          />
        )}
      </main>
    </div>
  );
}
