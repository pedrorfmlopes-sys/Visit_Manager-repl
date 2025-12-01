import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Empresa, User, Marca } from "@shared/schema";
import { Upload, Building2, Bell, Zap, Lightbulb, MapPin, Calendar, PlugZap, Code, Mail, Map, Cloud, Webhook, Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AdminEntidadeTipos from "@/pages/AdminEntidadeTipos";
import AdminUsers from "@/pages/AdminUsers";
import AdminMarcas from "@/pages/AdminMarcas";
import { MicrosoftIntegrationCard } from "@/components/integrations/MicrosoftIntegrationCard";
import { GoogleIntegrationCard } from "@/components/integrations/GoogleIntegrationCard";
import { OdooCrmBlock } from "@/components/integrations/OdooCrmBlock";

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
  // FASE 31-IA-01: OpenAI API Key management
  iaOpenAIApiKey: z.string().optional().nullable(),
});

type UpdateEmpresaForm = z.infer<typeof updateEmpresaSchema>;

// Sections configuration
const SECTIONS = [
  { id: "empresa", label: "Empresa & Equipa", icon: Building2 },
  { id: "visitas", label: "Visitas & Tarefas", icon: Calendar },
  { id: "ia", label: "IA & Produtividade", icon: Lightbulb },
  { id: "alertas", label: "Alertas & Relatórios", icon: Bell },
  { id: "apis-keys", label: "APIs & Keys", icon: Code },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

export default function AdminEmpresa() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("empresa");
  // FASE 31-IA-01: Manage OpenAI API Key UI state
  const [showOpenAIKeyInput, setShowOpenAIKeyInput] = useState(false);
  const [openAIKeyValue, setOpenAIKeyValue] = useState("");
  
  const { data: empresa, isLoading, error } = useQuery<Empresa>({
    queryKey: ["/api/admin/empresa"],
  });

  // FASE CRM-LEADS-UI-TOGGLE-STEP1: Manage CRM Leads toggle state
  const [leadsEnabled, setLeadsEnabled] = useState<boolean>(false);
  const [savingLeads, setSavingLeads] = useState(false);

  // PROMPT 6: Manage 4 new Odoo Contacts flags state
  const [odooContactsFeatureEnabled, setOdooContactsFeatureEnabled] = useState<boolean>(false);
  const [odooContactsAdminEnabled, setOdooContactsAdminEnabled] = useState<boolean>(true);
  const [odooContactsAgentsEnabled, setOdooContactsAgentsEnabled] = useState<boolean>(false);
  const [crmVisitsOdooSyncEnabled, setCrmVisitsOdooSyncEnabled] = useState<boolean>(false);
  // PROMPT 10C: Manage Odoo Contacts no-permission message state
  const [odooContactsNoPermissionMessage, setOdooContactsNoPermissionMessage] = useState<string>("");
  const [savingOdooContacts, setSavingOdooContacts] = useState(false);

  // Update leadsEnabled state when empresa data changes
  useEffect(() => {
    if (empresa?.crmLeadsEnabled !== undefined) {
      setLeadsEnabled(empresa.crmLeadsEnabled);
    }
  }, [empresa?.crmLeadsEnabled]);

  // PROMPT 6: Load Odoo Contacts flags when empresa data changes
  useEffect(() => {
    if (empresa) {
      setOdooContactsFeatureEnabled((empresa as any).odooContactsFeatureEnabled ?? false);
      setOdooContactsAdminEnabled((empresa as any).odooContactsAdminEnabled ?? true);
      setOdooContactsAgentsEnabled((empresa as any).odooContactsAgentsEnabled ?? false);
      setCrmVisitsOdooSyncEnabled((empresa as any).crmVisitsOdooSyncEnabled ?? false);
      // PROMPT 10C: Load Odoo Contacts no-permission message
      setOdooContactsNoPermissionMessage((empresa as any).odooContactsNoPermissionMessage ?? "");
    }
  }, [empresa?.id]);

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
    mutationFn: (data: UpdateEmpresaForm) => {
      // FASE 31-IA-01: Include OpenAI API Key if provided
      const payload = { ...data };
      if (openAIKeyValue) {
        payload.iaOpenAIApiKey = openAIKeyValue;
      }
      return apiRequest("PATCH", "/api/admin/empresa", payload);
    },
    onSuccess: () => {
      toast({ title: "Configuração guardada com sucesso" });
      setOpenAIKeyValue(""); // Clear the input after successful save
      setShowOpenAIKeyInput(false);
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

  // FASE CRM-LEADS-UI-TOGGLE-STEP1: Handler for saving CRM Leads flag
  const handleSaveCrmLeadsFlag = async () => {
    try {
      setSavingLeads(true);

      const resp = await fetch("/api/admin/empresa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          crmLeadsEnabled: leadsEnabled,
        }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      toast({
        title: "Definições de Leads guardadas",
        description: leadsEnabled
          ? "Módulo de Leads está ativo para esta empresa."
          : "Módulo de Leads foi desativado.",
      });

      // Refresh data after successful save
      queryClient.invalidateQueries({ queryKey: ["/api/admin/empresa"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (error: any) {
      console.error("[Settings] Error saving CRM leads flag:", error);
      toast({
        title: "Erro ao guardar definições de Leads",
        description: "Verifica a ligação e tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setSavingLeads(false);
    }
  };

  // PROMPT 6: Handler for saving Odoo Contacts flags (all 4 together)
  const handleSaveOdooContactsFlags = async () => {
    try {
      setSavingOdooContacts(true);

      const resp = await fetch("/api/admin/empresa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          odooCrmEnabled: empresa?.odooCrmEnabled ?? true,
          crmLeadsEnabled: leadsEnabled,
          odooContactsFeatureEnabled,
          odooContactsAdminEnabled,
          odooContactsAgentsEnabled,
          odooContactsNoPermissionMessage,
          crmVisitsOdooSyncEnabled,
        }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      toast({
        title: "Configurações de Odoo Contacts guardadas",
        description: odooContactsFeatureEnabled
          ? "Integração de contactos Odoo está ativa."
          : "Integração de contactos Odoo foi desativada.",
      });

      // Refresh data after successful save
      queryClient.invalidateQueries({ queryKey: ["/api/admin/empresa"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (error: any) {
      console.error("[Settings] Error saving Odoo Contacts flags:", error);
      toast({
        title: "Erro ao guardar definições de Odoo Contacts",
        description: "Verifica a ligação e tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setSavingOdooContacts(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.type)) {
      toast({
        title: "Tipo de ficheiro inválido",
        description: "Use PNG, JPG, SVG ou WebP",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

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
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/empresa"] });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar logo",
        description: error.message,
        variant: "destructive",
      });
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

  const handleSectionClick = (sectionId: SectionId) => {
    setActiveSection(sectionId);
  };

  // ✅ RENDERIZAÇÃO CONDICIONAL - APENAS UMA SECÇÃO ATIVA
  const renderCurrentSection = () => {
    switch (activeSection) {
      case "empresa":
        return renderEmpresaSection();
      case "visitas":
        return renderVisitasSection();
      case "ia":
        return renderIaSection();
      case "alertas":
        return renderAlertasSection();
      case "apis-keys":
        return renderApisKeysSection();
      default:
        return renderEmpresaSection();
    }
  };

  // SECÇÃO: EMPRESA & EQUIPA
  const renderEmpresaSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Empresa & Equipa</h3>
        
        <Tabs defaultValue="geral" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="geral" data-testid="tab-empresa-geral">Geral</TabsTrigger>
            <TabsTrigger value="marcas-entidades" data-testid="tab-empresa-marcas">Marcas &amp; Entidades</TabsTrigger>
            <TabsTrigger value="utilizadores" data-testid="tab-empresa-utilizadores">Utilizadores</TabsTrigger>
          </TabsList>

          {/* Geral */}
          <TabsContent value="geral" className="space-y-6 mt-6">
            <div className="space-y-4">
              <h4 className="font-semibold">Informações Gerais</h4>
              
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
              <h4 className="font-semibold">Tema & Logo</h4>

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

          {/* Marcas & Entidades */}
          <TabsContent value="marcas-entidades" className="space-y-6 mt-6">
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-4">Gestão de Marcas</h4>
                <AdminMarcas />
              </div>
              
              <div className="pt-6 border-t">
                <h4 className="font-semibold mb-4">Tipos de Entidade</h4>
                <AdminEntidadeTipos />
              </div>
            </div>
          </TabsContent>

          {/* Utilizadores */}
          <TabsContent value="utilizadores" className="mt-6">
            <AdminUsers />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );

  // SECÇÃO: VISITAS & TAREFAS
  const renderVisitasSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Visitas & Tarefas</h3>
        
        <Tabs defaultValue="comportamento" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="comportamento" data-testid="tab-visitas-comportamento">Comportamento</TabsTrigger>
            <TabsTrigger value="filtros" data-testid="tab-visitas-filtros">Filtros & Listas</TabsTrigger>
          </TabsList>

          {/* Comportamento */}
          <TabsContent value="comportamento" className="space-y-6 mt-6">
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

              <FormField
                control={form.control}
                name="uiSettings.visitas.multiContactosEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value as boolean}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-multi-contactos"
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="font-normal cursor-pointer">
                        Permitir vários contactos por visita
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Se ligado, cada visita pode ter vários contactos associados. Se desligado, cada visita terá apenas um contacto.
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
            </div>
          </TabsContent>

          {/* Filtros */}
          <TabsContent value="filtros" className="space-y-6 mt-6">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure quais filtros estão disponíveis em cada módulo
              </p>

              <Tabs defaultValue="visitas-filter" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="entidades-filter" data-testid="tab-filter-entidades">Entidades</TabsTrigger>
                  <TabsTrigger value="contactos-filter" data-testid="tab-filter-contactos">Contactos</TabsTrigger>
                  <TabsTrigger value="visitas-filter" data-testid="tab-filter-visitas">Visitas</TabsTrigger>
                  <TabsTrigger value="tarefas-filter" data-testid="tab-filter-tarefas">Tarefas</TabsTrigger>
                </TabsList>

                {/* Entidades Filters */}
                <TabsContent value="entidades-filter" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="uiSettings.entidades.enableFilterTipoEntidade"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-tipo-entidade" />
                          </FormControl>
                          <div>
                            <FormLabel>Filtro por Tipo de Entidade</FormLabel>
                            <p className="text-xs text-muted-foreground">Permite filtrar por tipos configurados</p>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uiSettings.entidades.enableFilterSearch"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-search-entidades" />
                          </FormControl>
                          <div>
                            <FormLabel>Pesquisa por Nome</FormLabel>
                            <p className="text-xs text-muted-foreground">Filtro de pesquisa rápida</p>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* Contactos Filters */}
                <TabsContent value="contactos-filter" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="uiSettings.contactos.enableFilterEntidade"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-entidade-contacto" />
                          </FormControl>
                          <div>
                            <FormLabel>Filtro por Entidade</FormLabel>
                            <p className="text-xs text-muted-foreground">Filtrar contactos por entidade associada</p>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uiSettings.contactos.enableFilterCargo"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-cargo" />
                          </FormControl>
                          <div>
                            <FormLabel>Filtro por Cargo</FormLabel>
                            <p className="text-xs text-muted-foreground">Filtrar por função/cargo</p>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uiSettings.contactos.enableFilterSearch"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-search-contactos" />
                          </FormControl>
                          <div>
                            <FormLabel>Pesquisa por Nome</FormLabel>
                            <p className="text-xs text-muted-foreground">Filtro de pesquisa rápida</p>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* Visitas Filters */}
                <TabsContent value="visitas-filter" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="uiSettings.visitas.enableFilterDateQuick"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-date-quick" />
                          </FormControl>
                          <div>
                            <FormLabel>Filtro Datas (Hoje / Semana / 30 dias)</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uiSettings.visitas.enableFilterUser"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-user-visitas" />
                          </FormControl>
                          <div>
                            <FormLabel>Filtro por Utilizador</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uiSettings.visitas.enableFilterMarca"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-marca-visitas" />
                          </FormControl>
                          <div>
                            <FormLabel>Filtro por Marca</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uiSettings.visitas.enableFilterEntidade"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-entidade-visitas" />
                          </FormControl>
                          <div>
                            <FormLabel>Filtro por Entidade</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uiSettings.visitas.enableFilterContacto"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-contacto-visitas" />
                          </FormControl>
                          <div>
                            <FormLabel>Filtro por Contacto</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uiSettings.visitas.enableFilterHasAudio"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-audio-visitas" />
                          </FormControl>
                          <div>
                            <FormLabel>Filtro por Áudio (Com áudio por transcrever)</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* Tarefas Filters */}
                <TabsContent value="tarefas-filter" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="uiSettings.tarefas.enableFilterStatus"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-status-tarefas" />
                          </FormControl>
                          <div>
                            <FormLabel>Filtro por Status</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uiSettings.tarefas.enableFilterOverdue"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-overdue" />
                          </FormControl>
                          <div>
                            <FormLabel>Filtro Tarefas em Atraso</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uiSettings.tarefas.enableFilterAssignedUser"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-assigned-user" />
                          </FormControl>
                          <div>
                            <FormLabel>Filtro por Utilizador Atribuído</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uiSettings.tarefas.enableFilterEntidade"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-entidade-tarefas" />
                          </FormControl>
                          <div>
                            <FormLabel>Filtro por Entidade</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uiSettings.tarefas.enableFilterVisita"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} data-testid="checkbox-filter-visita-tarefas" />
                          </FormControl>
                          <div>
                            <FormLabel>Filtro por Visita</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );

  // SECÇÃO: IA & PRODUTIVIDADE
  const renderIaSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">IA & Produtividade</h3>
        
        <Tabs defaultValue="ia-visitas" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ia-visitas" data-testid="tab-ia-visitas">IA de Visitas</TabsTrigger>
            <TabsTrigger value="audio" data-testid="tab-ia-audio">Áudio & Transcrição</TabsTrigger>
          </TabsList>

          {/* IA de Visitas */}
          <TabsContent value="ia-visitas" className="space-y-6 mt-6">
            {/* FASE 31-IA-01: IA Configuration - Enable/Disable and Key Management */}
            <FormField
              control={form.control}
              name="uiSettings"
              render={({ field }) => {
                const uiSettings = field.value || {};
                const iaSettings = uiSettings.ia || { aiEnabled: true, aiKeyMode: "global" };
                const hasOwnKey = (empresa?.uiSettings as any)?.ia?.hasOwnOpenAIApiKey ?? false;
                return (
                  <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-900/50">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Zap className="w-4 h-4 text-blue-600" />
                        Configuração de IA
                      </CardTitle>
                      <CardDescription>Gerencie as definições de inteligência artificial para a sua empresa</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Toggle IA Enable/Disable */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <FormLabel className="text-sm font-semibold">Ativar IA para esta empresa</FormLabel>
                            <p className="text-xs text-muted-foreground mt-1">Quando desativado, nenhuma chamada de IA será feita</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              field.onChange({
                                ...uiSettings,
                                ia: { ...iaSettings, aiEnabled: !iaSettings.aiEnabled }
                              });
                            }}
                            className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                              iaSettings.aiEnabled
                                ? "bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100"
                                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                            }`}
                            data-testid="button-toggle-ia-enabled"
                          >
                            {iaSettings.aiEnabled ? "Ativado" : "Desativado"}
                          </button>
                        </div>
                      </div>

                      {/* AI Key Mode Selection */}
                      {iaSettings.aiEnabled && (
                        <div className="space-y-3 pt-4 border-t">
                          <div>
                            <FormLabel className="text-sm font-semibold">Modo de chave de IA</FormLabel>
                            <p className="text-xs text-muted-foreground mt-1">Escolha onde vem a chave de API da OpenAI</p>
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors" 
                              style={{
                                borderColor: iaSettings.aiKeyMode === "global" ? "rgb(59, 130, 246)" : "rgb(209, 213, 219)",
                                backgroundColor: iaSettings.aiKeyMode === "global" ? "rgba(59, 130, 246, 0.05)" : "transparent"
                              }}>
                              <input
                                type="radio"
                                name="aiKeyMode"
                                value="global"
                                checked={iaSettings.aiKeyMode === "global"}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    field.onChange({
                                      ...uiSettings,
                                      ia: { ...iaSettings, aiKeyMode: "global" }
                                    });
                                  }
                                }}
                                className="mt-1"
                                data-testid="radio-key-mode-global"
                              />
                              <div>
                                <p className="font-medium text-sm">Usar chave global do Visit Manager</p>
                                <p className="text-xs text-muted-foreground">Usa a chave de API partilhada da aplicação</p>
                              </div>
                            </label>
                            <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors"
                              style={{
                                borderColor: iaSettings.aiKeyMode === "own" ? "rgb(59, 130, 246)" : "rgb(209, 213, 219)",
                                backgroundColor: iaSettings.aiKeyMode === "own" ? "rgba(59, 130, 246, 0.05)" : "transparent"
                              }}>
                              <input
                                type="radio"
                                name="aiKeyMode"
                                value="own"
                                checked={iaSettings.aiKeyMode === "own"}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    field.onChange({
                                      ...uiSettings,
                                      ia: { ...iaSettings, aiKeyMode: "own" }
                                    });
                                  }
                                }}
                                className="mt-1"
                                data-testid="radio-key-mode-own"
                              />
                              <div>
                                <p className="font-medium text-sm">Usar chave própria desta empresa</p>
                                <p className="text-xs text-muted-foreground">Introduza a chave de API da OpenAI da sua empresa</p>
                              </div>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* OpenAI API Key Management */}
                      {iaSettings.aiEnabled && iaSettings.aiKeyMode === "own" && (
                        <div className="space-y-3 pt-4 border-t">
                          <div>
                            <FormLabel className="text-sm font-semibold">OpenAI API Key</FormLabel>
                            <p className="text-xs text-muted-foreground mt-1">Esta chave será usada apenas para esta empresa</p>
                          </div>
                          
                          {hasOwnKey && !showOpenAIKeyInput ? (
                            <div className="space-y-2">
                              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded-lg p-3">
                                <p className="text-sm font-medium text-green-700 dark:text-green-300">✓ Chave própria configurada</p>
                                <p className="text-xs text-green-600 dark:text-green-400 mt-1">A chave está armazenada com segurança</p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowOpenAIKeyInput(true)}
                                data-testid="button-replace-openai-key"
                              >
                                Substituir chave
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setOpenAIKeyValue(""); // Empty string signals to remove the key
                                  form.handleSubmit((data) => {
                                    updateMutation.mutate(data);
                                  })();
                                }}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 hover:dark:text-red-300"
                                data-testid="button-remove-openai-key"
                              >
                                Remover chave
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Input
                                type="password"
                                placeholder={hasOwnKey ? "Deixe em branco para manter a chave atual" : "Cole a sua chave sk-..."}
                                value={openAIKeyValue}
                                onChange={(e) => setOpenAIKeyValue(e.target.value)}
                                data-testid="input-openai-api-key"
                                className="font-mono text-sm"
                              />
                              <p className="text-xs text-muted-foreground">Chaves começam com sk-</p>
                              {showOpenAIKeyInput && hasOwnKey && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setShowOpenAIKeyInput(false);
                                    setOpenAIKeyValue("");
                                  }}
                                  data-testid="button-cancel-replace-key"
                                >
                                  Cancelar
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              }}
            />

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

            <div className="space-y-4 pt-6 border-t">
              <div>
                <FormLabel className="text-base font-semibold">IA - Resumos e Sugestões</FormLabel>
                <p className="text-sm text-muted-foreground mt-2">
                  Controle a utilização de inteligência artificial nas suas visitas
                </p>
              </div>

              <div className="space-y-3">
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
          </TabsContent>

          {/* Áudio & Transcrição */}
          <TabsContent value="audio" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div>
                <FormLabel className="text-base font-semibold">Áudio & Transcrição</FormLabel>
                <p className="text-sm text-muted-foreground mt-2">
                  Configure a gravação e transcrição de áudio
                </p>
              </div>

              <div className="space-y-3">
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
        </Tabs>
      </div>
    </div>
  );

  // SECÇÃO: ALERTAS & RELATÓRIOS
  const renderAlertasSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Alertas & Relatórios</h3>
        
        <Tabs defaultValue="alertas-ux" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="alertas-ux" data-testid="tab-alertas-ux">Alertas & UX</TabsTrigger>
            <TabsTrigger value="gps" data-testid="tab-alertas-gps">Localização</TabsTrigger>
          </TabsList>

          {/* Alertas */}
          <TabsContent value="alertas-ux" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div>
                <FormLabel className="text-base font-semibold">Alertas & Notificações</FormLabel>
                <p className="text-sm text-muted-foreground mt-2">
                  Configure como os alertas são mostrados
                </p>
              </div>

              <div className="space-y-3">
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

              <div className="pt-4 border-t space-y-4">
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
            </div>
          </TabsContent>

          {/* Localização */}
          <TabsContent value="gps" className="space-y-6 mt-6">
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
        </Tabs>
      </div>
    </div>
  );

  // SECÇÃO: APIs & KEYS - INTEG-01
  // Resumo de configurações de IA e placeholders para outras integrações
  const renderApisKeysSection = () => {
    const iaSettings = empresa?.uiSettings?.ia || { aiEnabled: true, aiKeyMode: "global" };
    const hasOwnKey = iaSettings.hasOwnOpenAIApiKey ?? false;
    
    const getIaStatus = () => {
      if (!iaSettings.aiEnabled) return "IA desativada para esta empresa";
      return "IA ativa para esta empresa";
    };
    
    const getIaKeyMode = () => {
      if (iaSettings.aiKeyMode === "own") {
        return hasOwnKey 
          ? "Modo: Chave própria da empresa (chave configurada)"
          : "Modo: Chave própria da empresa (nenhuma chave configurada)";
      }
      return "Modo: Chave global do Visit Manager";
    };
    
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">APIs & Integrações Externas</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Gerencie todas as integrações externas e configurações de API da sua empresa. Aqui pode centralizar as chaves de acesso e os modos de funcionamento de cada serviço.
          </p>
        </div>

        {/* IA Summary Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              Inteligência Artificial (IA)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Estado da IA</p>
                <p className="text-sm text-muted-foreground mt-1">{getIaStatus()}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium">Configuração de Chave</p>
                <p className="text-sm text-muted-foreground mt-1">{getIaKeyMode()}</p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveSection("ia")}
                data-testid="button-manage-ia-audio"
                className="mt-2"
              >
                Gerir IA & Áudio
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Placeholder Integrations */}
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Integrações</h4>
          
          {/* Microsoft 365 - Active Integration */}
          <MicrosoftIntegrationCard />

          {/* Google Workspace - Active Integration */}
          <GoogleIntegrationCard />

          {/* CRMs - Card Parent with Odoo Sub-Card */}
          <Card data-testid="card-crms-integrations">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-blue-600" />
                CRMs
              </CardTitle>
              <CardDescription>
                Configura e ativa as integrações com sistemas CRM (Odoo, Leads, e outros no futuro).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Odoo CRM Sub-Card */}
              <OdooCrmBlock empresa={empresa} />

              {/* FASE CRM-LEADS-UI-TOGGLE-STEP1: Módulo de Leads CRM Toggle */}
              <div className="border rounded-lg p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Módulo de Leads CRM</div>
                  <p className="text-xs text-muted-foreground">
                    Quando ativo, permite criar e gerir leads na app e integrá-los com o CRM.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {leadsEnabled ? "Ativo" : "Inativo"}
                  </span>
                  <Switch
                    checked={leadsEnabled}
                    onCheckedChange={setLeadsEnabled}
                    data-testid="toggle-crm-leads-enabled"
                  />
                </div>
              </div>

              {/* PROMPT 6: Odoo Contacts 3-Tier RBAC Section */}
              <div className="space-y-3 border-t pt-4">
                <h4 className="text-sm font-semibold">Integração de Contactos Odoo</h4>
                
                {/* Toggle 1: Feature Gate */}
                <div className="border rounded-lg p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">Ativar integração de contactos com Odoo</div>
                    <p className="text-xs text-muted-foreground">
                      Quando ativo, permite sincronizar contactos com Odoo CRM.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {odooContactsFeatureEnabled ? "Ativo" : "Inativo"}
                    </span>
                    <Switch
                      checked={odooContactsFeatureEnabled}
                      onCheckedChange={setOdooContactsFeatureEnabled}
                      data-testid="toggle-odoo-contacts-feature-enabled"
                    />
                  </div>
                </div>

                {/* Toggle 2: Admin Level (visible if feature is enabled) */}
                {odooContactsFeatureEnabled && (
                  <div className="border rounded-lg p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">Permitir integração de contactos Odoo para administradores</div>
                      <p className="text-xs text-muted-foreground">
                        Os administradores podem sincronizar contactos.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {odooContactsAdminEnabled ? "Ativo" : "Inativo"}
                      </span>
                      <Switch
                        checked={odooContactsAdminEnabled}
                        onCheckedChange={setOdooContactsAdminEnabled}
                        data-testid="toggle-odoo-contacts-admin-enabled"
                      />
                    </div>
                  </div>
                )}

                {/* Toggle 3: Agent Level (visible if feature and admin are enabled) */}
                {odooContactsFeatureEnabled && odooContactsAdminEnabled && (
                  <div className="border rounded-lg p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">Permitir integração de contactos Odoo para utilizadores</div>
                      <p className="text-xs text-muted-foreground">
                        Os utilizadores (agentes) podem sincronizar contactos.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {odooContactsAgentsEnabled ? "Ativo" : "Inativo"}
                      </span>
                      <Switch
                        checked={odooContactsAgentsEnabled}
                        onCheckedChange={setOdooContactsAgentsEnabled}
                        data-testid="toggle-odoo-contacts-agents-enabled"
                      />
                    </div>
                  </div>
                )}

                {/* PROMPT 10C: Textarea for no-permission message (visible only when feature and admin enabled, but agents disabled) */}
                {odooContactsFeatureEnabled &&
                  odooContactsAdminEnabled &&
                  !odooContactsAgentsEnabled && (
                    <div className="space-y-2 mt-4 border-t pt-3">
                      <Label htmlFor="odoo-no-permission-msg">
                        Mensagem para utilizadores sem permissão de contactos Odoo
                      </Label>
                      <Textarea
                        id="odoo-no-permission-msg"
                        value={odooContactsNoPermissionMessage}
                        onChange={(e) =>
                          setOdooContactsNoPermissionMessage(e.target.value)
                        }
                        placeholder="Ex.: Para criar contactos no Odoo, envia um pedido para crm@empresa.com ou abre um ticket no sistema interno."
                        data-testid="textarea-odoo-no-permission-message"
                      />
                      <p className="text-xs text-muted-foreground">
                        Esta mensagem será mostrada aos utilizadores que não têm
                        permissão para criar/ligar contactos no Odoo.
                      </p>
                    </div>
                  )}

                {/* Toggle 4: Sync Visitas (visible if CRM and feature are enabled) */}
                {empresa?.odooCrmEnabled && odooContactsFeatureEnabled && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">Sincronização de visitas</p>
                    <div className="border rounded-lg p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium">Permitir sincronização de visitas com contactos Odoo</div>
                        <p className="text-xs text-muted-foreground">
                          Sincroniza automaticamente dados de visitas para Odoo.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {crmVisitsOdooSyncEnabled ? "Ativo" : "Inativo"}
                        </span>
                        <Switch
                          checked={crmVisitsOdooSyncEnabled}
                          onCheckedChange={setCrmVisitsOdooSyncEnabled}
                          data-testid="toggle-crm-visits-odoo-sync-enabled"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  size="sm"
                  onClick={handleSaveCrmLeadsFlag}
                  disabled={savingLeads}
                  data-testid="button-save-crm-leads"
                >
                  {savingLeads ? "A guardar..." : "Guardar definições de Leads"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveOdooContactsFlags}
                  disabled={savingOdooContacts}
                  data-testid="button-save-odoo-contacts"
                >
                  {savingOdooContacts ? "A guardar..." : "Guardar definições de Odoo"}
                </Button>
              </div>
              
              {/* Placeholder for future CRM integrations */}
              <div className="text-xs text-muted-foreground border-t pt-4">
                Mais integrações CRM em breve...
              </div>
            </CardContent>
          </Card>

          {/* Email & Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-red-600" />
                Email & Notificações
              </CardTitle>
              <CardDescription>SMTP, SendGrid, Mailgun, SMS e WhatsApp</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Futura integração com provedores de email (SendGrid, Mailgun, Postmark) e SMS/WhatsApp para comunicações em tempo real.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Estado</span>
                <Badge variant="secondary">Planeado</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Maps & Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="w-5 h-5 text-green-600" />
                Mapas & Localização
              </CardTitle>
              <CardDescription>Google Maps, Mapbox, OpenStreetMap</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Suporte planeado para diferentes provedores de mapas e serviços de geocoding avançado.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Estado</span>
                <Badge variant="secondary">Planeado</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Storage & Webhooks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-purple-600" />
                Storage & Webhooks
              </CardTitle>
              <CardDescription>S3, Azure, Google Cloud, Webhooks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Futuro suporte para storage externo (AWS S3, Azure Blob, Google Cloud) e webhooks para integração com sistemas internos da empresa.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Estado</span>
                <Badge variant="secondary">Planeado</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-32 pt-4">
      <div className="max-w-6xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-admin-settings-title">Definições</CardTitle>
            <CardDescription>Gerencie as definições da sua empresa</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
                
                {/* ✅ Section Navigation Bar */}
                <div className="flex gap-2 pb-4 border-b overflow-x-auto">
                  {SECTIONS.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => handleSectionClick(section.id)}
                        data-testid={`button-section-${section.id}`}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {section.label}
                      </button>
                    );
                  })}
                </div>

                {/* ✅ RENDER ONLY ACTIVE SECTION (SWITCH STATEMENT) */}
                {renderCurrentSection()}

                {/* Save Button */}
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
