import { useLocation } from "wouter";
import { LogOut, Building2, Mail, Settings } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";

export default function AgentMore() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold text-foreground">Mais</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Perfil */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="text-base font-medium text-foreground">
                {user?.firstName} {user?.lastName || ''}
              </p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-base font-medium text-foreground">{user?.email}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Empresa</p>
              <p className="text-base font-medium text-foreground">
                {user?.empresa?.nome || 'Sem empresa'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Definições - Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Definições
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Funcionalidades adicionais em breve...
            </p>
          </CardContent>
        </Card>

        {/* Logout */}
        <div className="space-y-3">
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleLogout}
            data-testid="button-logout-agent"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Terminar Sessão
          </Button>
        </div>
      </main>
    </div>
  );
}
