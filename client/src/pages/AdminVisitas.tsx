import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { VisitaCard } from "@/components/VisitaCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  VisitasFilterBar,
  type VisitasFilters,
} from "@/components/VisitasFilterBar";
import type { VisitaWithRelations } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/use-user-context";
import { Button } from "@/components/ui/button";

export default function AdminVisitas() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<VisitasFilters>({});
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [marcas, setMarcas] = useState<{ id: string; nome: string }[]>([]);
  const [entidades, setEntidades] = useState<{ id: string; nome: string }[]>(
    []
  );
  const [contactos, setContactos] = useState<{ id: string; nome: string }[]>(
    []
  );
  const { empresa } = useAuth();
  const isAdmin = useIsAdmin();

  // Buscar utilizadores, marcas, entidades e contactos para os filtros
  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const [usersRes, marcasRes, entidadesRes, contactosRes] =
          await Promise.all([
            fetch("/api/admin/utilizadores", { credentials: "include" }),
            fetch("/api/marcas", { credentials: "include" }),
            fetch("/api/entidades", { credentials: "include" }),
            fetch("/api/contactos", { credentials: "include" }),
          ]);

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData);
        }

        if (marcasRes.ok) {
          const marcasData = await marcasRes.json();
          setMarcas(marcasData);
        }

        if (entidadesRes.ok) {
          const entidadesData = await entidadesRes.json();
          setEntidades(entidadesData);
        }

        if (contactosRes.ok) {
          const contactosData = await contactosRes.json();
          setContactos(contactosData);
        }
      } catch (error) {
        console.error("Error fetching admin data:", error);
      }
    };

    fetchAdminData();
  }, []);

  // Build query string a partir dos filtros
  const queryParams = new URLSearchParams();
  if (filters.search) queryParams.set("search", filters.search);
  if (filters.from) queryParams.set("from", filters.from);
  if (filters.to) queryParams.set("to", filters.to);
  if (filters.userId) queryParams.set("userId", filters.userId);
  if (filters.marcaId) queryParams.set("marcaId", filters.marcaId);
  if (filters.hasAudioToTranscribe)
    queryParams.set("hasAudioToTranscribe", "true");
  if (filters.entidadeId) queryParams.set("entidadeId", filters.entidadeId);
  if (filters.contactoId) queryParams.set("contactoId", filters.contactoId);

  const { data: visitas, isLoading } = useQuery<VisitaWithRelations[]>({
    queryKey: ["/api/visitas", filters],
    queryFn: async () => {
      const response = await fetch(`/api/visitas?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch visitas");
      return response.json();
    },
  });

  const hasActiveFilters = Object.values(filters).some(
    (value) => value !== undefined && value !== ""
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h1 className="text-xl font-semibold text-foreground">
              Visitas (Admin)
            </h1>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/visitas")}
                  data-testid="button-go-user-visitas"
                >
                  Vista utilizador
                </Button>
              )}

              <Button
                size="icon"
                onClick={() => setLocation("/visitas/nova")}
                data-testid="button-create-visita-admin-header"
                title="Criar nova visita"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <VisitasFilterBar
            filters={filters}
            onFilterChange={setFilters}
            showAdminFilters={true}
            users={users}
            marcas={empresa?.mostrarMarcasEmVisitas ? marcas : []}
            entidades={entidades}
            contactos={contactos}
            visitasSettings={empresa?.uiSettings?.visitas}
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
        ) : hasActiveFilters ? (
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
