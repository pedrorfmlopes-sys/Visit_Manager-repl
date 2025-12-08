import React, { useState } from "react";
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  Loader2,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type OdooEstado = "pendente" | "em_progresso" | "concluido";

type OdooContactRequest = {
  id: string;
  empresaId?: string;
  userId?: string;
  userName?: string | null;

  tipo: "contacto" | "entidade" | string;
  contactoId?: string | null;
  entidadeId?: string | null;

  contactoNome?: string | null;
  contactoLabel?: string | null;
  contactoNomeLocal?: string | null;

  entidadeNome?: string | null;
  entidadeLabel?: string | null;
  entidadeNomeLocal?: string | null;

  mensagem?: string | null;
  estado: OdooEstado | string;
  createdAt: string;
  updatedAt?: string | null;
};

type ApiResponse = {
  success: boolean;
  data: OdooContactRequest[];
};

type EstadoFilter = "todos" | OdooEstado;
type TipoFilter = "todos" | "contacto" | "entidade";

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

const estadosOrder: OdooEstado[] = [
  "pendente",
  "em_progresso",
  "concluido",
];

function getNextEstado(actual: OdooEstado): OdooEstado {
  const idx = estadosOrder.indexOf(actual);
  if (idx === -1) return "pendente";
  const nextIdx = (idx + 1) % estadosOrder.length;
  return estadosOrder[nextIdx];
}

export default function AdminOdooContactRequestsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<OdooContactRequest | null>(
    null
  );
  const [openDetail, setOpenDetail] = useState(false);

  const [estadoFilter, setEstadoFilter] =
    useState<EstadoFilter>("todos");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("todos");

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<ApiResponse>({
    queryKey: ["/api/odoo/contact-requests"],
    queryFn: async () => {
      const res = await fetch("/api/odoo/contact-requests", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Erro ao carregar pedidos.");
      }
      return (await res.json()) as ApiResponse;
    },
  });

  const pedidosAll: OdooContactRequest[] = data?.data ?? [];

  const pedidos = pedidosAll.filter((req) => {
    const matchEstado =
      estadoFilter === "todos"
        ? true
        : (req.estado as OdooEstado) === estadoFilter;

    const matchTipo =
      tipoFilter === "todos" ? true : req.tipo === tipoFilter;

    const search = searchTerm.trim().toLowerCase();

    const matchSearch = !search
      ? true
      : [
          req.contactoNome,
          req.contactoLabel,
          req.contactoNomeLocal,
          req.entidadeNome,
          req.entidadeLabel,
          req.entidadeNomeLocal,
          req.userName,
          req.mensagem,
        ]
          .filter(Boolean)
          .some((val) =>
            String(val).toLowerCase().includes(search)
          );

    return matchEstado && matchTipo && matchSearch;
  });

  const updateEstadoMutation = useMutation({
    mutationFn: async (args: { id: string; estado: OdooEstado }) => {
      const res = await fetch(
        `/api/odoo/contact-requests/${args.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ estado: args.estado }),
        }
      );

      const json = await res.json();
      if (!json.success) {
        throw new Error(
          json.message || "Erro ao atualizar o estado do pedido."
        );
      }
      return json.data as OdooContactRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/odoo/contact-requests"],
      });
      toast({
        title: "Estado atualizado",
        description:
          "O estado do pedido foi atualizado com sucesso.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao atualizar estado",
        description:
          err?.message ||
          "Não foi possível atualizar o estado do pedido.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/odoo/contact-requests/${id}`, {
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
      queryClient.invalidateQueries({
        queryKey: ["/api/odoo/contact-requests"],
      });
      toast({
        title: "Pedido eliminado",
        description: "O pedido foi removido.",
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

  const handleChangeEstado = (
    req: OdooContactRequest,
    novoEstado: OdooEstado
  ) => {
    const current =
      (req.estado as OdooEstado) ?? ("pendente" as OdooEstado);
    if (!req.id) return;
    if (novoEstado === current) return;
    updateEstadoMutation.mutate({ id: req.id, estado: novoEstado });
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">
              Pedidos de acesso a dados do Odoo
            </h1>
            <p className="text-xs text-muted-foreground">
              Aprove ou recuse pedidos relacionados com leads, contactos
              e entidades sincronizados com o Odoo.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Lista de pedidos</CardTitle>
            <CardDescription className="text-xs">
              Gere o estado dos pedidos, consulte o detalhe e remova
              pedidos que já não façam sentido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <div className="flex-1">
                <Input
                  placeholder="Procurar por contacto, entidade, utilizador ou mensagem..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={estadoFilter}
                  onValueChange={(val: EstadoFilter) =>
                    setEstadoFilter(val)
                  }
                >
                  <SelectTrigger className="w-[140px] h-9 text-xs">
                    <SelectValue placeholder="Todos os estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">
                      Todos os estados
                    </SelectItem>
                    <SelectItem value="pendente">
                      Pendente
                    </SelectItem>
                    <SelectItem value="em_progresso">
                      Em progresso
                    </SelectItem>
                    <SelectItem value="concluido">
                      Concluído
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={tipoFilter}
                  onValueChange={(val: TipoFilter) =>
                    setTipoFilter(val)
                  }
                >
                  <SelectTrigger className="w-[140px] h-9 text-xs">
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">
                      Todos os tipos
                    </SelectItem>
                    <SelectItem value="contacto">
                      Contactos
                    </SelectItem>
                    <SelectItem value="entidade">
                      Entidades
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  A carregar pedidos...
                </span>
              </div>
            ) : isError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro ao carregar pedidos</AlertTitle>
                <AlertDescription>
                  {(error as any)?.message ||
                    "Não foi possível carregar a lista de pedidos. Tente novamente mais tarde."}
                </AlertDescription>
              </Alert>
            ) : pedidos.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nenhum pedido encontrado com os filtros atuais.
              </div>
            ) : (
              <div className="border rounded-md">
                <ScrollArea className="max-h-[520px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs text-center">
                          Data do pedido
                        </TableHead>
                        <TableHead className="text-xs text-center">
                          Data conclusão
                        </TableHead>
                        <TableHead className="text-xs text-center">
                          Registo
                        </TableHead>
                        <TableHead className="text-xs text-center">
                          Estado atual
                        </TableHead>
                        <TableHead className="text-xs text-center w-[130px]">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidos.map((req) => {
                        const createdAt = formatDate(req.createdAt);
                        const isConcluido =
                          req.estado === "concluido";
                        const dataConclusao = isConcluido
                          ? formatDate(
                              req.updatedAt || req.createdAt
                            )
                          : "—";

                        const tipoLabel =
                          req.tipo === "entidade"
                            ? "Entidade"
                            : "Contacto";

                        const isContacto = req.tipo === "contacto";
                        const isEntidade = req.tipo === "entidade";

                        const contactoNome =
                          req.contactoNome ||
                          req.contactoLabel ||
                          req.contactoNomeLocal ||
                          "";
                        const entidadeNome =
                          req.entidadeNome ||
                          req.entidadeLabel ||
                          req.entidadeNomeLocal ||
                          "";

                        const registoPath =
                          isContacto && req.contactoId
                            ? `/contactos/${req.contactoId}/detalhes?from=odoo-requests`
                            : isEntidade && req.entidadeId
                            ? `/entidades/${req.entidadeId}?from=odoo-requests`
                            : "";

                        const estado =
                          (req.estado as OdooEstado) ?? "pendente";
                        const authorName =
                          req.userName || "Utilizador desconhecido";

                        return (
                          <TableRow key={req.id}>
                            <TableCell className="text-center">
                              <span className="text-[11px] text-muted-foreground">
                                {createdAt}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-[11px] text-muted-foreground">
                                {dataConclusao}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center gap-3">
                                <Badge
                                  variant="outline"
                                  className="rounded-full px-3 py-1 text-[11px] font-medium"
                                >
                                  {tipoLabel}
                                </Badge>

                                <span className="text-[11px] text-muted-foreground flex-1 truncate">
                                  {authorName}
                                </span>

                                {registoPath && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() =>
                                      setLocation(registoPath)
                                    }
                                    title={
                                      isContacto
                                        ? contactoNome ||
                                          "Abrir contacto no Visit Manager"
                                        : entidadeNome ||
                                          "Abrir entidade no Visit Manager"
                                    }
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center w-[130px]">
                              <Select
                                value={estado as OdooEstado}
                                onValueChange={(value) =>
                                  handleChangeEstado(
                                    req,
                                    value as OdooEstado
                                  )
                                }
                                disabled={
                                  updateEstadoMutation.isPending
                                }
                              >
                                <SelectTrigger
                                  className={`w-[120px] h-8 text-[11px] flex items-center justify-center text-center ${
                                    estadoPillClasses[
                                      estado as OdooEstado
                                    ] ?? ""
                                  }`}
                                >
                                  <SelectValue placeholder="Estado" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pendente">
                                    Pendente
                                  </SelectItem>
                                  <SelectItem value="em_progresso">
                                    Em progresso
                                  </SelectItem>
                                  <SelectItem value="concluido">
                                    Concluído
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell >
                            <TableCell className="text-center" >
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setSelected(req);
                                    setOpenDetail(true);
                                  }}
                                  title="Ver pedido original"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8 text-destructive border-destructive/40"
                                      title="Eliminar pedido"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitleUI>
                                        Confirmar eliminação
                                      </AlertDialogTitleUI>
                                      <AlertDialogDescription>
                                        Tem a certeza de que pretende
                                        eliminar este pedido? Esta
                                        ação não pode ser anulada.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        Cancelar
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => {
                                          if (!req.id) return;
                                          deleteMutation.mutate(
                                            req.id
                                          );
                                        }}
                                        disabled={
                                          deleteMutation.isPending
                                        }
                                      >
                                        {deleteMutation.isPending && (
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        )}
                                        Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog
        open={openDetail}
        onOpenChange={(open) => {
          setOpenDetail(open);
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-w-xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Detalhe do pedido</DialogTitle>
                <DialogDescription>
                  <div className="space-y-1 text-xs">
                    <div>
                      <span className="font-medium">
                        Data do pedido:{" "}
                      </span>
                      {formatDate(selected.createdAt)}
                    </div>
                    <div>
                      <span className="font-medium">
                        Estado atual:{" "}
                      </span>
                      <EstadoPill estado={selected.estado} />
                    </div>
                    <div>
                      <span className="font-medium">
                        Última atualização:{" "}
                      </span>
                      {formatDate(selected.updatedAt)}
                    </div>
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">
                  Mensagem enviada pelo utilizador
                </p>
                <p className="text-sm whitespace-pre-line bg-muted rounded-md px-3 py-2">
                  {selected.mensagem || "Sem mensagem adicional."}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
