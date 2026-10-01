import React, { useEffect, useState } from "react";
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
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTitle as AlertDialogTitleUI,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";

import {
  AlertCircle,
  ArrowLeft,
  Eye,
  Loader2,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type OdooEstado = "pendente" | "em_progresso" | "concluido";

type OdooMyRequest = {
  id: string;
  empresaId?: string;
  userId?: string;

  tipo: "contacto" | "entidade" | string;
  contactoId?: string | null;
  entidadeId?: string | null;

  mensagem?: string | null;
  estado: OdooEstado | string;
  createdAt: string;
  updatedAt?: string | null;
  userSeenAt?: string | null;
};

type ApiResponseMy = {
  success: boolean;
  data: OdooMyRequest[];
};

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd/MM/yyyy", { locale: pt });
}

const estadoLabel: Record<string, string> = {
  pendente: "Pendente",
  em_progresso: "Em progresso",
  concluido: "Concluído",
};

const estadoPillClasses: Record<string, string> = {
  pendente: "bg-amber-50 text-amber-800 border border-amber-200",
  em_progresso: "bg-sky-50 text-sky-800 border border-sky-200",
  concluido: "bg-emerald-50 text-emerald-800 border border-emerald-200",
};

function EstadoPill({ estado }: { estado: OdooEstado | string }) {
  const classes =
    estadoPillClasses[estado as OdooEstado] ??
    "bg-muted text-muted-foreground border border-border";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${classes}`}
    >
      {estadoLabel[estado as OdooEstado] ?? estado}
    </span>
  );
}

export default function OdooMyRequestsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<OdooMyRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OdooMyRequest | null>(
    null,
  );

  // Carregar pedidos do próprio utilizador
  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<ApiResponseMy>({
    queryKey: ["/api/odoo/contact-requests/my"],
    queryFn: async () => {
      const res = await fetch("/api/odoo/contact-requests/my", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Erro ao carregar pedidos.");
      }
      return (await res.json()) as ApiResponseMy;
    },
  });

  const pedidos: OdooMyRequest[] = data?.data ?? [];

  // Marcar pedidos concluídos como "vistos"
  const markSeenMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        "/api/odoo/contact-requests/my/mark-seen",
        {
          method: "PATCH",
          credentials: "include",
        },
      );

      if (!res.ok) {
        let message = "Erro ao marcar pedidos como vistos.";
        try {
          const json = await res.json();
          if (json?.message) message = json.message;
        } catch {
          // ignora
        }
        throw new Error(message);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/odoo/contact-requests/my"],
      });
    },
  });

  useEffect(() => {
    if (!pedidos.length) return;
    const hasUnseenCompleted = pedidos.some(
      (p) => p.estado === "concluido" && !p.userSeenAt,
    );
    if (hasUnseenCompleted) {
      markSeenMutation.mutate();
    }
  }, [pedidos, markSeenMutation]);

  // Apagar pedido (apenas os do próprio user, via nova rota /my/:id)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/odoo/contact-requests/my/${id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const json = await res.json();
      if (!json.success) {
        throw new Error(
          json.message || "Erro ao eliminar o pedido.",
        );
      }
      return json.data;
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({
        queryKey: ["/api/odoo/contact-requests/my"],
      });
      toast({
        title: "Pedido eliminado",
        description:
          "O pedido foi removido e já não aparece para o administrador.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao eliminar",
        description:
          err?.message || "Não foi possível eliminar o pedido.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Cabeçalho fixo com botão voltar */}
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Os meus pedidos</h1>
            <p className="text-xs text-muted-foreground">
              Pedidos de criação/ligação de contactos e entidades que fiz
              ao administrador.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Histórico de pedidos
            </CardTitle>
            <CardDescription className="text-xs">
              Consulta o estado dos pedidos, vê o detalhe e remove
              pedidos concluídos que já não façam sentido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground text-sm">
                  A carregar pedidos...
                </span>
              </div>
            ) : isError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro ao carregar pedidos</AlertTitle>
                <AlertDescription>
                  {(error as any)?.message ||
                    "Não foi possível carregar os teus pedidos. Tenta novamente mais tarde."}
                </AlertDescription>
              </Alert>
            ) : pedidos.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Ainda não fizeste nenhum pedido.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs text-center">Data pedido</TableHead>
                      <TableHead className="text-xs text-center">Data conclusão</TableHead>
                      <TableHead className="text-xs text-center">Registo</TableHead>
                      <TableHead className="text-xs text-center">Estado</TableHead>
                      <TableHead className="text-xs text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {pedidos.map((req) => {
                      const createdAt = formatDate(req.createdAt);
                      const isConcluido = req.estado === "concluido";
                      const dataConclusao =
                        isConcluido && req.updatedAt
                          ? formatDate(req.updatedAt)
                          : "—";

                      const tipoLabel =
                        req.tipo === "entidade"
                          ? "Entidade"
                          : "Contacto";

                      const isContacto = req.tipo === "contacto";
                      const isEntidade = req.tipo === "entidade";

                      const registoPath =
                        isContacto && req.contactoId
                          ? `/contactos/${req.contactoId}/detalhes?from=odoo-requests`
                          : isEntidade && req.entidadeId
                          ? `/entidades/${req.entidadeId}?from=odoo-requests`
                          : "";

                      const estado =
                        (req.estado as OdooEstado) ?? "pendente";

                      return (
                        <TableRow key={req.id}>
                          {/* Data pedido */}
                          <TableCell className="text-center">
                            <span className="text-[11px] text-muted-foreground">
                              {createdAt}
                            </span>
                          </TableCell>

                          {/* Data conclusão */}
                          <TableCell className="text-center">
                            <span className="text-[11px] text-muted-foreground">
                              {dataConclusao}
                            </span>
                          </TableCell>

                          {/* Registo (contacto/entidade + olho para abrir) */}
                          <TableCell className="text-center">
                            <div className="inline-flex items-center gap-2">
                              <span className="text-[11px] font-medium">
                                {tipoLabel}
                              </span>

                              {registoPath && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setLocation(registoPath)}
                                  title={
                                    isContacto
                                      ? "Abrir contacto no Visit Manager"
                                      : "Abrir entidade no Visit Manager"
                                  }
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>


                          {/* Estado (apenas leitura) */}
                          <TableCell className="text-center">
                            <EstadoPill estado={estado} />
                          </TableCell>

                          {/* Ações: ver pedido + apagar (só concluído) */}
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Ver detalhe do pedido (dialog) */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setSelected(req)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>

                              {/* Apagar pedido */}
                              {isConcluido ? (
                                <AlertDialog
                                  open={deleteTarget?.id === req.id}
                                  onOpenChange={(open) =>
                                    !open && setDeleteTarget(null)
                                  }
                                >
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      onClick={() => setDeleteTarget(req)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitleUI>
                                        Eliminar pedido?
                                      </AlertDialogTitleUI>
                                      <AlertDialogDescription>
                                        Esta ação não pode ser anulada.
                                        Ao eliminar o pedido, ele será
                                        removido também da lista do
                                        administrador.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        Cancelar
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => {
                                          if (!req.id) return;
                                          deleteMutation.mutate(req.id);
                                        }}
                                        disabled={deleteMutation.isPending}
                                      >
                                        {deleteMutation.isPending && (
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        )}
                                        Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground"
                                  onClick={() =>
                                    toast({
                                      title: "Não é possível apagar ainda",
                                      description:
                                        "Só podes apagar pedidos que já estejam concluídos pelo administrador.",
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog ver pedido */}
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
                    {selected.tipo === "entidade"
                      ? "Entidade"
                      : "Contacto"}
                  </DialogTitle>
                  <DialogDescription className="space-y-1 text-xs">
                    <div>
                      <span className="font-medium">Tipo: </span>
                      {selected.tipo === "entidade"
                        ? "Entidade"
                        : "Contacto"}
                    </div>
                    <div>
                      <span className="font-medium">Mensagem: </span>
                      {selected.mensagem && selected.mensagem.trim() !== ""
                        ? selected.mensagem
                        : "—"}
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
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export { OdooMyRequestsPage };
