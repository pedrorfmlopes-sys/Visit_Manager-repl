import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { EntidadeCard } from "@/components/EntidadeCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import type { EntidadeWithRelations, EntidadeTipo } from "@shared/schema";

export default function Entidades() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("Todos");

  const { data: entidades, isLoading } = useQuery<EntidadeWithRelations[]>({
    queryKey: ["/api/entidades"],
  });

  const { data: tipos = [] } = useQuery<EntidadeTipo[]>({
    queryKey: ["/api/entidade-tipos"],
  });

  const filteredEntidades = entidades?.filter((entidade) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      entidade.nome.toLowerCase().includes(query) ||
      entidade.cidade?.toLowerCase().includes(query) ||
      entidade.email?.toLowerCase().includes(query) ||
      entidade.nif?.toLowerCase().includes(query);

    const matchesTipo = tipoFilter === "Todos" || entidade.entidadeTipoId === tipoFilter;

    return matchesSearch && matchesTipo;
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold text-foreground mb-3">Entidades</h1>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Pesquisar entidades..."
          />
          
          {tipos.length > 0 && (
            <Tabs value={tipoFilter} onValueChange={setTipoFilter} className="mt-3">
              <TabsList className="w-full grid h-auto gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(tipos.length + 1, 4)}, 1fr)` }} data-testid="tabs-tipo-filter">
                <TabsTrigger value="Todos" className="text-xs py-2" data-testid="tab-todos">Todos</TabsTrigger>
                {tipos.map((tipo) => (
                  <TabsTrigger key={tipo.id} value={tipo.id} className="text-xs py-2" data-testid={`tab-tipo-${tipo.id}`}>
                    {tipo.nome}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : filteredEntidades && filteredEntidades.length > 0 ? (
          <div className="space-y-3">
            {filteredEntidades.map((entidade) => (
              <EntidadeCard
                key={entidade.id}
                entidade={entidade}
                onClick={() => setLocation(`/entidades/${entidade.id}`)}
              />
            ))}
          </div>
        ) : searchQuery || tipoFilter !== "Todos" ? (
          <EmptyState
            icon={Building2}
            title="Nenhum resultado"
            description="Não encontrámos entidades com esse critério de pesquisa."
          />
        ) : (
          <EmptyState
            icon={Building2}
            title="Sem entidades"
            description="Comece por criar a sua primeira entidade."
            actionLabel="Criar Entidade"
            onAction={() => setLocation("/entidades/nova")}
          />
        )}
      </main>
    </div>
  );
}
