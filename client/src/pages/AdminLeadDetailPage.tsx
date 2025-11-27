import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

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

      <LeadDetailForm lead={lead} />
    </div>
  );
}

function LeadDetailForm({ lead }: { lead: Lead }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [form, setForm] = useState({
    titulo: lead.titulo,
    descricao: lead.descricao ?? "",
    marca: lead.marca ?? "",
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
        marca: form.marca.trim() || null,
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
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
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
            <div className="text-xs text-muted-foreground">Contacto</div>
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
              <Label htmlFor="lead-marca">Marca</Label>
              <Input
                id="lead-marca"
                value={form.marca}
                onChange={handleChange("marca")}
                placeholder="Ex.: Ritmonio, Revestech..."
                data-testid="input-lead-marca"
              />
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
