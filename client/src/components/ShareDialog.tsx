import { useState } from "react";
import { Share2, MessageCircle, Mail, Copy, Link as LinkIcon, FileText, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export interface ShareOption {
  icon: typeof MessageCircle;
  label: string;
  action: () => void;
  disabled?: boolean;
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  options: ShareOption[];
}

export function ShareDialog({
  open,
  onOpenChange,
  title,
  description,
  options,
}: ShareDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-2 py-4">
          {options.map((option, index) => (
            <Button
              key={index}
              variant="outline"
              className="justify-start"
              onClick={() => {
                option.action();
                onOpenChange(false);
              }}
              disabled={option.disabled}
              data-testid={`button-share-${option.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <option.icon className="h-4 w-4 mr-3" />
              {option.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Utility functions for sharing
export function useShareActions() {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Update online status
  useState(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });

  const shareViaWhatsApp = (text: string) => {
    if (!isOnline) {
      toast({
        title: "Sem internet",
        description: "Disponível apenas com internet.",
        variant: "destructive",
      });
      return;
    }

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const shareViaEmail = (text: string, subject: string = "Informação") => {
    if (!isOnline) {
      toast({
        title: "Sem internet",
        description: "Disponível apenas com internet.",
        variant: "destructive",
      });
      return;
    }

    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.location.href = mailtoUrl;
  };

  const copyToClipboard = async (text: string, successMessage: string = "Copiado!") => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: successMessage,
        description: "Texto copiado para a área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar para a área de transferência.",
        variant: "destructive",
      });
    }
  };

  const copyLink = async (path: string) => {
    const fullUrl = `${window.location.origin}${path}`;
    await copyToClipboard(fullUrl, "Link copiado!");
  };

  return {
    isOnline,
    shareViaWhatsApp,
    shareViaEmail,
    copyToClipboard,
    copyLink,
  };
}

// Deep link generator
export function getDeepLink(type: 'contact' | 'entity' | 'visit', id: string): string {
  const baseUrl = window.location.origin;
  const paths = {
    contact: `/contactos/${id}`,
    entity: `/entidades/${id}`,
    visit: `/visitas/${id}`,
  };
  return `${baseUrl}${paths[type]}`;
}
