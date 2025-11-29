import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Plus, QrCode } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { ContactoCard } from "@/components/ContactoCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { ContactoWithRelations } from "@shared/schema";

export default function Contactos() {
  const [, setLocation] = useLocation();

  // Pesquisa e filtros locais
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [entidadeFilter, setEntidadeFilter] = useState<string>("Todos");
  const [order, setOrder] = useState<"nome-asc" | "nome-desc">("nome-asc");

  const { data: contactos, isLoading } = useQuery<ContactoWithRelations[]>({
    queryKey: ["/api/contactos"],
  });

  // Lista de entidades distintas a partir dos contactos (id + nome)
  const entidadesOptions = Array.from(
    new Map(
      (contactos ?? [])
        .filter((c) => c.entidade && c.entidade.id && c.entidade.nome)
        .map((c) => [c.entidade!.id, c.entidade!.nome])
    ).entries()
  ).map(([id, nome]) => ({ id, nome }));

  const filteredContactos = contactos?.filter((contacto) => {
    const query = searchQuery.toLowerCase().trim();

    const matchesSearch =
      !query ||
      contacto.nome.toLowerCase().includes(query) ||
      contacto.funcao?.toLowerCase().includes(query) ||
      contacto.email?.toLowerCase().includes(query) ||
      contacto.entidade?.nome.toLowerCase().includes(query);

    // Estado: se contacto.ativo === false -> Inativo
    // Caso contrário (true, undefined, null) tratamos como Ativo
    const isInativo = (contacto as any).ativo === false;
    const isAtivo = !isInativo;

    const matchesStatus =
      statusFilter === "Todos" ||
      (statusFilter === "Ativos" && isAtivo) ||
      (statusFilter === "Inativos" && isInativo);

    // Filtro por entidade:
    // - "Todos" -> não filtra
    // - "SemEntidade" -> só contactos sem entidade associada
    // - outro valor -> entidadeId === valor
    const matchesEntidade =
      entidadeFilter === "Todos" ||
      (entidadeFilter === "SemEntidade" && !contacto.entidadeId) ||
      (entidadeFilter === contacto.entidadeId);

    return matchesSearch && matchesStatus && matchesEntidade;
  });

  // Ordenação em memória
  const sortedContactos = [...(filteredContactos ?? [])].sort((a, b) => {
    const dir = order === "nome-asc" ? 1 : -1;
    return a.nome.localeCompare(b.nome) * dir;
  });

  const hasActiveFilters =
    !!searchQuery ||
    statusFilter !== "Todos" ||
    entidadeFilter !== "Todos" ||
    order !== "nome-asc";

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("Todos");
    setEntidadeFilter("Todos");
    setOrder("nome-asc");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h1 className="text-xl font-semibold text-foreground">Contactos</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setLocation("/qr-scanner")}
                data-testid="button-qr-scanner-header"
                title="Importar de QR Code ou Cartão"
              >
                <QrCode className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                onClick={() => setLocation("/contactos/novo")}
                data-testid="button-create-contacto-header"
                title="Criar Contacto"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Pesquisa principal */}
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Pesquisar contactos..."
          />

          {/* Filtro por estado (Ativos / Inativos) */}
          <Tabs
            value={statusFilter}
            onValueChange={setStatusFilter}
            className="mt-3"
          >
            <TabsList
              className="w-full grid h-auto gap-1"
              style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
              data-testid="tabs-status-contactos-filter"
            >
              <TabsTrigger
                value="Todos"
                className="text-xs py-2"
                data-testid="tab-contactos-status-todos"
              >
                Todos
              </TabsTrigger>
              <TabsTrigger
                value="Ativos"
                className="text-xs py-2"
                data-testid="tab-contactos-status-ativos"
              >
                Ativos
              </TabsTrigger>
              <TabsTrigger
                value="Inativos"
                className="text-xs py-2"
                data-testid="tab-contactos-status-inativos"
              >
                Inativos
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filtro por Entidade + Ordenação */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Entidade
              </label>
              <Select
                value={entidadeFilter}
                onValueChange={setEntidadeFilter}
              >
                <SelectTrigger data-testid="select-contactos-entidade">
                  <SelectValue placeholder="Todas as entidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todas</SelectItem>
                  <SelectItem value="SemEntidade">Sem entidade</SelectItem>
                  {entidadesOptions.map((ent) => (
                    <SelectItem key={ent.id} value={ent.id}>
                      {ent.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Ordenar por
              </label>
              <Select
                value={order}
                onValueChange={(value: "nome-asc" | "nome-desc") =>
                  setOrder(value)
                }
              >
                <SelectTrigger data-testid="select-contactos-order">
                  <SelectValue placeholder="Ordenação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nome-asc">Nome A-Z</SelectItem>
                  <SelectItem value="nome-desc">Nome Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                data-testid="button-reset-contactos-filters"
              >
                Limpar filtros
              </Button>
            </div>
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
        ) : sortedContactos && sortedContactos.length > 0 ? (
          <div className="space-y-3">
            {sortedContactos.map((contacto) => (
              <ContactoCard
                key={contacto.id}
                contacto={contacto}
                onClick={() => setLocation(`/contactos/${contacto.id}`)}
              />
            ))}
          </div>
        ) : hasActiveFilters ? (
          <EmptyState
            icon={Users}
            title="Nenhum resultado"
            description="Não encontrámos contactos com esse critério de pesquisa."
          />
        ) : (
          <EmptyState
            icon={Users}
            title="Sem contactos"
            description="Comece por criar o seu primeiro contacto."
            actionLabel="Criar Contacto"
            onAction={() => setLocation("/contactos/novo")}
          />
        )}
      </main>
    </div>
  );
}
