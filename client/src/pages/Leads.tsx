import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";
import type { Marca } from "@shared/schema";
import { Download, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  odooLeadId?: string | null;
  marcas?: Marca[] | null;
  entidade?: { id: string; nome: string } | null;
  contacto?: { id: string; nome: string } | null;
};

type LeadsResponse =
  | { leads: Lead[] }
  | { success: false; notEnabled?: boolean; message?: string };

export default function Leads() {
  const [, navigate] = useLocation();
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [importOpen, setImportOpen] = useState(false);
  const [odooSearch, setOdooSearch] = useState("");

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

  const { data: odooLeadSearch } = useQuery<{
    success: boolean;
    results: Array<{
      id: number;
      name: string;
      contactName?: string | null;
      expectedRevenue?: string | null;
      localLeadId?: string | null;
    }>;
  }>({
    queryKey: ["/api/crm/leads/odoo/search", odooSearch],
    queryFn: async () => {
      const response = await fetch(
        `/api/crm/leads/odoo/search?q=${encodeURIComponent(odooSearch)}`,
        { credentials: "include" },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Erro na pesquisa");
      return json;
    },
    enabled: importOpen && !!user?.odooPartnerId,
  });

  const { data: approvalsData } = useQuery<{
    success: boolean;
    requests: Array<{
      id: string;
      leadTitle: string;
      status: string;
      reviewComment?: string | null;
      createdAt: string;
    }>;
  }>({
    queryKey: ["/api/crm/leads/approvals"],
    queryFn: async () => {
      const response = await fetch("/api/crm/leads/approvals", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao carregar pedidos");
      return response.json();
    },
    enabled: !isAdmin,
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

  const syncLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const response = await apiRequest("POST", `/api/crm/leads/${leadId}/odoo/sync`, {});
      return response.json();
    },
    onSuccess: async (result, leadId) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", { q, estado, entidadeId, contactoId, hasOdoo, orderBy, orderDir }] });
      await queryClient.invalidateQueries({ queryKey: ["/api/crm/leads/approvals"] });
      toast({
        title: result.approvalRequired
          ? "Pedido enviado ao administrador"
          : "Lead sincronizado",
        description: result.approvalRequired
          ? "As alterações só serão publicadas no Odoo depois de aprovadas."
          : `O lead ${leadId} foi sincronizado com o Odoo.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao sincronizar",
        description: error?.message ?? "Não foi possível sincronizar o lead com o Odoo.",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (odooLeadId: number) => {
      const response = await fetch("/api/crm/leads/odoo/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ odooLeadId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Erro ao importar");
      return json;
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/crm/leads/odoo/search"] }),
      ]);
      setImportOpen(false);
      toast({ title: "Lead importado do Odoo" });
      if (result.lead?.id) navigate(`/admin/leads/${result.lead.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível importar",
        description: error?.message,
        variant: "destructive",
      });
    },
  });

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Lista de oportunidades / leads da empresa (vista utilizador).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              disabled={!user?.odooPartnerId}
              title={
                user?.odooPartnerId
                  ? "Importar um lead que segue no Odoo"
                  : "O administrador deve associar o seu contacto Odoo"
              }
              data-testid="button-agent-import-odoo-lead"
            >
              <Download className="mr-2 h-4 w-4" />
              Importar do Odoo
            </Button>
          )}
          {!isAdmin && user?.odooLeadAccess !== "view" && (
            <Button
              size="sm"
              onClick={() => navigate("/admin/leads/new?returnTo=/leads")}
              data-testid="button-create-lead-user"
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo lead
            </Button>
          )}
          {isAdmin && (
            <>
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
            </>
          )}
        </div>
      </div>

      {!isAdmin && !!approvalsData?.requests.length && (
        <Card data-testid="card-agent-lead-requests">
          <CardHeader>
            <CardTitle className="text-base">Pedidos enviados</CardTitle>
            <CardDescription>
              Estado das alterações de leads enviadas ao administrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {approvalsData.requests.slice(0, 5).map((request) => (
              <div
                key={request.id}
                className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{request.leadTitle}</p>
                  {request.reviewComment && (
                    <p className="text-sm text-muted-foreground">
                      {request.reviewComment}
                    </p>
                  )}
                </div>
                <Badge
                  variant={
                    request.status === "approved"
                      ? "default"
                      : request.status === "rejected"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {request.status === "pending"
                    ? "A aguardar aprovação"
                    : request.status === "approved"
                      ? "Aprovado"
                      : request.status === "changes_requested"
                        ? "Correções pedidas"
                        : "Rejeitado"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                        <th className="text-left py-2 pr-2">Odoo</th>
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
                            {lead.odooLeadId ? (
                              <Badge variant="outline" className="text-xs">
                                Odoo #{lead.odooLeadId}
                              </Badge>
                            ) : isAdmin ? (
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`button-sync-lead-odoo-${lead.id}`}
                                disabled={syncLeadMutation.isPending}
                                onClick={async (event) => {
                                  event.stopPropagation();
                                  await syncLeadMutation.mutateAsync(lead.id);
                                }}
                              >
                                {syncLeadMutation.isPending ? "A sincronizar..." : "Sincronizar"}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Não sincronizado
                              </span>
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

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Leads que segue no Odoo</DialogTitle>
            <DialogDescription>
              Só são apresentados leads em que o seu contacto está definido como seguidor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto pr-1">
            <Input
              autoFocus
              value={odooSearch}
              onChange={(event) => setOdooSearch(event.target.value)}
              placeholder="Pesquisar por lead ou contacto"
              data-testid="input-agent-search-odoo-lead"
            />
            <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border p-2">
              {!odooLeadSearch && (
                <p className="p-3 text-sm text-muted-foreground">
                  A carregar os leads permitidos...
                </p>
              )}
              {odooLeadSearch?.results.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">
                  Não foram encontrados leads onde seja seguidor.
                </p>
              )}
              {odooLeadSearch?.results.map((result) => (
                <div
                  key={result.id}
                  className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{result.name}</p>
                      <Badge variant="outline">Odoo #{result.id}</Badge>
                      {result.localLeadId && <Badge>Na app</Badge>}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {result.contactName || "Sem contacto"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => importMutation.mutate(result.id)}
                    disabled={importMutation.isPending}
                    data-testid={`button-agent-import-odoo-lead-${result.id}`}
                  >
                    {result.localLeadId ? "Atualizar" : "Importar"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
