import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { TarefaCard } from "@/components/TarefaCard";
import { FAB } from "@/components/FAB";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TarefaWithRelations } from "@shared/schema";

export default function Tarefas() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done">("all");

  // Build query string
  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (searchQuery) queryParams.set("search", searchQuery);

  const { data: tarefas, isLoading } = useQuery<TarefaWithRelations[]>({
    queryKey: ["/api/tarefas", { statusFilter, searchQuery }],
    queryFn: async () => {
      const response = await fetch(`/api/tarefas?${queryParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch tarefas");
      return response.json();
    },
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold text-foreground mb-3">Tarefas</h1>
          <div className="space-y-3">
            <Input
              type="text"
              placeholder="Pesquisar tarefas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-tarefas"
            />
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
                data-testid="filter-all"
              >
                Todas
              </Button>
              <Button
                variant={statusFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("pending")}
                data-testid="filter-pending"
              >
                Pendentes
              </Button>
              <Button
                variant={statusFilter === "done" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("done")}
                data-testid="filter-done"
              >
                Concluídas
              </Button>
            </div>
          </div>
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
        ) : searchQuery ? (
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

      <FAB
        onClick={() => setLocation("/tarefas/nova")}
        label="Nova Tarefa"
        testId="button-criar-tarefa"
      />
    </div>
  );
}
