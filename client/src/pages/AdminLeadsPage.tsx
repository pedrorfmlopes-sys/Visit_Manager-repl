import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useLocation } from "wouter";
import type { Marca } from "@shared/schema";
import type { User } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Check, Download, MessageSquare, X } from "lucide-react";

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [importOpen, setImportOpen] = useState(false);
  const [odooSearch, setOdooSearch] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>(
    {},
  );

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

  const { data: companyUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/utilizadores"],
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
    enabled: importOpen,
  });
  const { data: approvalsData } = useQuery<{
    success: boolean;
    requests: Array<{
      id: string;
      leadId: string;
      leadTitle: string;
      requesterName: string;
      requesterEmail?: string | null;
      requestType: string;
      proposedChanges: Record<string, unknown>;
      status: string;
      createdAt: string;
    }>;
  }>({
    queryKey: ["/api/crm/leads/approvals", "pending"],
    queryFn: async () => {
      const response = await fetch(
        "/api/crm/leads/approvals?status=pending",
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Erro ao carregar aprovações");
      return response.json();
    },
  });

  const importMutation = useMutation({
    mutationFn: async (odooLeadId: number) => {
      const response = await fetch("/api/crm/leads/odoo/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          odooLeadId,
          userIds: selectedAgentIds,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Erro ao importar");
      return json;
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/crm/leads"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/crm/leads/odoo/search"],
      });
      toast({ title: "Lead importado e seguidores atualizados" });
      if (result.lead?.id) navigate(`/admin/leads/${result.lead.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível importar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      requestId,
      action,
    }: {
      requestId: string;
      action: "approve" | "changes_requested" | "rejected";
    }) => {
      const response = await fetch(
        `/api/crm/leads/approvals/${requestId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            comment: reviewComments[requestId] ?? "",
          }),
        },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Erro na revisão");
      return json;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/crm/leads/approvals"],
        }),
        queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] }),
      ]);
      toast({ title: "Pedido atualizado" });
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível rever o pedido",
        description: error.message,
        variant: "destructive",
      });
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Lista de oportunidades / leads da empresa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            size="sm"
            data-testid="button-import-odoo-lead"
          >
            <Download className="mr-2 h-4 w-4" />
            Importar do Odoo
          </Button>
          <Button
            onClick={() => navigate("/admin/leads/new?returnTo=/admin/leads")}
            size="sm"
            data-testid="button-new-lead"
          >
            Nova Lead
          </Button>
        </div>
      </div>

      {!!approvalsData?.requests.length && (
        <Card className="border-amber-300 bg-amber-50/40" data-testid="card-lead-approvals">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-amber-700" />
              Pedidos de atualização ({approvalsData.requests.length})
            </CardTitle>
            <CardDescription>
              Confirme as alterações antes de as publicar no Odoo ou peça correções ao agente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {approvalsData.requests.map((request) => (
              <div
                key={request.id}
                className="rounded-lg border bg-background p-4"
                data-testid={`lead-approval-${request.id}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{request.leadTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      {request.requesterName}
                      {request.requesterEmail ? ` · ${request.requesterEmail}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {request.requestType === "create" ? "Criar no Odoo" : "Atualizar Odoo"}
                  </Badge>
                </div>
                {Object.keys(request.proposedChanges ?? {}).length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {Object.entries(request.proposedChanges).map(([field, value]) => (
                      <div key={field} className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                        <span className="font-medium">{field}: </span>
                        <span className="break-words text-muted-foreground">
                          {value == null ? "vazio" : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <Input
                  className="mt-3"
                  placeholder="Comentário para o agente (obrigatório se pedir correções ou rejeitar)"
                  value={reviewComments[request.id] ?? ""}
                  onChange={(event) =>
                    setReviewComments((current) => ({
                      ...current,
                      [request.id]: event.target.value,
                    }))
                  }
                  data-testid={`input-approval-comment-${request.id}`}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      reviewMutation.mutate({ requestId: request.id, action: "approve" })
                    }
                    disabled={reviewMutation.isPending}
                    data-testid={`button-approve-${request.id}`}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      reviewMutation.mutate({
                        requestId: request.id,
                        action: "changes_requested",
                      })
                    }
                    disabled={reviewMutation.isPending}
                  >
                    Pedir correções
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      reviewMutation.mutate({ requestId: request.id, action: "rejected" })
                    }
                    disabled={reviewMutation.isPending}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Importar lead do Odoo</DialogTitle>
            <DialogDescription>
              Selecione os agentes que passarão a seguir o lead. O acesso de cada agente respeita as permissões configuradas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <label className="text-sm font-medium">Agentes seguidores</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {companyUsers
                  .filter((user) => user.role === "agent" && user.ativo)
                  .map((user) => {
                    const mapped = !!user.odooPartnerId;
                    const checked = selectedAgentIds.includes(user.id);
                    return (
                      <label
                        key={user.id}
                        className={`flex items-center gap-3 rounded-md border p-3 ${
                          mapped ? "cursor-pointer" : "opacity-50"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={!mapped}
                          onCheckedChange={(next) =>
                            setSelectedAgentIds((current) =>
                              next
                                ? [...current, user.id]
                                : current.filter((id) => id !== user.id),
                            )
                          }
                        />
                        <span className="min-w-0 text-sm">
                          <span className="block truncate font-medium">
                            {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
                              user.email}
                          </span>
                          <span className="block truncate text-muted-foreground">
                            {mapped
                              ? `Contacto Odoo #${user.odooPartnerId}`
                              : "Falta associar o contacto Odoo"}
                          </span>
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Pesquisar no Odoo</label>
              <Input
                autoFocus
                value={odooSearch}
                onChange={(event) => setOdooSearch(event.target.value)}
                placeholder="Nome do lead ou contacto"
                data-testid="input-search-odoo-lead"
              />
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border p-2">
              {!odooLeadSearch && (
                <p className="p-3 text-sm text-muted-foreground">A carregar leads...</p>
              )}
              {odooLeadSearch?.results.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">
                  Nenhum lead encontrado.
                </p>
              )}
              {odooLeadSearch?.results.map((result) => (
                <div
                  key={result.id}
                  className="flex flex-col gap-3 rounded-md border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{result.name}</p>
                      <Badge variant="outline">Odoo #{result.id}</Badge>
                      {result.localLeadId && <Badge>Já importado</Badge>}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {result.contactName || "Sem contacto"}
                      {result.expectedRevenue ? ` · ${result.expectedRevenue}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => importMutation.mutate(result.id)}
                    disabled={importMutation.isPending}
                    data-testid={`button-import-odoo-lead-${result.id}`}
                  >
                    {result.localLeadId ? "Atualizar seguidores" : "Importar"}
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
