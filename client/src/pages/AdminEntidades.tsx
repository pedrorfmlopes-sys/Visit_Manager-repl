import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Edit2, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Entidade } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export default function AdminEntidades() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Pesquisa e filtros locais
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "ativas" | "inativas">("all");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [order, setOrder] = useState<"nome-asc" | "nome-desc">("nome-asc");

  const { data: entidades = [], isLoading } = useQuery<Entidade[]>({
    queryKey: ["/api/admin/entidades"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/entidades/${id}`),
    onSuccess: () => {
      toast({ title: "Entidade eliminada com sucesso" });
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/entidades"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao eliminar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Opções de tipo (a partir das entidades carregadas)
  const tiposNomes = Array.from(
    new Set(
      entidades
        .filter((e) => e.entidadeTipo && e.entidadeTipo.nome)
        .map((e) => e.entidadeTipo!.nome)
    )
  );

  // Aplicar pesquisa + filtros
  const filteredEntidades = entidades.filter((e) => {
    const term = searchTerm.trim().toLowerCase();

    if (term) {
      const nomeMatch = e.nome.toLowerCase().includes(term);
      const nifMatch = e.nif?.toLowerCase().includes(term);
      if (!nomeMatch && !nifMatch) {
        return false;
      }
    }

    if (filterStatus === "ativas" && !e.ativa) return false;
    if (filterStatus === "inativas" && e.ativa) return false;

    if (filterTipo !== "all") {
      const tipoNome = e.entidadeTipo?.nome || "";
      if (tipoNome !== filterTipo) return false;
    }

    return true;
  });

  // Ordenação em memória
  const sortedEntidades = [...filteredEntidades].sort((a, b) => {
    const dir = order === "nome-asc" ? 1 : -1;
    return a.nome.localeCompare(b.nome) * dir;
  });

  const resetFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterTipo("all");
    setOrder("nome-asc");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-primary rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 pt-4">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <h1
            className="text-2xl font-bold"
            data-testid="text-admin-entidades-title"
          >
            Gestão de Entidades (v2 filtros)
          </h1>
          <Button
            onClick={() => setLocation("/entidades/nova")}
            data-testid="button-create-entidade-admin"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Entidade
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Pesquisa */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Pesquisar
                </label>
                <Input
                  placeholder="Pesquisar por nome ou NIF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-entidades"
                />
              </div>

              {/* Estado (ativo/inativo) */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Estado
                </label>
                <Select
                  value={filterStatus}
                  onValueChange={(value: "all" | "ativas" | "inativas") =>
                    setFilterStatus(value)
                  }
                >
                  <SelectTrigger data-testid="select-entidades-estado">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="ativas">Ativas</SelectItem>
                    <SelectItem value="inativas">Inativas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de entidade */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Tipo de entidade
                </label>
                <Select
                  value={filterTipo}
                  onValueChange={(value) => setFilterTipo(value)}
                >
                  <SelectTrigger data-testid="select-entidades-tipo">
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {tiposNomes.map((nome) => (
                      <SelectItem key={nome} value={nome}>
                        {nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Ordenação */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Ordenar por
                </label>
                <Select
                  value={order}
                  onValueChange={(value: "nome-asc" | "nome-desc") =>
                    setOrder(value)
                  }
                >
                  <SelectTrigger data-testid="select-entidades-order">
                    <SelectValue placeholder="Ordenação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nome-asc">Nome A-Z</SelectItem>
                    <SelectItem value="nome-desc">Nome Z-A</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  data-testid="button-reset-entidades-filters"
                  className="ml-auto"
                >
                  Limpar filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entidades List */}
        <div className="space-y-3">
          {sortedEntidades.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-secondary">
                {entidades.length === 0
                  ? "Nenhuma entidade criada"
                  : "Nenhuma entidade corresponde aos filtros/pesquisa"}
              </CardContent>
            </Card>
          ) : (
            sortedEntidades.map((entidade) => (
              <Card key={entidade.id} className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-semibold truncate"
                        data-testid={`text-entidade-nome-${entidade.id}`}
                      >
                        {entidade.nome}
                      </h3>
                      <div className="text-sm text-secondary space-y-1">
                        {entidade.nif && (
                          <p data-testid={`text-entidade-nif-${entidade.id}`}>
                            NIF: {entidade.nif}
                          </p>
                        )}
                        {entidade.entidadeTipo && (
                          <p data-testid={`text-entidade-tipo-${entidade.id}`}>
                            Tipo: {entidade.entidadeTipo.nome}
                          </p>
                        )}
                        {entidade.email && (
                          <p data-testid={`text-entidade-email-${entidade.id}`}>
                            {entidade.email}
                          </p>
                        )}
                      </div>
                      {!entidade.ativa && (
                        <Badge
                          variant="secondary"
                          className="mt-2"
                          data-testid={`badge-entidade-inactive-${entidade.id}`}
                        >
                          Inativa
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() =>
                          setLocation(`/entidades/${entidade.id}/editar`)
                        }
                        data-testid={`button-edit-entidade-${entidade.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => setDeletingId(entidade.id)}
                        data-testid={`button-delete-entidade-${entidade.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Entidade?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A entidade será permanentemente
              eliminada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingId) {
                  deleteMutation.mutate(deletingId);
                }
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-entidade"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
