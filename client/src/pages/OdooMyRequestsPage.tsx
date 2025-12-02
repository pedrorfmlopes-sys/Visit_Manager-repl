import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

type MyOdooRequest = {
  id: string;
  estado: "pendente" | "em_progresso" | "concluido";
  createdAt: string;
  tipo: "contacto" | "entidade";
  mensagem: string | null;
  userSeenAt: string | null;
};

export function OdooMyRequestsPage() {
  const queryClient = useQueryClient();

  const {
    data: myOdooRequests = [],
    isLoading,
    isError,
  } = useQuery<MyOdooRequest[]>({
    queryKey: ["/api/odoo/contact-requests/my"],
    queryFn: async () => {
      const res = await fetch("/api/odoo/contact-requests/my");
      if (!res.ok) {
        throw new Error("Failed to fetch my Odoo requests");
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Erro ao carregar os teus pedidos.");
      }
      return json.data as MyOdooRequest[];
    },
  });

  // Marcar pedidos concluídos como vistos quando a página é aberta
  useEffect(() => {
    if (isLoading || myOdooRequests.length === 0) return;

    const hasUnseenDone = myOdooRequests.some(
      (r) => r.estado === "concluido" && !r.userSeenAt
    );
    if (!hasUnseenDone) return;

    (async () => {
      try {
        const res = await fetch(
          "/api/odoo/contact-requests/my/mark-seen",
          { method: "PATCH" }
        );
        const json = await res.json();
        if (json.success) {
          // Recarregar dados desta página + card do dashboard user
          queryClient.invalidateQueries({
            queryKey: ["/api/odoo/contact-requests/my"],
          });
        }
      } catch (e) {
        console.error("Erro ao marcar pedidos como vistos", e);
      }
    })();
  }, [isLoading, myOdooRequests, queryClient]);

  return (
    <main className="p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <CardTitle>Os meus pedidos</CardTitle>
              <CardDescription>
                Pedidos de criação/ligação de contactos e entidades que fiz ao administrador.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>A carregar pedidos...</span>
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">
              Erro ao carregar os teus pedidos.
            </p>
          ) : myOdooRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não fizeste nenhum pedido.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myOdooRequests.map((req) => (
                  <TableRow key={req.id} data-testid={`row-request-${req.id}`}>
                    <TableCell data-testid={`cell-date-${req.id}`}>
                      {format(new Date(req.createdAt), "dd/MM/yyyy HH:mm", {
                        locale: pt,
                      })}
                    </TableCell>
                    <TableCell data-testid={`cell-type-${req.id}`}>
                      <Badge variant="outline">
                        {req.tipo === "contacto" ? "Contacto" : "Entidade"}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`cell-status-${req.id}`}>
                      <Badge
                        variant={
                          req.estado === "concluido"
                            ? "default"
                            : req.estado === "em_progresso"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {req.estado === "pendente"
                          ? "Pendente"
                          : req.estado === "em_progresso"
                          ? "Em progresso"
                          : "Concluído"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate" data-testid={`cell-message-${req.id}`}>
                      {req.mensagem || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
