import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Edit2, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function AdminEntidades() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: entidades = [], isLoading } = useQuery<Entidade[]>({
    queryKey: ["/api/admin/entidades"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/entidades/${id}`),
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

  const filteredEntidades = entidades.filter(e =>
    e.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.nif?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold" data-testid="text-admin-entidades-title">
            Gestão de Entidades
          </h1>
          <Button
            onClick={() => setLocation("/entidades/nova")}
            data-testid="button-create-entidade-admin"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Entidade
          </Button>
        </div>

        {/* Search */}
        <Input
          placeholder="Pesquisar por nome ou NIF..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          data-testid="input-search-entidades"
        />

        {/* Entidades List */}
        <div className="space-y-3">
          {filteredEntidades.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-secondary">
                {searchTerm ? "Nenhuma entidade encontrada" : "Nenhuma entidade criada"}
              </CardContent>
            </Card>
          ) : (
            filteredEntidades.map((entidade) => (
              <Card key={entidade.id} className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate" data-testid={`text-entidade-nome-${entidade.id}`}>
                        {entidade.nome}
                      </h3>
                      <div className="text-sm text-secondary space-y-1">
                        {entidade.nif && (
                          <p data-testid={`text-entidade-nif-${entidade.id}`}>NIF: {entidade.nif}</p>
                        )}
                        {entidade.tipoEntidade && (
                          <p data-testid={`text-entidade-tipo-${entidade.id}`}>Tipo: {entidade.tipoEntidade}</p>
                        )}
                        {entidade.email && (
                          <p data-testid={`text-entidade-email-${entidade.id}`}>{entidade.email}</p>
                        )}
                      </div>
                      {!entidade.ativa && (
                        <Badge variant="secondary" className="mt-2" data-testid={`badge-entidade-inactive-${entidade.id}`}>
                          Inativa
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setLocation(`/entidades/${entidade.id}/editar`)}
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
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Entidade?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A entidade será permanentemente eliminada.
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
