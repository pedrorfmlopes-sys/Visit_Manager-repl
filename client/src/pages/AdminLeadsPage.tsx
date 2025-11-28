import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useLocation } from "wouter";
import type { Marca } from "@shared/schema";

type Lead = {
  id: string;
  titulo: string;
  entidadeId: string;
  contactoId: string;
  visitaId: string | null;
  marca: string | null;
  estado: string;
  valorPrevisto: string | null;
  moeda: string | null;
  createdAt: string;
  marcas?: Marca[] | null;
  entidade?: { id: string; nome: string } | null;
  contacto?: { id: string; nome: string } | null;
};

type LeadsResponse =
  | { leads: Lead[] }
  | { success: false; notEnabled?: boolean; message?: string };

export default function AdminLeadsPage() {
  const [location, navigate] = useLocation();
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  
  // FASE-LEADS-FILTROS-02: Read query params from URL
  const q = searchParams.get("q") || "";
  const estado = searchParams.get("estado") || "";
  const entidadeId = searchParams.get("entidadeId") || "";
  const contactoId = searchParams.get("contactoId") || "";
  const hasOdoo = searchParams.get("hasOdoo") || "";
  const orderBy = searchParams.get("orderBy") || "createdAt";
  const orderDir = searchParams.get("orderDir") || "desc";

  // FASE-LEADS-FILTROS-01: Local state for search debounce
  const [localSearch, setLocalSearch] = useState(q);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Sync local search with URL search param
  useEffect(() => {
    setLocalSearch(q);
  }, [q]);

  // FASE-LEADS-FILTROS-02: Helper to update URL with new params
  // FASE-LEADS-FILTROS-04: Preserve current path (/admin/leads)
  const updateParams = useCallback((updates: Record<string, string>) => {
    const [currentPath, currentSearch] = location.split("?");
    const newParams = new URLSearchParams(currentSearch || "");
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    const newSearch = newParams.toString();
    navigate(`${currentPath}${newSearch ? `?${newSearch}` : ""}`);
  }, [location, navigate]);

  // Debounced search handler
  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    
    if (searchTimeout) clearTimeout(searchTimeout);
    
    const timeout = setTimeout(() => {
      updateParams({ q: value });
    }, 300);
    
    setSearchTimeout(timeout);
  }, [searchTimeout, updateParams]);

  // Fetch entidades and contactos for select dropdowns
  const { data: entidadesData } = useQuery({
    queryKey: ["/api/entidades"],
    queryFn: async () => {
      const resp = await fetch("/api/entidades", { credentials: "include" });
      return resp.json();
    },
  });

  const { data: contactosData } = useQuery({
    queryKey: ["/api/contactos"],
    queryFn: async () => {
      const resp = await fetch("/api/contactos", { credentials: "include" });
      return resp.json();
    },
  });

  // FASE-LEADS-FILTROS-02: Build query params for API
  const apiParams = new URLSearchParams();
  if (q) apiParams.append("q", q);
  if (estado) apiParams.append("estado", estado);
  if (entidadeId) apiParams.append("entidadeId", entidadeId);
  if (contactoId) apiParams.append("contactoId", contactoId);
  if (hasOdoo) apiParams.append("hasOdoo", hasOdoo);
  apiParams.append("orderBy", orderBy);
  apiParams.append("orderDir", orderDir);

  const { data, isLoading, isError } = useQuery<LeadsResponse>({
    queryKey: ["/api/crm/leads", { q, estado, entidadeId, contactoId, hasOdoo, orderBy, orderDir }],
    queryFn: async () => {
      const resp = await fetch(`/api/crm/leads?${apiParams.toString()}`, { credentials: "include" });
      const json = await resp.json();
      return json;
    },
  });

  // FASE-LEADS-FILTROS-03: In-memory filtering and sorting
  const allLeads = data && "leads" in data ? data.leads : [];

  const filteredLeads = allLeads.filter((lead) => {
    const normalizedQuery = q.trim().toLowerCase();
    
    // Search filter: q in titulo, descricao, entidade.nome, contacto.nome
    if (normalizedQuery) {
      const haystack = [
        lead.titulo,
        lead.descricao,
        lead.entidade?.nome,
        lead.contacto?.nome,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(normalizedQuery)) return false;
    }

    // Estado filter
    if (estado && estado !== "all" && lead.estado !== estado) return false;

    // EntidadeId filter
    if (entidadeId && entidadeId !== "all" && lead.entidadeId !== entidadeId)
      return false;

    // ContactoId filter
    if (contactoId && contactoId !== "all" && lead.contactoId !== contactoId)
      return false;

    // Odoo sync status filter
    if (hasOdoo && hasOdoo !== "all") {
      const hasOdooId = !!lead.odooLeadId; // Using actual field name from schema
      if (hasOdoo === "true" && !hasOdooId) return false;
      if (hasOdoo === "false" && hasOdooId) return false;
    }

    return true;
  });

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    const dir = orderDir === "asc" ? 1 : -1;

    if (orderBy === "titulo") {
      return a.titulo.localeCompare(b.titulo) * dir;
    }

    if (orderBy === "valorPrevisto") {
      const av = a.valorPrevisto ? parseFloat(a.valorPrevisto) : 0;
      const bv = b.valorPrevisto ? parseFloat(b.valorPrevisto) : 0;
      return (av - bv) * dir;
    }

    // default: createdAt
    const ad = new Date(a.createdAt).getTime();
    const bd = new Date(b.createdAt).getTime();
    return (ad - bd) * dir;
  });

  // Reset all filters
  // FASE-LEADS-FILTROS-04: Preserve current path, only clear query string
  const resetFilters = useCallback(() => {
    const [currentPath] = location.split("?");
    navigate(currentPath);
  }, [location, navigate]);

  const leadsDisabled =
    data &&
    "success" in data &&
    data.success === false &&
    data.notEnabled === true;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Lista de oportunidades / leads da empresa.
          </p>
        </div>
        <Button
          onClick={() => navigate("/admin/leads/new?returnTo=/admin/leads")}
          size="sm"
          data-testid="button-novo-lead"
        >
          Novo lead
        </Button>
      </div>

      {isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Carregando leads...</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      )}

      {isError && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar leads</CardTitle>
            <CardDescription>
              Tenta recarregar a página ou verifica a ligação.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {leadsDisabled && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Módulo de Leads desativado</CardTitle>
            <CardDescription>
              O módulo de Leads CRM não está ativo para esta empresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Ativa o módulo de Leads nas definições de CRMs para começar a
              criar e gerir leads.
            </p>
            <Button
              size="sm"
              onClick={() => navigate("/admin/empresa")}
              data-testid="button-go-to-settings"
            >
              Ir para Definições / CRMs
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && !leadsDisabled && data && "leads" in data && (
        <>
          {/* FASE-LEADS-FILTROS-02: Filters bar */}
          <Card data-testid="card-leads-filters">
            <CardContent className="pt-6">
              <div className="space-y-3">
                {/* Row 1: Search + Estado + Entidade */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Pesquisar</label>
                    <Input
                      placeholder="Título, descrição..."
                      value={localSearch}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      data-testid="input-lead-search"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Estado</label>
                    <Select value={estado || "all"} onValueChange={(value) => updateParams({ estado: value === "all" ? "" : value })}>
                      <SelectTrigger data-testid="select-lead-estado">
                        <SelectValue placeholder="Todos os estados" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="novo">Novo</SelectItem>
                        <SelectItem value="em_curso">Em curso</SelectItem>
                        <SelectItem value="ganhou">Ganhou</SelectItem>
                        <SelectItem value="perdido">Perdido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Entidade</label>
                    <Select value={entidadeId || "all"} onValueChange={(value) => updateParams({ entidadeId: value === "all" ? "" : value })}>
                      <SelectTrigger data-testid="select-lead-entidade">
                        <SelectValue placeholder="Todas as entidades" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {Array.isArray(entidadesData) &&
                          entidadesData.map((ent: any) => (
                            <SelectItem key={ent.id} value={ent.id}>
                              {ent.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2: Contacto + Só com Odoo + Ordenar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Contacto</label>
                    <Select value={contactoId || "all"} onValueChange={(value) => updateParams({ contactoId: value === "all" ? "" : value })}>
                      <SelectTrigger data-testid="select-lead-contacto">
                        <SelectValue placeholder="Todos os contactos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {Array.isArray(contactosData) &&
                          contactosData.map((cont: any) => (
                            <SelectItem key={cont.id} value={cont.id}>
                              {cont.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Filtro</label>
                    <Button
                      variant={hasOdoo === "true" ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateParams({ hasOdoo: hasOdoo === "true" ? "" : "true" })}
                      className="w-full"
                      data-testid="toggle-lead-odoo"
                    >
                      {hasOdoo === "true" ? "✓ Com Odoo" : "Só com Odoo"}
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Ordenar por</label>
                    <Select
                      value={`${orderBy}-${orderDir}`}
                      onValueChange={(value) => {
                        const [by, dir] = value.split("-");
                        updateParams({ orderBy: by, orderDir: dir });
                      }}
                    >
                      <SelectTrigger data-testid="select-lead-orderby">
                        <SelectValue placeholder="Ordenação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="createdAt-desc">Mais recentes</SelectItem>
                        <SelectItem value="createdAt-asc">Mais antigos</SelectItem>
                        <SelectItem value="titulo-asc">Título A-Z</SelectItem>
                        <SelectItem value="titulo-desc">Título Z-A</SelectItem>
                        <SelectItem value="valorPrevisto-asc">Valor ↑</SelectItem>
                        <SelectItem value="valorPrevisto-desc">Valor ↓</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Reset button */}
                {(q || estado || entidadeId || contactoId || hasOdoo) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    data-testid="button-reset-filters"
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* FASE-LEADS-FILTROS-03: Leads list using sortedLeads */}
          <Card data-testid="card-leads-list">
            <CardHeader>
              <CardTitle>Leads</CardTitle>
              <CardDescription>
                {sortedLeads.length === 0
                  ? allLeads.length === 0
                    ? "Ainda não existem leads registados."
                    : "Nenhum lead corresponde aos filtros."
                  : `${sortedLeads.length} lead${sortedLeads.length !== 1 ? "s" : ""} encontrado${sortedLeads.length !== 1 ? "s" : ""}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sortedLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {allLeads.length === 0
                    ? "Nenhum lead encontrado."
                    : "Nenhum lead corresponde aos filtros aplicados."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-2">Título</th>
                        <th className="text-left py-2 pr-2">Marca</th>
                        <th className="text-left py-2 pr-2">Estado</th>
                        <th className="text-left py-2 pr-2">Valor</th>
                        <th className="text-left py-2 pr-2">Criado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          className="border-b hover:bg-muted cursor-pointer"
                          data-testid={`row-lead-${lead.id}`}
                          onClick={() => navigate(`/admin/leads/${lead.id}`)}
                        >
                          <td className="py-2 pr-2">{lead.titulo}</td>
                          <td className="py-2 pr-2">
                            {lead.marcas && lead.marcas.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {lead.marcas.slice(0, 2).map((marca) => (
                                  <Badge key={marca.id} variant="secondary" className="text-xs" data-testid={`badge-lead-marca-${marca.id}`}>
                                    {marca.nome}
                                  </Badge>
                                ))}
                                {lead.marcas.length > 2 && (
                                  <Badge variant="outline" className="text-xs" data-testid={`badge-lead-marcas-more-${lead.id}`}>
                                    +{lead.marcas.length - 2}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 pr-2 capitalize">
                            {lead.estado}
                          </td>
                          <td className="py-2 pr-2">
                            {lead.valorPrevisto
                              ? `${lead.valorPrevisto} ${lead.moeda || "EUR"}`
                              : "—"}
                          </td>
                          <td className="py-2 pr-2">
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
