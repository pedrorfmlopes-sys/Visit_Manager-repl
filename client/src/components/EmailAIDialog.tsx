import { useState } from "react";
import { Mail, MessageCircle, Copy, Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useShareActions } from "./ShareDialog";
import { emailTemplates, type EmailTemplateType, type EmailTone, type GenerateEmailResponse } from "@shared/emailTemplates";

interface EmailAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitaId?: number;
  contactoId?: number;
  entidadeId?: number;
  defaultTemplate?: EmailTemplateType;
}

interface EmailDraft {
  subject: string;
  body: string;
}

export function EmailAIDialog({
  open,
  onOpenChange,
  visitaId,
  contactoId,
  entidadeId,
  defaultTemplate = "followup_pos_visita",
}: EmailAIDialogProps) {
  const { toast } = useToast();
  const { isOnline, shareViaWhatsApp, copyToClipboard } = useShareActions();
  
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateType>(defaultTemplate);
  const [selectedTone, setSelectedTone] = useState<EmailTone>("neutro");
  const [draft, setDraft] = useState<EmailDraft | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/tools/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          templateType: selectedTemplate,
          tone: selectedTone,
          visitaId: visitaId?.toString(),
          contactoId: contactoId?.toString(),
          entidadeId: entidadeId?.toString(),
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate email');
      }
      
      return response.json() as Promise<GenerateEmailResponse>;
    },
    onSuccess: (data) => {
      setDraft(data);
      toast({
        title: "Email gerado",
        description: "Revise e personalize antes de enviar.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao gerar email",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!isOnline) {
      toast({
        title: "Sem internet",
        description: "Geração de emails requer conexão à internet.",
        variant: "destructive",
      });
      return;
    }
    generateMutation.mutate();
  };

  const handleSendEmail = () => {
    if (!draft) return;
    
    if (!isOnline) {
      toast({
        title: "Sem internet",
        description: "Envio de emails requer conexão à internet.",
        variant: "destructive",
      });
      return;
    }

    const mailtoUrl = `mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
    window.location.href = mailtoUrl;
    onOpenChange(false);
  };

  const handleSendWhatsApp = () => {
    if (!draft) return;
    
    const fullText = `*${draft.subject}*\n\n${draft.body}`;
    shareViaWhatsApp(fullText);
    onOpenChange(false);
  };

  const handleCopy = () => {
    if (!draft) return;
    
    const fullText = `${draft.subject}\n\n${draft.body}`;
    copyToClipboard(fullText, "Email copiado!");
  };

  const handleClose = () => {
    setDraft(null);
    setSelectedTemplate(defaultTemplate);
    setSelectedTone("neutro");
    onOpenChange(false);
  };

  const templateOptions = emailTemplates.map((template) => ({
    value: template.id,
    label: template.label,
  }));

  const toneOptions: { value: EmailTone; label: string }[] = [
    { value: "formal", label: "Formal" },
    { value: "neutro", label: "Neutro" },
    { value: "amigavel", label: "Amigável" },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Gerar Email com IA
          </DialogTitle>
          <DialogDescription>
            Selecione o tipo e tom do email. A IA criará um rascunho que pode editar antes de enviar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template">Tipo de Email</Label>
              <Select
                value={selectedTemplate}
                onValueChange={(value) => setSelectedTemplate(value as EmailTemplateType)}
                disabled={generateMutation.isPending}
              >
                <SelectTrigger id="template" data-testid="select-email-template">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {templateOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone">Tom do Email</Label>
              <Select
                value={selectedTone}
                onValueChange={(value) => setSelectedTone(value as EmailTone)}
                disabled={generateMutation.isPending}
              >
                <SelectTrigger id="tone" data-testid="select-email-tone">
                  <SelectValue placeholder="Selecione o tom" />
                </SelectTrigger>
                <SelectContent>
                  {toneOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!draft && (
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !isOnline}
              className="w-full"
              data-testid="button-generate-email"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Email
                </>
              )}
            </Button>
          )}

          {draft && (
            <div className="space-y-4 border rounded-md p-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Assunto</Label>
                <Input
                  id="subject"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  data-testid="input-email-subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">Mensagem</Label>
                <Textarea
                  id="body"
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  rows={12}
                  className="font-mono text-sm"
                  data-testid="textarea-email-body"
                />
              </div>
            </div>
          )}
        </div>

        {draft && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={handleCopy}
              data-testid="button-copy-email"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar
            </Button>
            <Button
              variant="outline"
              onClick={handleSendWhatsApp}
              disabled={!isOnline}
              data-testid="button-whatsapp-email"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={!isOnline}
              data-testid="button-send-email"
            >
              <Mail className="h-4 w-4 mr-2" />
              Enviar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
