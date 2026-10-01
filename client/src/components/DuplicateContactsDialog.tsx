import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Merge, Trash2, Users } from "lucide-react";
import type { Contacto } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DuplicateGroup = {
  id: string;
  matchedBy: Array<"odoo" | "email" | "phone">;
  contacts: Contacto[];
};

const reasonLabels = { odoo: "Odoo", email: "email", phone: "telefone" };

export function DuplicateContactsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [selectedPrimary, setSelectedPrimary] = useState<Record<string, string>>({});
  const [contactToDelete, setContactToDelete] = useState<Contacto | null>(null);
  const { data, isLoading, refetch } = useQuery<{ groups: DuplicateGroup[] }>({
    queryKey: ["/api/contactos-duplicates"],
    enabled: open,
  });

  useEffect(() => {
    if (!data?.groups) return;
    setSelectedPrimary((current) => {
      const next = { ...current };
      for (const group of data.groups) {
        if (!next[group.id]) next[group.id] = group.contacts[0]?.id;
      }
      return next;
    });
  }, [data]);

  const refresh = async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["/api/contactos"] }),
    ]);
  };

  const mergeMutation = useMutation({
    mutationFn: async (group: DuplicateGroup) => {
      const primaryId = selectedPrimary[group.id];
      const response = await apiRequest("POST", "/api/contactos-merge", {
        primaryId,
        duplicateIds: group.contacts
          .filter((contact) => contact.id !== primaryId)
          .map((contact) => contact.id),
      });
      return response.json();
    },
    onSuccess: async () => {
      await refresh();
      toast({
        title: "Contactos unidos",
        description: "As visitas, tarefas e oportunidades foram preservadas.",
      });
    },
    onError: (error: Error) =>
      toast({ title: "Não foi possível unir", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (contact: Contacto) => {
      await apiRequest("DELETE", `/api/contactos/${contact.id}`);
    },
    onSuccess: async () => {
      setContactToDelete(null);
      await refresh();
      toast({ title: "Contacto removido" });
    },
    onError: (error: Error) =>
      toast({ title: "Não foi possível remover", description: error.message, variant: "destructive" }),
  });

  const groups = data?.groups ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Verificar contactos duplicados
          </DialogTitle>
          <DialogDescription>
            Escolha o contacto a manter. O merge transfere todas as ligações antes
            de remover os duplicados.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl bg-emerald-50 p-6 text-center text-emerald-900">
            Não foram encontrados contactos duplicados.
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.id} className="rounded-xl border p-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  Coincidência por{" "}
                  {group.matchedBy.map((reason) => reasonLabels[reason]).join(", ")}
                </p>
                <div className="space-y-2">
                  {group.contacts.map((contact) => (
                    <label
                      key={contact.id}
                      className={`block cursor-pointer rounded-lg border p-3 ${
                        selectedPrimary[group.id] === contact.id
                          ? "border-primary bg-primary/5"
                          : ""
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name={`primary-${group.id}`}
                          checked={selectedPrimary[group.id] === contact.id}
                          onChange={() =>
                            setSelectedPrimary((current) => ({
                              ...current,
                              [group.id]: contact.id,
                            }))
                          }
                        />
                        <span className="min-w-0 flex-1 font-medium">
                          {contact.nome}
                        </span>
                        {selectedPrimary[group.id] === contact.id && (
                          <span className="flex items-center gap-1 text-xs font-medium text-primary">
                            <CheckCircle2 className="h-4 w-4" />
                            Manter
                          </span>
                        )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={deleteMutation.isPending}
                        onClick={(event) => {
                          event.preventDefault();
                          setContactToDelete(contact);
                        }}
                        aria-label={`Remover ${contact.nome}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      </span>
                      <span className="mt-3 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <span><strong>Email:</strong> {contact.email || "Sem email"}</span>
                        <span><strong>Telefone:</strong> {contact.telemovel || "Sem telefone"}</span>
                        <span><strong>Função:</strong> {contact.funcao || "Sem função"}</span>
                        <span><strong>Odoo:</strong> {contact.odooPartnerId || "Não ligado"}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <Button
                  type="button"
                  className="mt-3 w-full"
                  disabled={mergeMutation.isPending}
                  onClick={() => mergeMutation.mutate(group)}
                >
                  {mergeMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Merge className="mr-2 h-4 w-4" />
                  )}
                  Unir e manter o contacto selecionado
                </Button>
              </section>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
      <AlertDialog
        open={!!contactToDelete}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteMutation.isPending) setContactToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              O contacto “{contactToDelete?.nome}” será removido. As visitas,
              tarefas e oportunidades existentes serão preservadas, mas deixam de
              ficar ligadas a este contacto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!contactToDelete || deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (contactToDelete) deleteMutation.mutate(contactToDelete);
              }}
              className="bg-destructive text-destructive-foreground"
              data-testid="confirm-delete-duplicate-contact"
            >
              {deleteMutation.isPending ? "A remover..." : "Remover contacto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
