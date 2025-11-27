import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import type { Marca } from "@shared/schema";

type Contacto = {
  id: string;
  nome: string;
  email?: string | null;
  telemovel?: string | null;
};

type Lead = {
  id: string;
  titulo: string;
  descricao: string | null;
  marca: string | null;
  estado: string;
  valorPrevisto: string | null;
  moeda: string | null;
  entidadeId: string;
  contactoId: string;
  visitaId: string | null;
  odooLeadId: string | null;
  createdAt: string;
  updatedAt: string;
  entidadeNome?: string | null;
  contactoNome?: string | null;
  visitaData?: string | null;
  contactosAssociados?: Contacto[] | null;
  marcas?: Marca[] | null;
};

type LeadResponse =
  | { lead: Lead }
  | { success: false; notEnabled?: boolean; message?: string };

export default function AdminLeadDetailPage() {
  const [_, params] = useRoute("/admin/leads/:id");
  const id = params?.id as string | undefined;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery<LeadResponse>({
    queryKey: ["/api/crm/leads", id],
    enabled: !!id,
    queryFn: async () => {
      const resp = await fetch(`/api/crm/leads/${id}`, {
        credentials: "include",
      });
      return resp.json();
    },
  });

  if (!id) {
    return <p className="p-4 text-sm text-muted-foreground">ID de lead inválido.</p>;
  }

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">A carregar lead...</p>;
  }

  if (isError || !data || ("success" in data && data.success === false && !data.notEnabled)) {
    return (
      <div className="p-4">
        <p className="text-sm text-destructive">
          Erro ao carregar lead. Tenta recarregar a página.
        </p>
      </div>
    );
  }

  if ("success" in data && data.notEnabled) {
    return (
      <p className="p-4 text-sm text-amber-600">
        Módulo de Leads CRM está desativado para esta empresa.
      </p>
    );
  }

  const lead = (data as { lead: Lead }).lead;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/admin/leads")}
          data-testid="button-voltar-leads"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold">Lead: {lead.titulo}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <LeadDetailForm lead={lead} />
        </div>
        <div>
          <OdooCrmCard leadId={lead.id} odooLeadId={lead.odooLeadId} />
        </div>
      </div>
    </div>
  );
}

function LeadDetailForm({ lead }: { lead: Lead }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [marcasSearch, setMarcasSearch] = useState("");

  const { data: marcas = [] } = useQuery<Marca[]>({
    queryKey: ["/api/marcas", "onlyAtivas"],
    queryFn: async () => {
      const response = await fetch("/api/marcas?onlyAtivas=true", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch marcas");
      return response.json();
    },
  });

  const [form, setForm] = useState({
    titulo: lead.titulo,
    descricao: lead.descricao ?? "",
    marcasIds: lead.marcas?.map((m) => m.id) ?? [],
    estado: lead.estado ?? "novo",
    valorPrevisto: lead.valorPrevisto ?? "",
    moeda: lead.moeda ?? "EUR",
  });

  const [saving, setSaving] = useState(false);

  const handleChange =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };

  const handleSave = async () => {
    try {
      setSaving(true);

      const body: any = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        marcasIds: form.marcasIds && form.marcasIds.length > 0 ? form.marcasIds : undefined,
        estado: form.estado || "novo",
        valorPrevisto: form.valorPrevisto ? Number(form.valorPrevisto) : null,
        moeda: form.moeda || "EUR",
      };

      const resp = await fetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const json = await resp.json();

      if (!resp.ok || json.success === false) {
        throw new Error(json.message || `HTTP ${resp.status}`);
      }

      toast({
        title: "Lead atualizado",
        description: "Os dados do lead foram guardados.",
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", lead.id] }),
        queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", { visitaId: lead.visitaId }] }),
        queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", { entidadeId: lead.entidadeId }] }),
        queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", { contactoId: lead.contactoId }] }),
      ]);
    } catch (error: any) {
      console.error("[CRM Leads] PATCH lead error:", error);
      toast({
        title: "Erro ao atualizar lead",
        description: error?.message || "Não foi possível guardar as alterações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="mb-4" data-testid="card-lead-contexto">
        <CardHeader>
          <CardTitle className="text-sm">Contexto do lead</CardTitle>
          <CardDescription className="text-xs">
            Entidade, contacto e visita associados a este lead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Entidade</div>
              {lead.entidadeNome ? (
                <button
                  type="button"
                  className="underline-offset-2 hover:underline text-left"
                  onClick={() => navigate(`/admin/entidades/${lead.entidadeId}`)}
                  data-testid="link-lead-entidade"
                >
                  {lead.entidadeNome}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Sem entidade associada
                </span>
              )}
            </div>

            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Contacto principal</div>
              {lead.contactoNome ? (
                <button
                  type="button"
                  className="underline-offset-2 hover:underline text-left"
                  onClick={() => navigate(`/admin/contactos/${lead.contactoId}`)}
                  data-testid="link-lead-contacto"
                >
                  {lead.contactoNome}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Sem contacto associado
                </span>
              )}
            </div>

            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Visita</div>
              {lead.visitaId && lead.visitaData ? (
                <button
                  type="button"
                  className="underline-offset-2 hover:underline text-left"
                  onClick={() => navigate(`/admin/visitas/${lead.visitaId}`)}
                  data-testid="link-lead-visita"
                >
                  {new Date(lead.visitaData).toLocaleDateString()}
                </button>
              ) : lead.visitaId ? (
                <button
                  type="button"
                  className="underline-offset-2 hover:underline text-left"
                  onClick={() => navigate(`/admin/visitas/${lead.visitaId}`)}
                  data-testid="link-lead-visita"
                >
                  Ver visita
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Sem visita associada
                </span>
              )}
            </div>
          </div>

          {lead.contactosAssociados && lead.contactosAssociados.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              <div className="text-xs text-muted-foreground font-medium">Outros contactos envolvidos:</div>
              <div className="flex flex-wrap gap-2">
                {lead.contactosAssociados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/admin/contactos/${c.id}`)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-secondary text-secondary-foreground hover:underline"
                    data-testid={`chip-contacto-${c.id}`}
                  >
                    {c.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {lead.marcas && lead.marcas.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              <div className="text-xs text-muted-foreground font-medium">Marcas associadas:</div>
              <div className="flex flex-wrap gap-2">
                {lead.marcas.map((marca) => (
                  <Badge key={marca.id} variant="secondary" data-testid={`badge-lead-detalhe-marca-${marca.id}`}>
                    {marca.nome}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Editar Lead</CardTitle>
          <CardDescription>
            Edita os dados principais deste lead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="lead-titulo">Título *</Label>
            <Input
              id="lead-titulo"
              value={form.titulo}
              onChange={handleChange("titulo")}
              data-testid="input-lead-titulo"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="lead-descricao">Descrição</Label>
            <Textarea
              id="lead-descricao"
              value={form.descricao}
              onChange={handleChange("descricao")}
              rows={3}
              data-testid="textarea-lead-descricao"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Marcas</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    data-testid="button-lead-edit-marcas-dropdown"
                  >
                    {form.marcasIds?.length
                      ? `${form.marcasIds.length} marca${form.marcasIds.length === 1 ? "" : "s"} selecionada${form.marcasIds.length === 1 ? "" : "s"}`
                      : "Seleciona uma ou mais marcas"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" side="bottom" align="start">
                  <div className="p-3 border-b">
                    <Input
                      placeholder="Pesquisar marcas..."
                      value={marcasSearch}
                      onChange={(e) => setMarcasSearch(e.target.value)}
                      className="h-8"
                      data-testid="input-lead-edit-marcas-search"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {marcas.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhuma marca disponível
                      </div>
                    ) : (
                      marcas
                        .filter((marca) =>
                          marca.nome.toLowerCase().includes(marcasSearch.toLowerCase())
                        )
                        .map((marca) => {
                          const isSelected = form.marcasIds?.includes(marca.id);
                          return (
                            <div
                              key={marca.id}
                              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted"
                              onClick={() => {
                                const newIds = isSelected
                                  ? (form.marcasIds || []).filter((id) => id !== marca.id)
                                  : [...(form.marcasIds || []), marca.id];
                                setForm((f) => ({ ...f, marcasIds: newIds }));
                              }}
                              data-testid={`button-lead-edit-marca-${marca.id}`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => {}}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-sm">{marca.nome}</span>
                            </div>
                          );
                        })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label htmlFor="lead-estado">Estado</Label>
              <select
                id="lead-estado"
                className="border rounded px-2 py-1 text-sm w-full bg-background"
                value={form.estado}
                onChange={handleChange("estado")}
                data-testid="select-lead-estado"
              >
                <option value="novo">Novo</option>
                <option value="em_analise">Em análise</option>
                <option value="proposta_enviada">Proposta enviada</option>
                <option value="ganho">Ganho</option>
                <option value="perdido">Perdido</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="lead-valor">Valor previsto</Label>
              <Input
                id="lead-valor"
                type="number"
                min="0"
                step="0.01"
                value={form.valorPrevisto}
                onChange={handleChange("valorPrevisto")}
                data-testid="input-lead-valor"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="lead-moeda">Moeda</Label>
            <Input
              id="lead-moeda"
              value={form.moeda}
              onChange={handleChange("moeda")}
              data-testid="input-lead-moeda"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setLocation("/admin/leads")}
            data-testid="button-cancelar-lead"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.titulo.trim()}
            data-testid="button-guardar-lead"
          >
            {saving ? "A guardar..." : "Guardar alterações"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

type OdooStatusResponse =
  | { configured: true; baseUrl: string; isActive: boolean }
  | { configured: false; message?: string };

function OdooCrmCard({ leadId, odooLeadId }: { leadId: string; odooLeadId: string | null }) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const { data: odooStatus, isLoading: statusLoading } = useQuery<OdooStatusResponse>({
    queryKey: ["/api/integrations/odoo/status"],
    queryFn: async () => {
      const resp = await fetch("/api/integrations/odoo/status", {
        credentials: "include",
      });
      return resp.json();
    },
  });

  const handleSync = async () => {
    try {
      setSyncing(true);

      const resp = await fetch(`/api/crm/leads/${leadId}/odoo/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const json = await resp.json();

      if (!resp.ok || json.success === false) {
        throw new Error(json.message || `HTTP ${resp.status}`);
      }

      const message = json.created
        ? "Lead criado no Odoo."
        : "Lead sincronizado com Odoo.";

      toast({
        title: "Sucesso",
        description: message,
      });

      // Refazer fetch do lead para atualizar odooLeadId
      await queryClient.invalidateQueries({
        queryKey: ["/api/crm/leads", leadId],
      });
    } catch (error: any) {
      console.error("[Odoo Sync] Error:", error);
      toast({
        title: "Erro ao sincronizar",
        description: error?.message || "Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const isOdooConfigured = odooStatus && "configured" in odooStatus && odooStatus.configured;
  const odooBaseUrl = isOdooConfigured ? (odooStatus as any).baseUrl : null;
  const odooLeadUrl = odooLeadId && odooBaseUrl
    ? `${odooBaseUrl}/web#id=${odooLeadId}&model=crm.lead&view_type=form`
    : null;

  return (
    <Card data-testid="card-odoo-crm">
      <CardHeader>
        <CardTitle className="text-sm">Odoo CRM</CardTitle>
        <CardDescription className="text-xs">
          Sincronizar lead com Odoo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {statusLoading ? (
          <p className="text-xs text-muted-foreground">A carregar estado...</p>
        ) : !isOdooConfigured ? (
          <p className="text-xs text-amber-600">
            Odoo não está configurado ou está desligado para esta empresa.
          </p>
        ) : (
          <>
            {odooLeadId ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Lead sincronizado: <span className="font-mono text-xs">{odooLeadId}</span>
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSync}
                    disabled={syncing}
                    data-testid="button-sincronizar-odoo"
                  >
                    {syncing ? "A sincronizar..." : "Sincronizar"}
                  </Button>
                  {odooLeadUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(odooLeadUrl, "_blank")}
                      data-testid="button-abrir-odoo"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Abrir
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Lead não sincronizado com Odoo.
                </p>
                <Button
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  data-testid="button-criar-odoo"
                  className="w-full"
                >
                  {syncing ? "A criar..." : "Criar lead no Odoo"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
