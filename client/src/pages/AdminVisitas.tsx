import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { VisitaCard } from "@/components/VisitaCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { VisitasFilterBar, type VisitasFilters } from "@/components/VisitasFilterBar";
import type { VisitaWithRelations } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

export default function AdminVisitas() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<VisitasFilters>({});
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [marcas, setMarcas] = useState<{ id: string; nome: string }[]>([]);
  const { empresa } = useAuth();

  // Fetch users and marcas for filters
  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const [usersRes, marcasRes] = await Promise.all([
          fetch("/api/admin/utilizadores"),
          fetch("/api/marcas"),
        ]);
        
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData);
        }
        
        if (marcasRes.ok) {
          const marcasData = await marcasRes.json();
          setMarcas(marcasData);
        }
      } catch (error) {
        console.error("Error fetching admin data:", error);
      }
    };

    fetchAdminData();
  }, []);

  // Build query string from filters
  const queryParams = new URLSearchParams();
  if (filters.search) queryParams.set("search", filters.search);
  if (filters.from) queryParams.set("from", filters.from);
  if (filters.to) queryParams.set("to", filters.to);
  if (filters.userId) queryParams.set("userId", filters.userId);
  if (filters.marcaId) queryParams.set("marcaId", filters.marcaId);
  if (filters.hasAudioToTranscribe) queryParams.set("hasAudioToTranscribe", "true");

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
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-semibold text-foreground mb-3">Visitas (Admin)</h1>
          <VisitasFilterBar 
            filters={filters}
            onFilterChange={setFilters}
            showAdminFilters={true}
            users={users}
            marcas={empresa?.mostrarMarcasEmVisitas ? marcas : []}
          />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4">
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
        ) : filters.search || filters.userId || filters.marcaId ? (
          <EmptyState
            icon={FileText}
            title="Nenhum resultado"
            description="Não encontrámos visitas com esse critério de pesquisa."
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="Sem visitas"
            description="Nenhuma visita registada."
          />
        )}
      </main>
    </div>
  );
}
