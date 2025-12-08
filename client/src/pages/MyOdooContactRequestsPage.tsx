import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as AlertDialogTitleUI,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Eye, Loader2, Trash2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type OdooEstado = "pendente" | "em_progresso" | "concluido";

type OdooContactRequest = {
  id: string;
  tipo: "contacto" | "entidade" | string;
  mensagem?: string | null;
  estado: OdooEstado | string;
  createdAt: string;
  updatedAt?: string | null;
};

type ApiResponse = {
  success: boolean;
  data: OdooContactRequest[];
};

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd/MM/yyyy HH:mm", { locale: pt });
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
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${classes}`}>
      {estadoLabel[estado as OdooEstado] ?? estado}
    </span>
  );
}

export default function MyOdooContactRequestsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery<ApiResponse>({
    queryKey: ["/api/odoo/contact-requests/my"],
    queryFn: async () => {
      const res = await fetch("/api/odoo/contact-requests/my", {
        credentials: "include",
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Erro ao carregar os teus pedidos.");
      }
      return json;
    },
  });

  const pedidos = data?.data ?? [];

  const [selected, setSelected] = React.useState<OdooContactRequest | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] =
    React.useState<OdooContactRequest | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/odoo/contact-requests/my/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Erro ao eliminar o pedido.");
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
          "O pedido foi removido (também deixa de aparecer para o administrador).",
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

  const handleAskDelete = (req: OdooContactRequest) => {
    const isConcluido = req.estado === "concluido";
    if (!isConcluido) {
      toast({
        title: "Pedido ainda não concluído",
        description:
          "Este pedido ainda não foi concluído pelo administrador. Só podes apagar pedidos no estado 'Concluído'.",
      });
      return;
    }
    setDeleteTarget(req);
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <main className="max-w-5xl mx-auto px-4 pt-6">
        <div className="mb-4">
          <h1 className="text-lg font-semibold">Os meus pedidos</h1>
          <p className="text-xs text-muted-foreground">
            Pedidos de criação/ligação de contactos e entidades que fiz ao administrador.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Lista de pedidos</CardTitle>
            <CardDescription className="text-xs">
              Consulta o estado dos pedidos que fizeste ao administrador.
              Podes eliminar pedidos já concluídos.
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
                    "Não foi possível carregar a lista de pedidos. Tenta novamente mais tarde."}
                </AlertDescription>
              </Alert>
            ) : pedidos.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Ainda não tens pedidos registados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Data do pedido</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-xs">Mensagem</TableHead>
                      <TableHead className="text-xs text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidos.map((req) => {
                      const createdAt = formatDate(req.createdAt);
                      const tipoLabel =
                        req.tipo === "entidade" ? "Entidade" : "Contacto";
                      const estado = (req.estado as OdooEstado) ?? "pendente";

                      return (
                        <TableRow key={req.id}>
                          <TableCell>
                            <span className="text-[11px] text-muted-foreground">
                              {createdAt}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="rounded-full px-3 py-1 text-[11px] font-medium"
                            >
                              {tipoLabel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {/* Aqui o user só vê, não pode alterar */}
                            <EstadoPill estado={estado} />
                          </TableCell>
                          <TableCell>
                            <span className="text-[11px] text-muted-foreground line-clamp-2">
                              {req.mensagem || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setSelected(req)}
                                title="Ver detalhes do pedido"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleAskDelete(req)}
                                title={
                                  req.estado === "concluido"
                                    ? "Eliminar este pedido"
                                    : "Só podes eliminar pedidos concluídos"
                                }
                              >
                                {deleteMutation.isPending &&
                                deleteTarget?.id === req.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
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
                  <DialogTitle>Detalhe do pedido</DialogTitle>
                  <DialogDescription className="space-y-1 text-xs">
                    <div>
                      <span className="font-medium">Tipo: </span>
                      {selected.tipo === "entidade" ? "Entidade" : "Contacto"}
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
                    <div>
                      <span className="font-medium">Mensagem: </span>
                      {selected.mensagem || "—"}
                    </div>
                  </DialogDescription>
                </DialogHeader>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Confirmar eliminar (apenas para pedidos concluídos) */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) =>
            !open && !deleteMutation.isPending && setDeleteTarget(null)
          }
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitleUI>Eliminar pedido?</AlertDialogTitleUI>
              <AlertDialogDescription className="text-xs">
                Ao eliminar este pedido, ele deixa de aparecer também na lista do
                administrador. Queres mesmo continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!deleteTarget?.id) return;
                  deleteMutation.mutate(deleteTarget.id);
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Apagar pedido
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
