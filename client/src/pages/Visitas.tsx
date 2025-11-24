import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { VisitaCard } from "@/components/VisitaCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { VisitasFilterBar, type VisitasFilters } from "@/components/VisitasFilterBar";
import type { VisitaWithRelations } from "@shared/schema";

export default function Visitas() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<VisitasFilters>({});

  // Build query string from filters
  const queryParams = new URLSearchParams();
  if (filters.search) queryParams.set("search", filters.search);
  if (filters.from) queryParams.set("from", filters.from);
  if (filters.to) queryParams.set("to", filters.to);
  if (filters.userId) queryParams.set("userId", filters.userId);
  if (filters.marcaId) queryParams.set("marcaId", filters.marcaId);
  if (filters.hasAudioToTranscribe) queryParams.set("hasAudioToTranscribe", "true");
  if (filters.entidadeId) queryParams.set("entidadeId", filters.entidadeId);
  if (filters.contactoId) queryParams.set("contactoId", filters.contactoId);

  const { data: visitas, isLoading } = useQuery<VisitaWithRelations[]>({
    queryKey: ["/api/visitas", filters],
    queryFn: async () => {
      const response = await fetch(`/api/visitas?${queryParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch visitas");
      return response.json();
    },
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold text-foreground mb-3">Visitas</h1>
          <VisitasFilterBar 
            filters={filters}
            onFilterChange={setFilters}
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
        ) : visitas && visitas.length > 0 ? (
          <div className="space-y-3">
            {visitas.map((visita) => (
              <VisitaCard
                key={visita.id}
                visita={visita}
                onClick={() => setLocation(`/visitas/${visita.id}`)}
              />
            ))}
          </div>
        ) : filters.search ? (
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
    </div>
  );
}
