import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { VisitaCard } from "@/components/VisitaCard";
import { FAB } from "@/components/FAB";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import type { VisitaWithRelations } from "@shared/schema";

export default function Visitas() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: visitas, isLoading } = useQuery<VisitaWithRelations[]>({
    queryKey: ["/api/visitas"],
  });

  const filteredVisitas = visitas?.filter((visita) => {
    const query = searchQuery.toLowerCase();
    return (
      visita.gabinete?.nome.toLowerCase().includes(query) ||
      visita.contacto?.nome.toLowerCase().includes(query) ||
      visita.notas?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold text-foreground mb-3">Visitas</h1>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Pesquisar visitas..."
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
        ) : filteredVisitas && filteredVisitas.length > 0 ? (
          <div className="space-y-3">
            {filteredVisitas.map((visita) => (
              <VisitaCard
                key={visita.id}
                visita={visita}
                onClick={() => setLocation(`/visitas/${visita.id}`)}
              />
            ))}
          </div>
        ) : searchQuery ? (
          <EmptyState
            icon={FileText}
            title="Nenhum resultado"
            description="Não encontrámos visitas com esse critério de pesquisa."
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="Sem visitas"
            description="Comece por registar a sua primeira visita comercial."
            actionLabel="Nova Visita"
            onAction={() => setLocation("/visitas/nova")}
          />
        )}
      </main>

      <FAB
        onClick={() => setLocation("/visitas/nova")}
        label="Nova Visita"
        testId="button-criar-visita"
      />
    </div>
  );
}
