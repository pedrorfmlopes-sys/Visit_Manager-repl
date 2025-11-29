import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import type { Marca } from "@shared/schema";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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

export default function Leads() {
  const [, navigate] = useLocation();
  const { isAdmin } = useAuth();

  // Estado local de filtros (vista user não sincroniza com URL)
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [entidadeId, setEntidadeId] = useState("");
  const [contactoId, setContactoId] = useState("");
  const [hasOdoo, setHasOdoo] = useState("");
  const [orderBy, setOrderBy] = useState<"createdAt" | "titulo" | "valorPrevisto">("createdAt");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc"); // por defeito: mais recentes primeiro

  // Entidades & contactos para dropdowns
  const { data: entidadesData = [] } = useQuery({
    queryKey: ["/api/entidades"],
    queryFn: async () => {
      const resp = await fetch("/api/entidades", { credentials: "include" });
      if (!resp.ok) throw new Error("Erro ao carregar entidades");
      return resp.json();
    },
  });

  const { data: contactosData = [] } = useQuery({
    queryKey: ["/api/contactos"],
    queryFn: async () => {
      const resp = await fetch("/api/contactos", { credentials: "include" });
      if (!resp.ok) throw new Error("Erro ao carregar contactos");
      return resp.json();
    },
  });

  // Query params para API (filtros + ordenação no servidor – mantemos, mas
  // garantimos a ordenação "humana" no frontend a seguir)
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
      const resp = await fetch(`/api/crm/leads?${apiParams.toString()}`, {
        credentials: "include",
      });
      if (!resp.ok) throw new Error("Erro ao carregar leads");
      return resp.json();
    },
  });

  const leadsDisabled =
    data &&
    "success" in data &&
    data.success === false &&
    data.notEnabled === true;

  // Early return if Leads module is disabled
  if (leadsDisabled) {
    return (
      <div className="p-4 max-w-5xl mx-auto">
        <Card className="mt-4" data-testid="card-leads-disabled-user">
          <CardHeader>
            <CardTitle>Módulo de Leads CRM desativado</CardTitle>
            <CardDescription>
              O módulo de Leads CRM está desativado para esta empresa.
              Fala com o administrador para ativar o módulo de Leads nas definições da empresa.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const leads: Lead[] = data && "leads" in data ? data.leads : [];

  // 🔽 Ordenação "humana" no frontend (case-insensitive para título;
  // numérica para valorPrevisto; vazio conta como 0, tal como no admin)
  const sortedLeads = useMemo(() => {
    if (!Array.isArray(leads)) return [];

    const arr = [...leads];

    arr.sort((a, b) => {
      let result = 0;

      if (orderBy === "titulo") {
        const ta = (a.titulo || "").toLocaleLowerCase("pt-PT");
        const tb = (b.titulo || "").toLocaleLowerCase("pt-PT");
        result = ta.localeCompare(tb, "pt-PT", { sensitivity: "base" });
      } else if (orderBy === "valorPrevisto") {
        // valor vazio = 0, para ficar igual ao comportamento do admin
        const va = a.valorPrevisto ? parseFloat(a.valorPrevisto) : 0;
        const vb = b.valorPrevisto ? parseFloat(b.valorPrevisto) : 0;
        result = va - vb;
      } else {
        // createdAt
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        result = da - db;
      }

      if (orderDir === "desc") {
        result = result * -1;
      }

      return result;
    });

    return arr;
  }, [leads, orderBy, orderDir]);

  const resetFilters = () => {
    setQ("");
    setEstado("");
    setEntidadeId("");
    setContactoId("");
    setHasOdoo("");
    setOrderBy("createdAt");
    setOrderDir("desc");
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Lista de oportunidades / leads da empresa (vista utilizador).
          </p>
        </div>

        {/* Botões apenas para quem tem perfil de admin */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              onClick={() => navigate("/admin/leads/new?returnTo=/leads")}
              title="Novo lead"
              data-testid="button-create-lead-user"
            >
              <Plus className="h-5 w-5" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/leads")}
              data-testid="button-go-admin-leads"
            >
              Vista admin
            </Button>
          </div>
        )}
      </div>

      {isLoading && (
        <Card data-testid="card-leads-loading">
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
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

      {!isLoading && !isError && (
        <>
          {/* Filtros */}
          <Card data-testid="card-leads-filters-user">
            <CardContent className="pt-6">
              <div className="space-y-3">
                {/* Linha 1: Pesquisa + Estado + Entidade */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Pesquisar
                    </label>
                    <Input
                      placeholder="Título, descrição..."
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      data-testid="input-lead-search-user"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Estado
                    </label>
                    <Select
                      value={estado || "all"}
                      onValueChange={(value) =>
                        setEstado(value === "all" ? "" : value)
                      }
                    >
                      <SelectTrigger data-testid="select-lead-estado-user">
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
                    <label className="text-xs text-muted-foreground">
                      Entidade
                    </label>
                    <Select
                      value={entidadeId || "all"}
                      onValueChange={(value) =>
                        setEntidadeId(value === "all" ? "" : value)
                      }
                    >
                      <SelectTrigger data-testid="select-lead-entidade-user">
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

                {/* Linha 2: Contacto + Só com Odoo + Ordenação */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Contacto
                    </label>
                    <Select
                      value={contactoId || "all"}
                      onValueChange={(value) =>
                        setContactoId(value === "all" ? "" : value)
                      }
                    >
                      <SelectTrigger data-testid="select-lead-contacto-user">
                        <SelectValue placeholder="Todos os contactos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {Array.isArray(contactosData) &&
                          contactosData.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Filtro
                    </label>
                    <Button
                      variant={hasOdoo === "true" ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setHasOdoo(hasOdoo === "true" ? "" : "true")
                      }
                      className="w-full"
                      data-testid="toggle-lead-odoo-user"
                    >
                      {hasOdoo === "true" ? "✓ Com Odoo" : "Só com Odoo"}
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Ordenar por
                    </label>
                    <Select
                      value={`${orderBy}-${orderDir}`}
                      onValueChange={(value) => {
                        const [by, dir] = value.split("-");
                        setOrderBy(by as "createdAt" | "titulo" | "valorPrevisto");
                        setOrderDir(dir as "asc" | "desc");
                      }}
                    >
                      <SelectTrigger data-testid="select-lead-orderby-user">
                        <SelectValue placeholder="Ordenação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="createdAt-desc">
                          Mais recentes primeiro
                        </SelectItem>
                        <SelectItem value="createdAt-asc">
                          Mais antigos primeiro
                        </SelectItem>
                        <SelectItem value="titulo-asc">
                          Título (A-Z)
                        </SelectItem>
                        <SelectItem value="titulo-desc">
                          Título (Z-A)
                        </SelectItem>
                        <SelectItem value="valorPrevisto-asc">
                          Menor valor previsto
                        </SelectItem>
                        <SelectItem value="valorPrevisto-desc">
                          Maior valor previsto
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Botão limpar filtros */}
                {(q ||
                  estado ||
                  entidadeId ||
                  contactoId ||
                  hasOdoo ||
                  orderBy !== "createdAt" ||
                  orderDir !== "desc") && (
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetFilters}
                      data-testid="button-reset-filters-user"
                    >
                      Limpar filtros
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lista de leads */}
          <Card data-testid="card-leads-list-user">
            <CardHeader>
              <CardTitle>Leads</CardTitle>
              <CardDescription>
                {sortedLeads.length === 0
                  ? "Nenhum lead encontrado."
                  : `${sortedLeads.length} lead${
                      sortedLeads.length !== 1 ? "s" : ""
                    } encontrado${sortedLeads.length !== 1 ? "s" : ""}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sortedLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Não existem leads com os filtros selecionados.
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
                          data-testid={`row-lead-user-${lead.id}`}
                          onClick={() => navigate(`/admin/leads/${lead.id}`)}
                        >
                          <td className="py-2 pr-2">{lead.titulo}</td>
                          <td className="py-2 pr-2">
                            {lead.marcas && lead.marcas.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {lead.marcas.slice(0, 2).map((marca) => (
                                  <Badge
                                    key={marca.id}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {marca.nome}
                                  </Badge>
                                ))}
                                {lead.marcas.length > 2 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{lead.marcas.length - 2} mais
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            <Badge
                              variant={
                                lead.estado === "ganhou"
                                  ? "default"
                                  : lead.estado === "perdido"
                                  ? "destructive"
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              {lead.estado}
                            </Badge>
                          </td>
                          <td className="py-2 pr-2">
                            {lead.valorPrevisto
                              ? `${lead.valorPrevisto} ${
                                  lead.moeda || "EUR"
                                }`
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
