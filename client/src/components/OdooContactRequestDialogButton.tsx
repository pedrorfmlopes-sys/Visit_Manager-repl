import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";

type OdooContactRequestDialogButtonProps = {
  contactoId?: string;
  entidadeId?: string;
  contactoNome?: string | null;
  contactoEmail?: string | null;
  contactoTelefone?: string | null;
  entidadeNome?: string | null;
  /**
   * Texto do botão que abre o formulário
   * Ex.: "Pedir criação no CRM"
   */
  triggerLabel?: string;
  /**
   * Se quiseres usar um botão mais pequeno (por ex. em linhas de tabela)
   */
  size?: "default" | "sm";
};

export function OdooContactRequestDialogButton({
  contactoId,
  entidadeId,
  contactoNome,
  contactoEmail,
  contactoTelefone,
  entidadeNome,
  triggerLabel = "Pedir criação/ligação no CRM",
  size = "default",
}: OdooContactRequestDialogButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Campos do “quase novo contacto”
  const [nome, setNome] = useState<string>(contactoNome ?? "");
  const [email, setEmail] = useState<string>(contactoEmail ?? "");
  const [telefone, setTelefone] = useState<string>(contactoTelefone ?? "");
  const [funcao, setFuncao] = useState<string>("");
  const [mensagemExtra, setMensagemExtra] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactoId && !entidadeId) {
      toast({
        variant: "destructive",
        title: "Dados em falta",
        description:
          "Não foi possível identificar o contacto/entidade para o pedido.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Etiquetas para mostrar no texto
      const contactoLabel =
        contactoNome || contactoEmail || contactoTelefone || "Contacto local";
      const entidadeLabel = entidadeNome || "Entidade";

      const descricaoBase = contactoId
        ? `Pedido de criação/ligação no CRM para o contacto "${contactoLabel}" da entidade "${entidadeLabel}".`
        : `Pedido de criação/ligação no CRM para a entidade "${entidadeLabel}".`;

      const linhas: string[] = [];
      linhas.push(descricaoBase);
      linhas.push("");
      linhas.push("Dados sugeridos para criação/validação no CRM:");
      linhas.push(`- Nome: ${nome || contactoLabel}`);
      linhas.push(`- Email: ${email || "—"}`);
      linhas.push(`- Telefone: ${telefone || "—"}`);
      linhas.push(`- Função / cargo: ${funcao || "—"}`);

      if (mensagemExtra.trim().length > 0) {
        linhas.push("");
        linhas.push("Notas adicionais do utilizador:");
        linhas.push(mensagemExtra.trim());
      }

      const mensagem = linhas.join("\n");

      const res = await fetch("/api/odoo/contact-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          contactoId: contactoId ?? null,
          entidadeId: entidadeId ?? null,
          tipo: contactoId ? "contacto" : "entidade",
          mensagem,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Erro ao criar o pedido.");
      }

      toast({
        title: "Pedido enviado",
        description:
          "O teu pedido foi registado. O administrador será notificado para tratar da criação/ligação no CRM.",
      });

      // Limpar apenas campos “editáveis”
      setFuncao("");
      setMensagemExtra("");
      setOpen(false);
    } catch (error: any) {
      console.error("Erro ao criar pedido Odoo:", error);
      toast({
        variant: "destructive",
        title: "Não foi possível enviar o pedido",
        description:
          error?.message ??
          "Ocorreu um erro ao tentar criar o pedido. Verifica as permissões ou tenta mais tarde.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactoLabel =
    contactoNome || contactoEmail || contactoTelefone || "Contacto local";
  const entidadeLabel = entidadeNome || "Entidade";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size={size}
        onClick={() => setOpen(true)}
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <Send className="h-4 w-4 mr-2" />
        {triggerLabel}
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedir criação/ligação no CRM</DialogTitle>
          <DialogDescription>
            Preenche os dados do contacto tal como devem ficar no CRM (Odoo).
            Estes dados serão enviados ao administrador para criar ou ligar o
            registo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contexto: contacto/entidade local */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contacto local</Label>
              <Input
                value={contactoLabel}
                readOnly
                className="bg-muted cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <Label>Entidade local</Label>
              <Input
                value={entidadeLabel}
                readOnly
                className="bg-muted cursor-not-allowed"
              />
            </div>
          </div>

          {/* Dados para criação no CRM */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium">
              Dados para criação/validação no CRM
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="crm-nome">Nome</Label>
                <Input
                  id="crm-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder={contactoLabel}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="crm-email">Email</Label>
                <Input
                  id="crm-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={contactoEmail || "ex: nome@empresa.com"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="crm-telefone">Telefone</Label>
                <Input
                  id="crm-telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder={contactoTelefone || "ex: +351 ..."}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="crm-funcao">Função / cargo</Label>
                <Input
                  id="crm-funcao"
                  value={funcao}
                  onChange={(e) => setFuncao(e.target.value)}
                  placeholder="ex: Diretor Comercial"
                />
              </div>
            </div>
          </div>

          {/* Notas adicionais */}
          <div className="space-y-2">
            <Label>Notas adicionais para o administrador</Label>
            <Textarea
              placeholder="Ex.: Este contacto gere os projetos da marca X; criar com acesso à entidade Y, por favor."
              value={mensagemExtra}
              onChange={(e) => setMensagemExtra(e.target.value)}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Enviar pedido
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
