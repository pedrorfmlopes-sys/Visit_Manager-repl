import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

import {
  ArrowLeft,
  Loader2,
  Eye,
  Store,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

// Mantemos o tipo frouxo para não “bater” em difs de backend
type OdooContactRequest = any;

type ApiResponse = {
  success: boolean;
  data: OdooContactRequest[];
};

const estadoLabel: Record<string, string> = {
  pendente: "Pendente",
  em_progresso: "Em progresso",
  concluido: "Concluído",
};

const estadoBadgeVariant: Record<string, "default" | "outline" | "secondary"> = {
  pendente: "outline",
  em_progresso: "default",
  concluido: "secondary",
};

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd/MM/yyyy HH:mm", { locale: pt });
}

export default function MyOdooRequestsPage() {
  const [, setLocation] = useLocation();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<OdooContactRequest | null>(null);

  const endpoint = isAdmin
    ? "/api/odoo/contact-requests"
    : "/api/odoo/contact-requests/my";

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<ApiResponse>({
    queryKey: [endpoint],
    queryFn: async () => {
      const res = await apiRequest("GET", endpoint);
      return res as ApiResponse;
    },
  });

  const pedidos: OdooContactRequest[] = data?.data ?? [];

  const hasUnseen =
    !isAdmin &&
    pedidos.some(
      (p) => p.estado === "concluido" && (p.userSeenAt === null || p.userSeenAt === undefined),
    );

  const markSeenMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/odoo/contact-requests/my/mark-seen");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast({
        title: "Atualizado",
        description: "Pedidos concluídos marcados como vistos.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao atualizar",
        description: err?.message ?? "Não foi possível marcar como visto.",
        variant: "destructive",
      });
    },
  });

  const updateEstadoMutation = useMutation({
    mutationFn: async ({
      id,
      estado,
    }: {
      id: string;
      estado: "pendente" | "em_progresso" | "concluido";
    }) => {
      await apiRequest("PATCH", `/api/odoo/contact-requests/${id}`, { estado });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast({
        title: "Pedido atualizado",
        description: "Estado do pedido atualizado com sucesso.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao atualizar pedido",
        description: err?.message ?? "Não foi possível atualizar o pedido.",
        variant: "destructive",
      });
    },
  });

  const handleChangeEstado = (
    pedido: OdooContactRequest,
    estado: "pendente" | "em_progresso" | "concluido",
  ) => {
    if (!pedido?.id) return;
    if (pedido.estado === estado) return;
    updateEstadoMutation.mutate({ id: pedido.id, estado });
  };

  const renderIconEstado = (estado: string) => {
    if (estado === "concluido") {
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    }
    if (estado === "em_progresso") {
      return <Clock className="h-4 w-4 text-amber-500" />;
    }
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-semibold">
                  Pedidos / Aprovações CRM
                </h1>
              </div>
              <p className="text-xs text-muted-foreground">
                {isAdmin
                  ? "Vê e gere todos os pedidos de criação/ligação no CRM."
                  : "Histórico dos teus pedidos de criação/ligação no CRM."}
              </p>
            </div>
          </div>

          {!isAdmin && hasUnseen && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markSeenMutation.mutate()}
              disabled={markSeenMutation.isLoading}
            >
              {markSeenMutation.isLoading && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Marcar concluídos como vistos
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              A carregar pedidos...
            </span>
          </div>
        )}

        {isError && (
          <Card>
            <CardContent className="py-6 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium">
                  Erro ao carregar pedidos
                </p>
                <p className="text-xs text-muted-foreground">
                  {(error as any)?.message ??
                    "Tenta recarregar a página dentro de alguns instantes."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && pedidos.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center space-y-2">
              <p className="text-sm font-medium">
                Ainda não existem pedidos de contactos Odoo.
              </p>
              <p className="text-xs text-muted-foreground">
                Sempre que fizeres um pedido a partir de um contacto ou entidade,
                ele aparecerá aqui.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading &&
          !isError &&
          pedidos.length > 0 &&
          pedidos.map((pedido) => {
            const tipoLabel =
              pedido.tipo === "entidade" ? "Entidade" : "Contacto";

            const contactoNome =
              pedido.contactoNome ||
              pedido.contactoLabel ||
              pedido.contactoNomeLocal ||
              pedido.contactoId ||
              "—";

            const entidadeNome =
              pedido.entidadeNome ||
              pedido.entidadeLabel ||
              pedido.entidadeNomeLocal ||
              pedido.entidadeId ||
              "—";

            const estado = pedido.estado ?? "pendente";

            return (
              <Card
                key={pedido.id}
                className="border border-border"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {renderIconEstado(estado)}
                        <CardTitle className="text-sm">
                          Pedido {tipoLabel.toLowerCase()} –{" "}
                          <span className="font-semibold">
                            {tipoLabel === "Contacto"
                              ? contactoNome
                              : entidadeNome}
                          </span>
                        </CardTitle>
                      </div>
                      <CardDescription className="text-[11px]">
                        Criado em {formatDate(pedido.createdAt)} · Última
                        atualização {formatDate(pedido.updatedAt)}
                      </CardDescription>
                    </div>

                    <Badge
                      variant={estadoBadgeVariant[estado] ?? "outline"}
                      className="text-[11px] px-2 py-0.5"
                    >
                      {estadoLabel[estado] ?? estado}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-3 text-sm">
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium">Contacto: </span>
                      {contactoNome}
                    </div>
                    <div>
                      <span className="font-medium">Entidade: </span>
                      {entidadeNome}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(pedido)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver pedido
                    </Button>

                    {isAdmin && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="text-muted-foreground mr-1">
                          Atualizar estado:
                        </span>
                        <Button
                          size="sm"
                          variant={
                            estado === "pendente" ? "default" : "outline"
                          }
                          onClick={() =>
                            handleChangeEstado(pedido, "pendente")
                          }
                          disabled={updateEstadoMutation.isLoading}
                        >
                          Pendente
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            estado === "em_progresso" ? "default" : "outline"
                          }
                          onClick={() =>
                            handleChangeEstado(pedido, "em_progresso")
                          }
                          disabled={updateEstadoMutation.isLoading}
                        >
                          Em progresso
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            estado === "concluido" ? "default" : "outline"
                          }
                          onClick={() =>
                            handleChangeEstado(pedido, "concluido")
                          }
                          disabled={updateEstadoMutation.isLoading}
                        >
                          Concluído
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

        {/* Dialog para ver o formulário/mensagem completa */}
        <Dialog
          open={!!selected}
          onOpenChange={(open) => !open && setSelected(null)}
        >
          <DialogContent>
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle>
                    Pedido CRM –{" "}
                    {selected.tipo === "entidade" ? "Entidade" : "Contacto"}
                  </DialogTitle>
                  <DialogDescription className="space-y-1 text-xs">
                    <div>
                      <span className="font-medium">Contacto: </span>
                      {selected.contactoNome ||
                        selected.contactoLabel ||
                        selected.contactoNomeLocal ||
                        selected.contactoId ||
                        "—"}
                    </div>
                    <div>
                      <span className="font-medium">Entidade: </span>
                      {selected.entidadeNome ||
                        selected.entidadeLabel ||
                        selected.entidadeNomeLocal ||
                        selected.entidadeId ||
                        "—"}
                    </div>
                    <div>
                      <span className="font-medium">Criado em: </span>
                      {formatDate(selected.createdAt)}
                    </div>
                    <div>
                      <span className="font-medium">
                        Última atualização:{" "}
                      </span>
                      {formatDate(selected.updatedAt)}
                    </div>
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">
                    Mensagem enviada ao administrador
                  </p>
                  <p className="text-sm whitespace-pre-line bg-muted rounded-md px-3 py-2 max-h-64 overflow-auto">
                    {selected.mensagem && selected.mensagem.trim().length > 0
                      ? selected.mensagem
                      : "Sem mensagem adicional."}
                  </p>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
