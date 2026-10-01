import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  Download,
  Loader2,
  Mail,
  MapPin,
  ReceiptText,
} from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { EntidadeCard } from "@/components/EntidadeCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOdooPartnerSearch } from "@/hooks/useOdooPartnerSearch";
import type { EntidadeWithRelations, EntidadeTipo } from "@shared/schema";

export default function Entidades() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { canUseOdooContacts } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [tipoFilter, setTipoFilter] = useState<string>("Todos");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [odooDialogOpen, setOdooDialogOpen] = useState(false);
  const [importingPartnerId, setImportingPartnerId] = useState<number | null>(null);
  const {
    term: odooSearchTerm,
    setTerm: setOdooSearchTerm,
    results: odooSearchResults,
    setResults: setOdooSearchResults,
    isLoading: odooSearchLoading,
    error: odooSearchError,
    setError: setOdooSearchError,
    notConfigured: odooSearchNotConfigured,
    refresh: handleSearchOdooPartners,
  } = useOdooPartnerSearch(odooDialogOpen);

  const { data: entidades, isLoading } = useQuery<EntidadeWithRelations[]>({
    queryKey: ["/api/entidades"],
  });

  const { data: tipos = [] } = useQuery<EntidadeTipo[]>({
    queryKey: ["/api/entidade-tipos"],
  });

  const importOdooEntityMutation = useMutation({
    mutationFn: async (partnerId: number) => {
      const response = await apiRequest(
        "POST",
        `/api/integrations/odoo/sync/partners/${partnerId}/import-entity`,
        {},
      );
      return response.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/entidades"] });
      toast({
        title: "Entidade importada",
        description: data?.entidade?.nome
          ? `${data.entidade.nome} foi importada do Odoo.`
          : "Entidade importada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao importar",
        description: error?.message ?? "Não foi possível importar a entidade do Odoo.",
        variant: "destructive",
      });
    },
  });

  const handleImportOdooEntity = async (partnerId: number) => {
    setImportingPartnerId(partnerId);
    try {
      await importOdooEntityMutation.mutateAsync(partnerId);
      setOdooDialogOpen(false);
      setOdooSearchResults([]);
      setOdooSearchTerm("");
      setOdooSearchError(null);
    } finally {
      setImportingPartnerId(null);
    }
  };

  const filteredEntidades = entidades?.filter((entidade) => {
    const query = searchQuery.toLowerCase().trim();

    const matchesSearch =
      !query ||
      entidade.nome.toLowerCase().includes(query) ||
      entidade.cidade?.toLowerCase().includes(query) ||
      entidade.email?.toLowerCase().includes(query) ||
      entidade.nif?.toLowerCase().includes(query);

    const matchesTipo =
      tipoFilter === "Todos" || entidade.entidadeTipoId === tipoFilter;

    // Corrigir interpretação do campo "ativa":
    // - Se entidade.ativa === false -> Inativa
    // - Se entidade.ativa === true ou undefined/null -> consideramos Ativa
    const isInativa = (entidade as any).ativa === false;
    const isAtiva = !isInativa;

    const matchesStatus =
      statusFilter === "Todos" ||
      (statusFilter === "Ativas" && isAtiva) ||
      (statusFilter === "Inativas" && isInativa);

    return matchesSearch && matchesTipo && matchesStatus;
  });

  const hasActiveFilters =
    !!searchQuery || tipoFilter !== "Todos" || statusFilter !== "Todos";
  const searchSuggestions = (filteredEntidades ?? [])
    .slice()
    .sort((first, second) => first.nome.localeCompare(second.nome, "pt"))
    .slice(0, 50);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h1 className="text-xl font-semibold text-foreground">
              Entidades
            </h1>
              {canUseOdooContacts && (
              <Button
                variant="outline"
                onClick={() => setOdooDialogOpen(true)}
                data-testid="button-import-odoo-entidades"
                title="Importar entidades do Odoo"
              >
                <Download className="h-4 w-4 mr-2" />
                Odoo
              </Button>
            )}
          </div>

          {/* Pesquisa principal */}
          <div className="relative">
            <SearchBar
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value);
                setSearchResultsOpen(true);
              }}
              onFocus={() => setSearchResultsOpen(true)}
              onBlur={() =>
                window.setTimeout(() => setSearchResultsOpen(false), 120)
              }
              placeholder="Pesquisar entidades..."
            />
            {searchResultsOpen && !isLoading && (
              <div
                className="absolute inset-x-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border bg-popover p-2 shadow-xl"
                data-testid="entity-search-results"
                onMouseDown={(event) => event.preventDefault()}
              >
                {searchSuggestions.length > 0 ? (
                  searchSuggestions.map((entidade) => (
                    <button
                      key={entidade.id}
                      type="button"
                      className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent"
                      onClick={() => {
                        setSearchResultsOpen(false);
                        setLocation(`/entidades/${entidade.id}`);
                      }}
                      data-testid={`entity-search-result-${entidade.id}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {entidade.nome}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {entidade.cidade && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {entidade.cidade}
                            </span>
                          )}
                          {entidade.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {entidade.email}
                            </span>
                          )}
                          {entidade.nif && (
                            <span className="flex items-center gap-1">
                              <ReceiptText className="h-3 w-3" />
                              {entidade.nif}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Nenhuma entidade encontrada.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Filtro por tipo de entidade */}
          {tipos.length > 0 && (
            <Tabs
              value={tipoFilter}
              onValueChange={setTipoFilter}
              className="mt-3"
            >
              <TabsList
                className="w-full grid h-auto gap-1"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(
                    tipos.length + 1,
                    4
                  )}, 1fr)`,
                }}
                data-testid="tabs-tipo-filter"
              >
                <TabsTrigger
                  value="Todos"
                  className="text-xs py-2"
                  data-testid="tab-todos"
                >
                  Todos
                </TabsTrigger>
                {tipos.map((tipo) => (
                  <TabsTrigger
                    key={tipo.id}
                    value={tipo.id}
                    className="text-xs py-2"
                    data-testid={`tab-tipo-${tipo.id}`}
                  >
                    {tipo.nome}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {/* Filtro por estado (Ativas / Inativas) */}
          <Tabs
            value={statusFilter}
            onValueChange={setStatusFilter}
            className="mt-3"
          >
            <TabsList
              className="w-full grid h-auto gap-1"
              style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
              data-testid="tabs-status-filter"
            >
              <TabsTrigger
                value="Todos"
                className="text-xs py-2"
                data-testid="tab-status-todos"
              >
                Todas
              </TabsTrigger>
              <TabsTrigger
                value="Ativas"
                className="text-xs py-2"
                data-testid="tab-status-ativas"
              >
                Ativas
              </TabsTrigger>
              <TabsTrigger
                value="Inativas"
                className="text-xs py-2"
                data-testid="tab-status-inativas"
              >
                Inativas
              </TabsTrigger>
            </TabsList>
          </Tabs>
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
        ) : hasActiveFilters ? (
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

      <Dialog open={odooDialogOpen} onOpenChange={setOdooDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar entidade do Odoo</DialogTitle>
            <DialogDescription>
              Pesquisa parceiros no Odoo e importa-os para a lista local de entidades.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={odooSearchTerm}
                onChange={(event) => setOdooSearchTerm(event.target.value)}
                placeholder="Nome ou email no Odoo"
                data-testid="input-odoo-entidade-search"
              />
              <Button
                onClick={handleSearchOdooPartners}
                disabled={odooSearchLoading}
                data-testid="button-odoo-entidade-search"
              >
                {odooSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pesquisar"}
              </Button>
            </div>

            {odooSearchError && (
              <p className="text-sm text-destructive" data-testid="text-odoo-entidade-search-error">
                {odooSearchError}
              </p>
            )}

            {odooSearchNotConfigured && (
              <p className="text-sm text-muted-foreground">
                A integração Odoo ainda não está configurada.
              </p>
            )}

            <div className="max-h-80 overflow-auto space-y-2" data-testid="list-odoo-entidade-search-results">
              {!odooSearchLoading &&
                !odooSearchError &&
                !odooSearchNotConfigured &&
                odooSearchResults.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Sem resultados no Odoo.
                </p>
              )}

              {odooSearchResults.map((partner) => (
                <div
                  key={partner.id}
                  className="rounded-lg border p-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{partner.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {[partner.email, partner.phone].filter(Boolean).join(" · ") || "Sem email/telefone"}
                    </p>
                    {(partner.city || partner.country) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[partner.city, partner.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleImportOdooEntity(partner.id)}
                    disabled={importingPartnerId === partner.id}
                    data-testid={`button-import-odoo-entidade-${partner.id}`}
                  >
                    {importingPartnerId === partner.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Importar"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOdooDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
