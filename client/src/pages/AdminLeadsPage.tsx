import { useState, useCallback } from "react";
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
  odooLeadId?: number | null;
};

type LeadsResponse =
  | { leads: Lead[] }
  | { success: false; notEnabled?: boolean; message?: string };

export default function AdminLeadsPage() {
  const [, navigate] = useLocation();

  // Estado interno dos filtros e ordenação
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<string>("");
  const [entidadeId, setEntidadeId] = useState<string>("");
  const [contactoId, setContactoId] = useState<string>("");
  const [hasOdoo, setHasOdoo] = useState<string>("");
  const [orderBy, setOrderBy] = useState<string>("createdAt");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");

  // Estado local para o debounce da pesquisa
  const [localSearch, setLocalSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Handler com debounce para a pesquisa
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);

      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      const timeout = setTimeout(() => {
        setQ(value);
      }, 300);

      setSearchTimeout(timeout);
    },
    [searchTimeout]
  );

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
        (lead as any).descricao,
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
    if (entidadeId && entidadeId !== "all" && lead.entidadeId !== entidadeId) return false;

    // ContactoId filter
    if (contactoId && contactoId !== "all" && lead.contactoId !== contactoId) return false;

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
  const resetFilters = useCallback(() => {
    setQ("");
    setEstado("");
    setEntidadeId("");
    setContactoId("");
    setHasOdoo("");
    setOrderBy("createdAt");
    setOrderDir("desc");
    setLocalSearch("");
  }, []);

  const leadsDisabled =
    data &&
    "success" in data &&
    data.success === false &&
    data.notEnabled === true;

  // Early return if Leads module is disabled
  if (leadsDisabled) {
    return (
      <div className="space-y-4">
        <Card className="mt-4" data-testid="card-leads-disabled">
          <CardHeader>
            <CardTitle>Módulo de Leads CRM desativado</CardTitle>
            <CardDescription>
              O módulo de Leads CRM está desativado para esta empresa.
              Podes ativá-lo em <strong>Definições &gt; Empresa &gt; Módulo de Leads CRM</strong>.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

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
          data-testid="button-new-lead"
        >
          Nova Lead
        </Button>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <div className="space-y-1">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar leads</CardTitle>
            <CardDescription>
              Ocorreu um erro ao carregar as leads. Por favor, tente novamente.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isLoading && !isError && data && "leads" in data && (
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
                    <Select
                      value={estado || "all"}
                      onValueChange={(value) => setEstado(value === "all" ? "" : value)}
                    >
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
                    <Select
                      value={entidadeId || "all"}
                      onValueChange={(value) => {
                        const v = value === "all" ? "" : value;
                        setEntidadeId(v);
                        setContactoId("");
                      }}
                    >
                      <SelectTrigger data-testid="select-lead-entidade">
                        <SelectValue placeholder="Todas as entidades" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {/* As entidades vêm já "embedded" nos leads ou de outro hook, adapta se necessário */}
                        {Array.from(
                          new Map(
                            allLeads
                              .filter((lead) => lead.entidade)
                              .map((lead) => [lead.entidade!.id, lead.entidade!])
                          ).values()
                        ).map((ent) => (
                          <SelectItem key={ent.id} value={ent.id}>
                            {ent.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2: Contacto + Filtros extra + Ordenar por */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Contacto</label>
                    <Select
                      value={contactoId || "all"}
                      onValueChange={(value) => setContactoId(value === "all" ? "" : value)}
                    >
                      <SelectTrigger data-testid="select-lead-contacto">
                        <SelectValue placeholder="Todos os contactos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {Array.from(
                          new Map(
                            allLeads
                              .filter((lead) => lead.contacto)
                              .map((lead) => [lead.contacto!.id, lead.contacto!])
                          ).values()
                        ).map((cont) => (
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
                      onClick={() => setHasOdoo(hasOdoo === "true" ? "" : "true")}
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
                        setOrderBy(by);
                        setOrderDir(dir === "asc" ? "asc" : "desc");
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

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    data-testid="button-reset-filters"
                  >
                    Limpar filtros
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de resultados */}
          <Card data-testid="card-leads-table">
            <CardContent className="pt-6">
              {sortedLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma lead encontrada com os filtros aplicados.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left pb-2 pr-2">Título</th>
                        <th className="text-left pb-2 pr-2">Entidade</th>
                        <th className="text-left pb-2 pr-2">Contacto</th>
                        <th className="text-left pb-2 pr-2">Estado</th>
                        <th className="text-left pb-2 pr-2">Valor previsto</th>
                        <th className="text-left pb-2 pr-2">Odoo</th>
                        <th className="text-left pb-2 pr-2">Criada em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                          onClick={() => navigate(`/admin/leads/${lead.id}`)}
                          data-testid={`row-lead-${lead.id}`}
                        >
                          <td className="py-2 pr-2 font-medium">{lead.titulo}</td>
                          <td className="py-2 pr-2">
                            {lead.entidade ? lead.entidade.nome : "—"}
                          </td>
                          <td className="py-2 pr-2">
                            {lead.contacto ? lead.contacto.nome : "—"}
                          </td>
                          <td className="py-2 pr-2">
                            <Badge variant="outline">{lead.estado}</Badge>
                          </td>
                          <td className="py-2 pr-2">
                            {lead.valorPrevisto
                              ? `${lead.valorPrevisto} ${lead.moeda || ""}`.trim()
                              : "—"}
                          </td>
                          <td className="py-2 pr-2">
                            {lead.odooLeadId ? (
                              <Badge variant="outline">Odoo #{lead.odooLeadId}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
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
