import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import type { VisitaWithRelations } from "@shared/schema";

interface UpdateVisitStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visita: VisitaWithRelations | undefined;
  onSuccess?: () => void;
}

type Step = "options" | "follow-up" | "mark-done" | "cancel";

export function UpdateVisitStatusDialog({
  open,
  onOpenChange,
  visita,
  onSuccess,
}: UpdateVisitStatusDialogProps) {
  const [step, setStep] = useState<Step>("options");
  const [realizedDate, setRealizedDate] = useState<string>("");
  const [associateToVisita, setAssociateToVisita] = useState(false);
  const [selectedVisitaId, setSelectedVisitaId] = useState<string>("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch related visitas for association
  const { data: relatedVisitas = [] } = useQuery<VisitaWithRelations[]>({
    queryKey: ["/api/visitas", visita?.entidadeId, "related"],
    enabled: open && !!visita?.entidadeId && associateToVisita,
    queryFn: async () => {
      const response = await fetch(
        `/api/visitas?entidadeId=${visita?.entidadeId}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch visitas");
      const data = await response.json();
      // Filter out current visita
      return data.filter((v: VisitaWithRelations) => v.id !== visita?.id);
    },
  });

  // Mutation: Create follow-up visit (existing logic) + mark status
  const createFollowUpMutation = useMutation({
    mutationFn: async () => {
      if (!visita) throw new Error("Visita is required");
      // First, update the status to 'seguimento_criado'
      await apiRequest("PATCH", `/api/visitas/${visita.id}`, {
        proximaVisitaStatus: "seguimento_criado",
        proximaVisitaStatusData: new Date(),
      });
      const params = new URLSearchParams({
        visitaAnteriorId: visita.id,
        dataVisita: (visita.proximaVisita)?.toString() || "",
        entidadeId: visita.entidadeId || visita.gabineteId || "",
        contactoId: visita.contactoId || "",
        entidadeName: visita.gabinete?.nome || visita.entidade?.nome || "",
        contactoName: visita.contacto?.nome || "",
        visitaAnteriorData: visita.dataVisita?.toString() || "",
        resumoVisitaAnterior: visita.resumoIa || "",
      });
      // Redirect to new visit form
      window.location.href = `/visitas/nova?${params.toString()}`;
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar visita de follow-up",
        variant: "destructive",
      });
    },
  });

  // Mutation: Mark as done only (without creating follow-up)
  const markDoneOnlyMutation = useMutation({
    mutationFn: async () => {
      if (!visita) throw new Error("Visita is required");
      const dateToSet = realizedDate ? new Date(realizedDate as string) : new Date();
      await apiRequest("PATCH", `/api/visitas/${visita.id}`, {
        dataVisita: dateToSet,
        proximaVisita: null,
        proximaVisitaStatus: "realizada",
        proximaVisitaStatusData: new Date(),
        visitaAnteriorId: associateToVisita && selectedVisitaId ? selectedVisitaId : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitas"] });
      toast({
        title: "Sucesso",
        description: "Visita marcada como realizada",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao marcar visita como realizada",
        variant: "destructive",
      });
    },
  });

  // Mutation: Cancel appointment only (clear proximaVisita)
  const cancelAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!visita) throw new Error("Visita is required");
      await apiRequest("PATCH", `/api/visitas/${visita.id}`, {
        proximaVisita: null,
        proximaVisitaStatus: "cancelada",
        proximaVisitaStatusData: new Date(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitas"] });
      toast({
        title: "Sucesso",
        description: "Agendamento cancelado com sucesso",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao cancelar agendamento",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setStep("options");
    setRealizedDate("");
    setAssociateToVisita(false);
    setSelectedVisitaId("");
    onOpenChange(false);
  };

  if (!visita) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atualizar Estado da Visita Agendada</DialogTitle>
          <DialogDescription>
            Escolha como pretende proceder com este agendamento
          </DialogDescription>
        </DialogHeader>

        {step === "options" && (
          <div className="space-y-3 py-4">
            {/* Option 1: Create Follow-up */}
            <Card className="cursor-pointer hover-elevate" onClick={() => setStep("follow-up")}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Criar Nova Visita (Follow-up)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Marcar esta visita como realizada e criar automaticamente uma nova visita de
                  follow-up com os mesmos dados (entidade, contacto, etc.).
                </p>
                <Button variant="outline" size="sm" onClick={() => setStep("follow-up")}>
                  Continuar
                </Button>
              </CardContent>
            </Card>

            {/* Option 2: Mark as Done Only */}
            <Card className="cursor-pointer hover-elevate" onClick={() => setStep("mark-done")}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-accent" />
                  Só Marcar como Realizada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Marcar apenas esta visita como realizada, sem criar nova visita de follow-up
                  automática. Pode associar esta visita a outra visita da mesma entidade.
                </p>
                <Button variant="outline" size="sm" onClick={() => setStep("mark-done")}>
                  Continuar
                </Button>
              </CardContent>
            </Card>

            {/* Option 3: Cancel Appointment */}
            <Card className="cursor-pointer hover-elevate" onClick={() => setStep("cancel")}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <X className="h-5 w-5 text-destructive" />
                  Cancelar Agendamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Cancelar apenas este agendamento de próxima visita. Não serão criadas nem
                  apagadas visitas – apenas será removida a informação de próxima visita.
                </p>
                <Button variant="outline" size="sm" onClick={() => setStep("cancel")}>
                  Continuar
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Follow-up Option */}
        {step === "follow-up" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              A nova visita será criada com base na data agendada:{" "}
              <strong>
                {format(new Date(visita.proximaVisita), "PPP 'às' HH:mm", { locale: pt })}
              </strong>
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("options")}
                data-testid="button-back-options"
              >
                Voltar
              </Button>
              <Button
                onClick={() => createFollowUpMutation.mutate()}
                disabled={createFollowUpMutation.isPending}
                data-testid="button-confirm-follow-up"
              >
                {createFollowUpMutation.isPending ? "A criar..." : "Criar Follow-up"}
              </Button>
            </div>
          </div>
        )}

        {/* Mark as Done Only */}
        {step === "mark-done" && (
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="realized-date" className="text-sm font-medium mb-2 block">
                Data em que a visita foi realizada
              </Label>
              <Input
                id="realized-date"
                type="datetime-local"
                value={realizedDate || new Date().toISOString().slice(0, 16)}
                onChange={(e) => setRealizedDate(e.target.value)}
                data-testid="input-realized-date"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Deixar em branco para usar a data/hora atual
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="associate-visita"
                  checked={associateToVisita}
                  onCheckedChange={(checked) => setAssociateToVisita(checked as boolean)}
                  data-testid="checkbox-associate-visita"
                />
                <Label htmlFor="associate-visita" className="text-sm font-medium cursor-pointer">
                  Associar a outra visita desta entidade
                </Label>
              </div>

              {associateToVisita && (
                <div className="ml-6">
                  <Select value={selectedVisitaId} onValueChange={setSelectedVisitaId}>
                    <SelectTrigger data-testid="select-related-visita">
                      <SelectValue placeholder="Selecione uma visita..." />
                    </SelectTrigger>
                    <SelectContent>
                      {relatedVisitas.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {format(new Date(v.dataVisita), "dd/MM/yyyy", { locale: pt })} -{" "}
                          {v.gabinete?.nome || v.entidade?.nome || "Sem nome"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("options")}
                data-testid="button-back-options-2"
              >
                Voltar
              </Button>
              <Button
                onClick={() => markDoneOnlyMutation.mutate()}
                disabled={markDoneOnlyMutation.isPending}
                data-testid="button-confirm-mark-done"
              >
                {markDoneOnlyMutation.isPending ? "A guardar..." : "Marcar como Realizada"}
              </Button>
            </div>
          </div>
        )}

        {/* Cancel Appointment */}
        {step === "cancel" && (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-destructive/10 rounded-md border border-destructive/20">
              <p className="text-sm font-medium text-destructive mb-2">Tem a certeza?</p>
              <p className="text-sm text-muted-foreground">
                Isto irá remover apenas a informação de próxima visita agendada. Nenhuma visita será
                criada ou eliminada.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("options")}
                data-testid="button-back-options-3"
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={() => cancelAppointmentMutation.mutate()}
                disabled={cancelAppointmentMutation.isPending}
                data-testid="button-confirm-cancel"
              >
                {cancelAppointmentMutation.isPending ? "A cancelar..." : "Cancelar Agendamento"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
