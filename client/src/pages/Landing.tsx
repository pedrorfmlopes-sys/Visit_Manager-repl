import { Button } from "@/components/ui/button";
import { Building2, Users, FileText, Mic, Sparkles, Mail } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="space-y-4">
            <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto">
              <Building2 className="h-10 w-10 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Visitas Comerciais
            </h1>
            <p className="text-base text-muted-foreground">
              Gestão profissional de visitas a gabinetes de arquitetura
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-lg p-4 space-y-2">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-card-foreground">Contactos</p>
              <p className="text-xs text-muted-foreground">Organize clientes</p>
            </div>
            
            <div className="bg-card rounded-lg p-4 space-y-2">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-card-foreground">Visitas</p>
              <p className="text-xs text-muted-foreground">Registe detalhes</p>
            </div>
            
            <div className="bg-card rounded-lg p-4 space-y-2">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Mic className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-card-foreground">Áudio IA</p>
              <p className="text-xs text-muted-foreground">Transcrição auto</p>
            </div>
            
            <div className="bg-card rounded-lg p-4 space-y-2">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-card-foreground">Resumos IA</p>
              <p className="text-xs text-muted-foreground">Análise inteligente</p>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => window.location.href = "/api/login"}
              className="w-full h-12 text-base"
              data-testid="button-login"
            >
              Entrar
            </Button>
            <p className="text-xs text-muted-foreground">
              Inicie sessão para aceder à aplicação
            </p>
          </div>
        </div>
      </div>

      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>Aplicação PWA mobile-first</p>
      </footer>
    </div>
  );
}
