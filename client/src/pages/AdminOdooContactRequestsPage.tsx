import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";

type OdooContactRequest = {
  id: string;
  empresaId: string;
  userId: string;
  contactoId: string | null;
  entidadeId: string | null;
  tipo: string;
  mensagem: string | null;
  estado: "pendente" | "em_progresso" | "concluido";
  createdAt: string;
};

export default function AdminOdooContactRequestsPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/odoo/contact-requests"],
    queryFn: async () => {
      const res = await fetch("/api/odoo/contact-requests");
      if (!res.ok) throw new Error("Failed to fetch contact requests");
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Erro ao carregar pedidos.");
      return json.data as OdooContactRequest[];
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
      const res = await fetch(`/api/odoo/contact-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Erro ao atualizar estado do pedido.");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/odoo/contact-requests"] });
    },
  });

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <CardTitle>Pedidos / Aprovações</CardTitle>
              <CardDescription>
                Pedidos de criação/ligação de contactos e entidades no CRM.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">A carregar pedidos...</span>
            </div>
          ) : isError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro ao carregar pedidos</AlertTitle>
              <AlertDescription>
                Não foi possível carregar a lista de pedidos. Tente novamente mais tarde.
              </AlertDescription>
            </Alert>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum pedido encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Estado Atual</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        {format(new Date(req.createdAt), "dd/MM/yyyy HH:mm", { locale: pt })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-tipo-${req.tipo}`}>
                          {req.tipo === "contacto" ? "Contacto" : "Entidade"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate" data-testid={`cell-mensagem-${req.id}`}>
                        {req.mensagem || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            req.estado === "concluido"
                              ? "default"
                              : req.estado === "em_progresso"
                              ? "secondary"
                              : "outline"
                          }
                          data-testid={`badge-estado-${req.id}`}
                        >
                          {req.estado === "pendente"
                            ? "Pendente"
                            : req.estado === "em_progresso"
                            ? "Em progresso"
                            : "Concluído"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={req.estado}
                          onValueChange={(value) =>
                            updateEstadoMutation.mutate({
                              id: req.id,
                              estado: value as "pendente" | "em_progresso" | "concluido",
                            })
                          }
                          disabled={updateEstadoMutation.isPending}
                          data-testid={`select-estado-${req.id}`}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="em_progresso">Em progresso</SelectItem>
                            <SelectItem value="concluido">Concluído</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
