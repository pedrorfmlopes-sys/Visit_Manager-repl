import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Plus } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { TarefaCard } from "@/components/TarefaCard";
import { FAB } from "@/components/FAB";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import type { TarefaWithRelations } from "@shared/schema";
import { Button } from "@/components/ui/button";

export default function Tarefas() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done">("all");

  const { data: tarefas, isLoading } = useQuery<TarefaWithRelations[]>({
    queryKey: ["/api/tarefas"],
  });

  const filteredTarefas = tarefas?.filter((tarefa) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      tarefa.titulo.toLowerCase().includes(query) ||
      tarefa.descricao?.toLowerCase().includes(query) ||
      tarefa.entidade?.nome.toLowerCase().includes(query);
    
    const matchesStatus = statusFilter === "all" || tarefa.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold text-foreground mb-3">Tarefas</h1>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Pesquisar tarefas..."
          />
          <div className="flex gap-2 mt-3">
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
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : filteredTarefas && filteredTarefas.length > 0 ? (
          <div className="space-y-3">
            {filteredTarefas.map((tarefa) => (
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
