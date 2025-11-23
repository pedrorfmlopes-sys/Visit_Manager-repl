import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { LogOut, Building2, Mail, Settings, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function AgentMore() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isDev = import.meta.env.DEV;

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const toggleRoleMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/dev/toggle-role", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to toggle role");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sucesso",
        description: `Role alterado para: ${data.role}`,
      });
      // Invalidate auth query to refresh user data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Redirect to home
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao mudar role. Apenas disponível em desenvolvimento.",
        variant: "destructive",
      });
    },
  });

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

        {/* Dev Tools */}
        {isDev && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Dev Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Role atual: <span className="font-semibold">{user?.role || "agent"}</span>
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => toggleRoleMutation.mutate()}
                disabled={toggleRoleMutation.isPending}
                data-testid="button-toggle-role"
              >
                <Zap className="h-4 w-4 mr-2" />
                {toggleRoleMutation.isPending ? "A mudar..." : `Mudar para ${user?.role === "admin" ? "agent" : "admin"}`}
              </Button>
            </CardContent>
          </Card>
        )}

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
