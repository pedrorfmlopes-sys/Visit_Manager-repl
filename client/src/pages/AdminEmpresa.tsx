import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Empresa } from "@shared/schema";
import { Upload, Cloud, Settings, MapPin, Bell, Zap, Lightbulb } from "lucide-react";
import { useRef, useState } from "react";

const updateEmpresaSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  nif: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable(),
  telefone: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  mostrarMarcasEmVisitas: z.boolean().default(false),
  mostrarGPS: z.boolean().default(false),
  theme: z.enum(["light-business", "dark-pro"]).default("light-business"),
  uiSettings: z.record(z.any()).optional(),
});

type UpdateEmpresaForm = z.infer<typeof updateEmpresaSchema>;

export default function AdminEmpresa() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: empresa, isLoading, error } = useQuery<Empresa>({
    queryKey: ["/api/admin/empresa"],
  });

  const form = useForm<UpdateEmpresaForm>({
    resolver: zodResolver(updateEmpresaSchema),
    values: empresa ? {
      nome: empresa.nome,
      nif: empresa.nif || "",
      email: empresa.email || "",
      telefone: empresa.telefone || "",
      logoUrl: empresa.logoUrl || "",
      mostrarMarcasEmVisitas: empresa.mostrarMarcasEmVisitas,
      mostrarGPS: empresa.mostrarGPS,
      theme: empresa.theme || "light-business",
      uiSettings: empresa.uiSettings as any || {},
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateEmpresaForm) =>
      apiRequest("PATCH", "/api/admin/empresa", data),
    onSuccess: () => {
      toast({ title: "Configuração guardada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/empresa"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao guardar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.type)) {
      toast({
        title: "Tipo de ficheiro inválido",
        description: "Use PNG, JPG, SVG ou WebP",
        variant: "destructive",
      });
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/admin/empresa/logo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar logo");
      }

      const data = await response.json();
      form.setValue("logoUrl", data.logoUrl);
      toast({ title: "Logo carregado com sucesso" });
      
      // Invalidate queries to refresh
      queryClient.invalidateQueries({ queryKey: ["/api/admin/empresa"] });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar logo",
        description: error.message,
        variant: "destructive",
      });
      setLogoPreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-primary rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-destructive">Erro ao carregar configuração da empresa</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentLogo = logoPreview || empresa?.logoUrl;

  return (
    <div className="min-h-screen pb-32 pt-4">
      <div className="max-w-4xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-admin-settings-title">Centro de Configurações</CardTitle>
            <CardDescription>Gerencie as definições da sua empresa</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
                <Tabs defaultValue="geral" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 gap-2 h-auto">
                    <TabsTrigger value="geral" data-testid="tab-settings-geral">Geral</TabsTrigger>
                    <TabsTrigger value="visitas" data-testid="tab-settings-visitas">Visitas & Tarefas</TabsTrigger>
                    <TabsTrigger value="ia" data-testid="tab-settings-ia">IA & Áudio</TabsTrigger>
                    <TabsTrigger value="localizacao" data-testid="tab-settings-localizacao">Localização</TabsTrigger>
                    <TabsTrigger value="alertas" data-testid="tab-settings-alertas">Alertas & UX</TabsTrigger>
                    <TabsTrigger value="integrações" data-testid="tab-settings-integrações">Integrações</TabsTrigger>
                  </TabsList>

                  {/* TAB 1: GERAL - Identidade & Logo */}
                  <TabsContent value="geral" className="space-y-6 mt-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold">Informações Gerais</h3>
                      
                      <FormField
                        control={form.control}
                        name="nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome da Empresa</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-settings-nome" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="nif"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>NIF</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} data-testid="input-settings-nif" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} value={field.value || ""} data-testid="input-settings-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="telefone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} data-testid="input-settings-telefone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4 pt-6 border-t">
                      <h3 className="font-semibold">Tema & Logo</h3>

                      <FormField
                        control={form.control}
                        name="theme"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tema da Aplicação</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger data-testid="select-settings-theme">
                                  <SelectValue placeholder="Selecione um tema" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="light-business">Tema claro (Business)</SelectItem>
                                <SelectItem value="dark-pro">Tema escuro (Pro)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-3">
                        <FormLabel>Logo da Empresa</FormLabel>
                        {currentLogo && (
                          <div className="flex items-center gap-4">
                            <img
                              src={currentLogo}
                              alt="Logo preview"
                              className="h-16 max-w-xs object-contain rounded border"
                              data-testid="img-logo-preview"
                            />
                            <span className="text-sm text-muted-foreground">Logo atual</span>
                          </div>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          onChange={handleLogoUpload}
                          className="hidden"
                          data-testid="input-logo-file"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          data-testid="button-upload-logo"
                          className="gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          {uploading ? "A carregar..." : "Carregar novo logo"}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG, SVG ou WebP. Máx 50MB
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  {/* TAB 2: VISITAS & TAREFAS */}
                  <TabsContent value="visitas" className="space-y-6 mt-6">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="mostrarMarcasEmVisitas"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-mostrar-marcas"
                              />
                            </FormControl>
                            <div className="space-y-1">
                              <FormLabel className="font-normal cursor-pointer">
                                Mostrar seleção de marcas nas visitas
                              </FormLabel>
                              <p className="text-sm text-muted-foreground">
                                Permite aos agentes selecionar e rastrear marcas entregues
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <div className="pt-4 border-t space-y-4">
                        <div>
                          <FormLabel>Follow-ups e Histórico de Visitas</FormLabel>
                          <p className="text-sm text-muted-foreground mt-1">
                            Permite criar visitas de acompanhamento e rastrear a cadeia de visitas
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">Cadeia de follow-ups:</span>
                          <Badge variant="secondary">Ativado</Badge>
                        </div>
                      </div>

                      <div className="pt-4 border-t space-y-4">
                        <div>
                          <FormLabel>Tarefas Padrão</FormLabel>
                          <p className="text-sm text-muted-foreground mt-1">
                            Configure o comportamento padrão ao criar tarefas
                          </p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Tarefas criadas pelo utilizador autenticado
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* TAB 3: IA & TRANSCRIÇÃO */}
                  <TabsContent value="ia" className="space-y-6 mt-6">
                    {/* Dashboard Insights - IA */}
                    <div className="space-y-4 pb-6 border-b">
                      <FormField
                        control={form.control}
                        name="uiSettings"
                        render={({ field }) => {
                          const uiSettings = field.value || {};
                          const isEnabled = uiSettings.enableIA !== false;
                          return (
                            <FormItem className="space-y-4">
                              <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-900/30">
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Lightbulb className="w-5 h-5 text-amber-600" />
                                    <FormLabel className="text-base font-semibold cursor-pointer">
                                      Insights IA no Dashboard
                                    </FormLabel>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Ativa ou desativa a geração de insights e recomendações automáticas baseadas em IA no dashboard
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-3">
                                    {isEnabled
                                      ? "✓ Os dashboards mostram análises personalizadas por utilizador (agentes) ou agregadas por empresa (admin)"
                                      : "✗ Os cards de insights mostram uma mensagem informativa sem chamar a IA"}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    field.onChange({ ...uiSettings, enableIA: !isEnabled });
                                  }}
                                  className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                    isEnabled
                                      ? "bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100"
                                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                  }`}
                                  data-testid="button-toggle-ia-insights"
                                >
                                  {isEnabled ? "Ativado" : "Desativado"}
                                </button>
                              </div>
                            </FormItem>
                          );
                        }}
                      />
                    </div>

                    <div className="space-y-4">
                      <div>
                        <FormLabel className="text-base font-semibold">IA - Resumos e Sugestões</FormLabel>
                        <p className="text-sm text-muted-foreground mt-2">
                          Controle a utilização de inteligência artificial nas suas visitas
                        </p>
                      </div>

                      <div className="pt-2 border-t space-y-3">
                        <div className="flex items-start gap-2">
                          <input type="checkbox" defaultChecked className="mt-1" data-testid="checkbox-ia-resumo" />
                          <div>
                            <p className="font-medium text-sm">Geração de resumo da visita por IA</p>
                            <p className="text-xs text-muted-foreground">Gera automaticamente resumos das visitas</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <input type="checkbox" defaultChecked className="mt-1" data-testid="checkbox-ia-sugestoes" />
                          <div>
                            <p className="font-medium text-sm">Sugestões de tarefas por IA</p>
                            <p className="text-xs text-muted-foreground">Sugere tarefas de acompanhamento</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <input type="checkbox" defaultChecked className="mt-1" data-testid="checkbox-ia-criar-tarefas" />
                          <div>
                            <p className="font-medium text-sm">Criar tarefas diretamente das sugestões</p>
                            <p className="text-xs text-muted-foreground">Permite criar tarefas com um clique</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t space-y-4">
                      <div>
                        <FormLabel className="text-base font-semibold">Áudio & Transcrição</FormLabel>
                        <p className="text-sm text-muted-foreground mt-2">
                          Configure a gravação e transcrição de áudio
                        </p>
                      </div>

                      <div className="pt-2 border-t space-y-3">
                        <div className="flex items-start gap-2">
                          <input type="checkbox" defaultChecked className="mt-1" data-testid="checkbox-audio-gravacao" />
                          <div>
                            <p className="font-medium text-sm">Permitir gravação de áudio nas visitas</p>
                            <p className="text-xs text-muted-foreground">Os agentes podem gravar notas de áudio</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <input type="checkbox" defaultChecked className="mt-1" data-testid="checkbox-audio-transcracao" />
                          <div>
                            <p className="font-medium text-sm">Transcrição automática de áudio</p>
                            <p className="text-xs text-muted-foreground">Transcreve automaticamente para texto</p>
                          </div>
                        </div>

                        <div>
                          <FormLabel className="text-sm">Idioma preferencial da transcrição</FormLabel>
                          <Select defaultValue="pt-PT">
                            <SelectTrigger className="mt-2" data-testid="select-audio-language">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pt-PT">Português (Portugal)</SelectItem>
                              <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                              <SelectItem value="en-GB">English (UK)</SelectItem>
                              <SelectItem value="es-ES">Español</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* TAB 4: LOCALIZAÇÃO & PRIVACIDADE */}
                  <TabsContent value="localizacao" className="space-y-6 mt-6">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="mostrarGPS"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-mostrar-gps"
                              />
                            </FormControl>
                            <div className="space-y-1">
                              <FormLabel className="font-normal cursor-pointer">
                                Ativar funcionalidades de GPS nesta empresa
                              </FormLabel>
                              <p className="text-sm text-muted-foreground">
                                Permite rastrear a localização das visitas
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <div className="pt-6 border-t bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
                        <p className="font-medium text-sm flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Informações sobre Localização
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Se a localização estiver ativada, o sistema pode registar a posição aproximada ao marcar visitas como realizadas. Isto ajuda no acompanhamento e análise de padrões de visita. Os dados de localização são armazenados de forma privada e apenas acessíveis aos administradores da empresa.
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  {/* TAB 5: ALERTAS & UX */}
                  <TabsContent value="alertas" className="space-y-6 mt-6">
                    <div className="space-y-4">
                      <div>
                        <FormLabel className="text-base font-semibold">Alertas & Notificações</FormLabel>
                        <p className="text-sm text-muted-foreground mt-2">
                          Configure como os alertas são mostrados
                        </p>
                      </div>

                      <div className="pt-2 border-t space-y-3">
                        <div className="flex items-start gap-2">
                          <input type="checkbox" defaultChecked className="mt-1" data-testid="checkbox-alert-ribbon" />
                          <div>
                            <p className="font-medium text-sm">Mostrar barra de alertas nos dashboards</p>
                            <p className="text-xs text-muted-foreground">
                              Exibe tarefas em atraso e visitas de hoje em destaque
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <input type="checkbox" defaultChecked className="mt-1" data-testid="checkbox-badges-nav" />
                          <div>
                            <p className="font-medium text-sm">Mostrar badges na navegação</p>
                            <p className="text-xs text-muted-foreground">
                              Exibe contagens de tarefas pendentes e visitas de hoje
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t space-y-4">
                      <div>
                        <FormLabel>Intervalo de atualização dos indicadores</FormLabel>
                        <p className="text-sm text-muted-foreground mt-2">
                          Com que frequência os números são atualizados
                        </p>
                      </div>
                      <Select defaultValue="60">
                        <SelectTrigger data-testid="select-refresh-interval">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="60">1 minuto</SelectItem>
                          <SelectItem value="120">2 minutos</SelectItem>
                          <SelectItem value="300">5 minutos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  {/* TAB 6: INTEGRAÇÕES */}
                  <TabsContent value="integrações" className="space-y-6 mt-6">
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Sincronize dados com as suas aplicações favoritas
                      </p>

                      <div className="pt-4 border-t space-y-4">
                        <div className="flex items-start justify-between p-4 border rounded-lg">
                          <div className="space-y-1">
                            <p className="font-medium">Microsoft Outlook / 365</p>
                            <p className="text-sm text-muted-foreground">
                              Sincronize o seu calendário e tarefas
                            </p>
                          </div>
                          <Badge variant="outline">Desligado</Badge>
                        </div>

                        <div className="flex items-start justify-between p-4 border rounded-lg">
                          <div className="space-y-1">
                            <p className="font-medium">Microsoft Planner / To-Do</p>
                            <p className="text-sm text-muted-foreground">
                              Sincronize tarefas com o Planner
                            </p>
                          </div>
                          <Badge variant="outline">Desligado</Badge>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg">
                          <p className="text-sm font-medium">Mais integrações em breve</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Novas integrações estão a ser desenvolvidas. Contacte o suporte para saber mais.
                          </p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-submit-settings"
                  className="w-full mt-8"
                >
                  {updateMutation.isPending ? "Guardando..." : "Guardar Configurações"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
