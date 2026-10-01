import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Users,
  Plus,
  QrCode,
  Download,
  Loader2,
  ScanSearch,
  Building2,
  Mail,
  Phone,
} from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { ContactoCard } from "@/components/ContactoCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOdooPartnerSearch } from "@/hooks/useOdooPartnerSearch";
import type { ContactoWithRelations } from "@shared/schema";
import { DuplicateContactsDialog } from "@/components/DuplicateContactsDialog";

export default function Contactos() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { canUseOdooContacts, isAdmin } = useAuth();

  // Pesquisa e filtros locais
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [entidadeFilter, setEntidadeFilter] = useState<string>("Todos");
  const [order, setOrder] = useState<"nome-asc" | "nome-desc">("nome-asc");
  const [odooDialogOpen, setOdooDialogOpen] = useState(false);
  const [duplicatesDialogOpen, setDuplicatesDialogOpen] = useState(false);
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

  const { data: contactos, isLoading } = useQuery<ContactoWithRelations[]>({
    queryKey: ["/api/contactos"],
  });

  const importOdooContactMutation = useMutation({
    mutationFn: async (partnerId: number) => {
      const response = await apiRequest(
        "POST",
        `/api/integrations/odoo/sync/partners/${partnerId}/import-contact`,
        {},
      );
      return response.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/contactos"] });
      toast({
        title: data?.deduplicated
          ? "Contacto existente atualizado"
          : "Contacto importado",
        description: data?.contacto?.nome
          ? data?.deduplicated
            ? `${data.contacto.nome} já existia e foi ligado ao Odoo.`
            : `${data.contacto.nome} foi importado do Odoo.`
          : "Contacto importado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao importar",
        description: error?.message ?? "Não foi possível importar o contacto do Odoo.",
        variant: "destructive",
      });
    },
  });

  const handleImportOdooContact = async (partnerId: number) => {
    setImportingPartnerId(partnerId);
    try {
      await importOdooContactMutation.mutateAsync(partnerId);
      setOdooDialogOpen(false);
      setOdooSearchResults([]);
      setOdooSearchTerm("");
      setOdooSearchError(null);
    } finally {
      setImportingPartnerId(null);
    }
  };

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
  const searchSuggestions = sortedContactos.slice(0, 50);

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
              {isAdmin && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDuplicatesDialogOpen(true)}
                  data-testid="button-scan-duplicate-contacts"
                  title="Procurar contactos duplicados"
                >
                  <ScanSearch className="h-5 w-5" />
                </Button>
              )}
              {canUseOdooContacts && (
                <Button
                  variant="outline"
                  onClick={() => setOdooDialogOpen(true)}
                  data-testid="button-import-odoo-contactos"
                  title="Importar contactos do Odoo"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Odoo
                </Button>
              )}
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
          <div className="relative">
            <SearchBar
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value);
                setSearchResultsOpen(true);
              }}
              onFocus={() => setSearchResultsOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchResultsOpen(false), 120)}
              placeholder="Pesquisar contactos..."
            />
            {searchResultsOpen && !isLoading && (
              <div
                className="absolute inset-x-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border bg-popover p-2 shadow-xl"
                data-testid="contact-search-results"
                onMouseDown={(event) => event.preventDefault()}
              >
                {searchSuggestions.length > 0 ? (
                  searchSuggestions.map((contacto) => (
                    <button
                      key={contacto.id}
                      type="button"
                      className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent"
                      onClick={() => {
                        setSearchResultsOpen(false);
                        setLocation(`/contactos/${contacto.id}/detalhes`);
                      }}
                      data-testid={`contact-search-result-${contacto.id}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {contacto.nome}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {contacto.entidade?.nome && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {contacto.entidade.nome}
                            </span>
                          )}
                          {contacto.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {contacto.email}
                            </span>
                          )}
                          {contacto.telemovel && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contacto.telemovel}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Nenhum contacto encontrado.
                  </p>
                )}
              </div>
            )}
          </div>

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
                onClick={() => setLocation(`/contactos/${contacto.id}/detalhes`)}
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

      <Dialog open={odooDialogOpen} onOpenChange={setOdooDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar contacto do Odoo</DialogTitle>
            <DialogDescription>
              Pesquisa parceiros existentes no Odoo e importa-os para a lista local de contactos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={odooSearchTerm}
                onChange={(event) => setOdooSearchTerm(event.target.value)}
                placeholder="Nome ou email no Odoo"
                data-testid="input-odoo-contact-search"
              />
              <Button
                onClick={handleSearchOdooPartners}
                disabled={odooSearchLoading}
                data-testid="button-odoo-contact-search"
              >
                {odooSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pesquisar"}
              </Button>
            </div>

            {odooSearchError && (
              <p className="text-sm text-destructive" data-testid="text-odoo-contact-search-error">
                {odooSearchError}
              </p>
            )}

            {odooSearchNotConfigured && (
              <p className="text-sm text-muted-foreground">
                A integração Odoo ainda não está configurada.
              </p>
            )}

            <div className="max-h-80 overflow-auto space-y-2" data-testid="list-odoo-contact-search-results">
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
                    onClick={() => handleImportOdooContact(partner.id)}
                    disabled={importingPartnerId === partner.id}
                    data-testid={`button-import-odoo-contact-${partner.id}`}
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
      <DuplicateContactsDialog
        open={duplicatesDialogOpen}
        onOpenChange={setDuplicatesDialogOpen}
      />
    </div>
  );
}
