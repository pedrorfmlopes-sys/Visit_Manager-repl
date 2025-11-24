import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Lightbulb, User, Zap, Bell } from "lucide-react";
import { useState, useEffect } from "react";
import type { UserSettingsResponse } from "@shared/schema";

export default function Perfil() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [localSettings, setLocalSettings] = useState<any>(null);

  // Fetch user settings
  const { data: settingsData, isLoading: isLoadingSettings } = useQuery<UserSettingsResponse>({
    queryKey: ['/api/user/settings'],
  });

  // Initialize local state when settings load
  useEffect(() => {
    if (settingsData) {
      setLocalSettings(settingsData.userSettings);
    }
  }, [settingsData]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await apiRequest('/api/user/settings', {
        method: 'PATCH',
        body: { userSettings: updates },
      });
      return response.json();
    },
    onSuccess: (data) => {
      setLocalSettings(data.userSettings);
      toast({
        title: "Sucesso",
        description: "Definições guardadas com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao guardar definições",
        variant: "destructive",
      });
    },
  });

  if (isLoading || isLoadingSettings) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-primary rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!settingsData || !localSettings) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-center text-muted-foreground">Não foi possível carregar definições</p>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    updateMutation.mutate(localSettings);
  };

  const handleHomePageChange = (value: string) => {
    setLocalSettings({
      ...localSettings,
      homePage: value,
    });
  };

  const handleListDensityChange = (value: string) => {
    setLocalSettings({
      ...localSettings,
      listDensity: value,
    });
  };

  const handleIAToggle = (key: 'showVisitSummary' | 'showTaskSuggestions' | 'showDashboardInsights') => {
    setLocalSettings({
      ...localSettings,
      ia: {
        ...localSettings.ia,
        [key]: !localSettings.ia[key],
      },
    });
  };

  const handleNotificationToggle = (key: 'emailTaskReminders' | 'emailVisitReminders') => {
    setLocalSettings({
      ...localSettings,
      notifications: {
        ...localSettings.notifications,
        [key]: !localSettings.notifications[key],
      },
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-8">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground">Perfil & Definições</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Perfil Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="text-base font-medium text-foreground">{settingsData.nome}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-base font-medium text-foreground">{settingsData.email || 'N/A'}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Função</p>
              <p className="text-base font-medium text-foreground">
                {settingsData.role === 'admin' ? 'Administrador' : 'Agente'}
              </p>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Empresa</p>
              <p className="text-base font-medium text-foreground">{settingsData.empresaNome}</p>
            </div>
          </CardContent>
        </Card>

        {/* Interface Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Preferências de Interface
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Página Inicial ao Abrir</label>
              <Select value={localSettings.homePage || 'dashboard'} onValueChange={handleHomePageChange}>
                <SelectTrigger data-testid="select-home-page">
                  <SelectValue placeholder="Seleciona página inicial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dashboard">Dashboard</SelectItem>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="visitas">Visitas</SelectItem>
                  <SelectItem value="tarefas">Tarefas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Densidade das Listas</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={localSettings.listDensity === 'comfortable' ? 'default' : 'outline'}
                  onClick={() => handleListDensityChange('comfortable')}
                  data-testid="button-density-comfortable"
                >
                  Confortável
                </Button>
                <Button
                  type="button"
                  variant={localSettings.listDensity === 'compact' ? 'default' : 'outline'}
                  onClick={() => handleListDensityChange('compact')}
                  data-testid="button-density-compact"
                >
                  Compacta
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* IA Preferences */}
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-600" />
              Preferências de IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white dark:bg-background rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Mostrar Resumo da Visita Gerado por IA</p>
                <p className="text-xs text-muted-foreground mt-1">Analisa notas e cria resumo automático</p>
              </div>
              <Switch
                checked={localSettings.ia?.showVisitSummary !== false}
                onCheckedChange={() => handleIAToggle('showVisitSummary')}
                data-testid="switch-visit-summary"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-white dark:bg-background rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Mostrar Sugestões de Tarefas Geradas por IA</p>
                <p className="text-xs text-muted-foreground mt-1">Sugere tarefas baseadas no contexto</p>
              </div>
              <Switch
                checked={localSettings.ia?.showTaskSuggestions !== false}
                onCheckedChange={() => handleIAToggle('showTaskSuggestions')}
                data-testid="switch-task-suggestions"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-white dark:bg-background rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Mostrar Insights IA no Dashboard</p>
                <p className="text-xs text-muted-foreground mt-1">Análise personalizada de performance</p>
              </div>
              <Switch
                checked={localSettings.ia?.showDashboardInsights !== false}
                onCheckedChange={() => handleIAToggle('showDashboardInsights')}
                data-testid="switch-dashboard-insights"
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-card-secondary rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Lembretes de Tarefas por Email</p>
                <p className="text-xs text-muted-foreground mt-1">Recebe notificações de tarefas</p>
              </div>
              <Switch
                checked={localSettings.notifications?.emailTaskReminders || false}
                onCheckedChange={() => handleNotificationToggle('emailTaskReminders')}
                data-testid="switch-email-tasks"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-card-secondary rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Lembretes de Visitas por Email</p>
                <p className="text-xs text-muted-foreground mt-1">Recebe notificações de visitas</p>
              </div>
              <Switch
                checked={localSettings.notifications?.emailVisitReminders || false}
                onCheckedChange={() => handleNotificationToggle('emailVisitReminders')}
                data-testid="switch-email-visits"
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-settings"
          >
            {updateMutation.isPending ? 'A Guardar...' : 'Guardar Definições'}
          </Button>
        </div>
      </main>
    </div>
  );
}
