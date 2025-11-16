import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { GabineteCard } from "@/components/GabineteCard";
import { FAB } from "@/components/FAB";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import type { Gabinete } from "@shared/schema";

export default function Gabinetes() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: gabinetes, isLoading } = useQuery<Gabinete[]>({
    queryKey: ["/api/gabinetes"],
  });

  const filteredGabinetes = gabinetes?.filter((gabinete) => {
    const query = searchQuery.toLowerCase();
    return (
      gabinete.nome.toLowerCase().includes(query) ||
      gabinete.cidade?.toLowerCase().includes(query) ||
      gabinete.email?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold text-foreground mb-3">Gabinetes</h1>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Pesquisar gabinetes..."
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : filteredGabinetes && filteredGabinetes.length > 0 ? (
          <div className="space-y-3">
            {filteredGabinetes.map((gabinete) => (
              <GabineteCard
                key={gabinete.id}
                gabinete={gabinete}
                onClick={() => setLocation(`/gabinetes/${gabinete.id}`)}
              />
            ))}
          </div>
        ) : searchQuery ? (
          <EmptyState
            icon={Building2}
            title="Nenhum resultado"
            description="Não encontrámos gabinetes com esse critério de pesquisa."
          />
        ) : (
          <EmptyState
            icon={Building2}
            title="Sem gabinetes"
            description="Comece por criar o seu primeiro gabinete de arquitetura."
            actionLabel="Criar Gabinete"
            onAction={() => setLocation("/gabinetes/novo")}
          />
        )}
      </main>

      <FAB
        onClick={() => setLocation("/gabinetes/novo")}
        label="Criar Gabinete"
        testId="button-criar-gabinete"
      />
    </div>
  );
}
