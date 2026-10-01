import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DatabaseZap } from "lucide-react";
import type { Empresa } from "@shared/schema";
import OdooLogo from "@/assets/crm/odoo.svg";

interface OdooStatus {
  configured: boolean;
  baseUrl?: string;
  dbName?: string;
  username?: string;
  environment?: string;
  isActive?: boolean;
}

type OdooUiSettings = {
  leadTypeFieldName?: string | null;
  leadTypeFieldVerified?: boolean;
  leadTypeFieldLabel?: string | null;
  leadTypeFieldType?: string | null;
  leadTypeFieldVerifiedAt?: string | null;
  leadTypeFieldOptions?: Array<{ value: string; label: string }> | null;
};

export function OdooCrmBlock({ empresa }: { empresa?: Empresa }) {
  const { toast } = useToast();

  const { data, isLoading, error, refetch } = useQuery<OdooStatus>({
    queryKey: ["/api/integrations/odoo/status"],
    gcTime: 0,
  });

  const [baseUrl, setBaseUrl] = useState("");
  const [dbName, setDbName] = useState("");
  const [username, setUsername] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [environment, setEnvironment] = useState<"test" | "production">("test");
  const [isActive, setIsActive] = useState(true);
  const [odooEnabled, setOdooEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [leadTypeFieldName, setLeadTypeFieldName] = useState("");
  const [leadTypeFieldVerified, setLeadTypeFieldVerified] = useState(false);
  const [leadTypeFieldLabel, setLeadTypeFieldLabel] = useState<string | null>(null);
  const [leadTypeFieldType, setLeadTypeFieldType] = useState<string | null>(null);
  const [leadTypeFieldOptions, setLeadTypeFieldOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [isVerifyingLeadTypeField, setIsVerifyingLeadTypeField] = useState(false);

  // Fill form with existing data
  useEffect(() => {
    if (data && data.configured) {
      setBaseUrl(data.baseUrl ?? "");
      setDbName(data.dbName ?? "");
      setUsername(data.username ?? "");
      setEnvironment((data.environment as "test" | "production") || "test");
      setIsActive(data.isActive ?? true);
    }
  }, [data]);

  // Initialize odooEnabled from empresa
  useEffect(() => {
    if (empresa?.odooCrmEnabled !== undefined) {
      setOdooEnabled(empresa.odooCrmEnabled);
    }
  }, [empresa?.odooCrmEnabled]);

  useEffect(() => {
    const odooSettings = ((empresa?.uiSettings as any)?.odoo ?? {}) as OdooUiSettings;
    setLeadTypeFieldName(odooSettings.leadTypeFieldName ?? "");
    setLeadTypeFieldVerified(odooSettings.leadTypeFieldVerified === true);
    setLeadTypeFieldLabel(odooSettings.leadTypeFieldLabel ?? null);
    setLeadTypeFieldType(odooSettings.leadTypeFieldType ?? null);
    setLeadTypeFieldOptions(
      Array.isArray(odooSettings.leadTypeFieldOptions)
        ? odooSettings.leadTypeFieldOptions.filter(
            (option): option is { value: string; label: string } =>
              typeof option?.value === "string" && typeof option?.label === "string"
          )
        : []
    );
  }, [empresa?.uiSettings]);

  const handleLeadTypeFieldChange = (value: string) => {
    setLeadTypeFieldName(value);
    setLeadTypeFieldVerified(false);
    setLeadTypeFieldLabel(null);
    setLeadTypeFieldType(null);
    setLeadTypeFieldOptions([]);
  };

  const persistLeadTypeFieldConfig = async (config: {
    fieldName: string | null;
    verified: boolean;
    label: string | null;
    type: string | null;
    options: Array<{ value: string; label: string }>;
  }) => {
    const response = await fetch("/api/admin/empresa", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        uiSettings: {
          ...((empresa?.uiSettings as any) ?? {}),
          odoo: {
            ...(((empresa?.uiSettings as any)?.odoo ?? {}) as Record<string, any>),
            leadTypeFieldName: config.fieldName,
            leadTypeFieldVerified: config.verified,
            leadTypeFieldLabel: config.label,
            leadTypeFieldType: config.type,
            leadTypeFieldOptions: config.options,
            leadTypeFieldVerifiedAt:
              config.fieldName && config.verified ? new Date().toISOString() : null,
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.message ?? "Não foi possível guardar a configuração do campo Odoo.");
    }
  };

  const handleVerifyLeadTypeField = async () => {
    const trimmedFieldName = leadTypeFieldName.trim();

    if (!trimmedFieldName) {
      toast({
        title: "Campo em falta",
        description: "Preenche o nome do campo custom do Odoo para validar.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsVerifyingLeadTypeField(true);

      const response = await fetch("/api/integrations/odoo/verify-lead-type-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fieldName: trimmedFieldName }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.verified !== true) {
        throw new Error(body?.message ?? "Não foi possível validar o campo no Odoo.");
      }

      setLeadTypeFieldName(body.fieldName ?? trimmedFieldName);
      setLeadTypeFieldVerified(true);
      setLeadTypeFieldLabel(body.label ?? null);
      setLeadTypeFieldType(body.type ?? null);
      setLeadTypeFieldOptions(Array.isArray(body.selectionOptions) ? body.selectionOptions : []);

      await persistLeadTypeFieldConfig({
        fieldName: body.fieldName ?? trimmedFieldName,
        verified: true,
        label: body.label ?? null,
        type: body.type ?? null,
        options: Array.isArray(body.selectionOptions) ? body.selectionOptions : [],
      });

      toast({
        title: "Campo validado",
        description: `O campo ${body.fieldName ?? trimmedFieldName} existe no modelo de Leads do Odoo.`,
      });
    } catch (error) {
      setLeadTypeFieldVerified(false);
      setLeadTypeFieldLabel(null);
      setLeadTypeFieldType(null);
      setLeadTypeFieldOptions([]);
      toast({
        title: "Validação falhou",
        description: (error as any)?.message ?? "Não foi possível validar o campo no Odoo.",
        variant: "destructive",
      });
    } finally {
      setIsVerifyingLeadTypeField(false);
    }
  };

  const handleSaveOdooConfigAndFlag = async () => {
    try {
      if (!baseUrl || !dbName || !username || !apiKey) {
        toast({
          title: "Dados em falta",
          description: "Preenche URL, base de dados, utilizador e API Key.",
          variant: "destructive",
        });
        return;
      }

      const trimmedLeadTypeFieldName = leadTypeFieldName.trim();
      if (trimmedLeadTypeFieldName && !leadTypeFieldVerified) {
        toast({
          title: "Campo por validar",
          description: "Valida primeiro o campo custom de Tipo de Lead no Odoo antes de guardar.",
          variant: "destructive",
        });
        return;
      }

      setIsSaving(true);

      // 1) Save Odoo config to odoo_connections
      const odooResponse = await fetch("/api/integrations/odoo/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          dbName,
          username,
          apiKey,
          environment,
          isActive,
        }),
      });

      if (!odooResponse.ok) {
        const errorBody = await odooResponse.json().catch(() => ({}));
        throw new Error(errorBody?.message ?? "Erro ao guardar configuração Odoo");
      }

      // 2) Update empresa with odooCrmEnabled flag
      const empresaResponse = await fetch("/api/admin/empresa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          odooCrmEnabled: odooEnabled,
          uiSettings: {
            ...((empresa?.uiSettings as any) ?? {}),
            odoo: {
              ...(((empresa?.uiSettings as any)?.odoo ?? {}) as Record<string, any>),
              leadTypeFieldName: trimmedLeadTypeFieldName || null,
              leadTypeFieldVerified: trimmedLeadTypeFieldName ? leadTypeFieldVerified : false,
              leadTypeFieldLabel: trimmedLeadTypeFieldName ? leadTypeFieldLabel : null,
              leadTypeFieldType: trimmedLeadTypeFieldName ? leadTypeFieldType : null,
              leadTypeFieldOptions: trimmedLeadTypeFieldName ? leadTypeFieldOptions : [],
              leadTypeFieldVerifiedAt:
                trimmedLeadTypeFieldName && leadTypeFieldVerified
                  ? new Date().toISOString()
                  : null,
            },
          },
        }),
      });

      if (!empresaResponse.ok) {
        const errorBody = await empresaResponse.json().catch(() => ({}));
        throw new Error(errorBody?.message ?? "Erro ao atualizar flag Odoo");
      }

      toast({
        title: "Configuração Odoo guardada",
        description: odooEnabled
          ? "Integração Odoo está ativa para esta empresa."
          : "Integração Odoo foi desativada.",
      });

      setApiKey(""); // Clear API key after save
      await refetch();
    } catch (error) {
      console.error("[Settings] Error saving Odoo CRM config:", error);
      toast({
        title: "Erro ao guardar configuração Odoo",
        description: (error as any)?.message || "Verifica os dados e tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderStatus = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>A verificar configuração Odoo…</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col gap-2 text-sm text-destructive">
          <span>Erro ao obter estado da integração Odoo.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-retry-odoo-status"
          >
            Tentar novamente
          </Button>
        </div>
      );
    }

    if (!data || !data.configured) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">Não configurado</Badge>
          <span>Define abaixo os dados da tua instância Odoo.</span>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={data.isActive ? "default" : "outline"} data-testid="badge-odoo-status">
          {data.isActive ? "Ativo" : "Inativo"}
        </Badge>
        {data.baseUrl && <span data-testid="text-odoo-base-url">{data.baseUrl}</span>}
        {data.dbName && (
          <span className="text-xs text-muted-foreground" data-testid="text-odoo-db-name">
            BD: {data.dbName}
          </span>
        )}
        {data.username && (
          <span className="text-xs text-muted-foreground" data-testid="text-odoo-username">
            User: {data.username}
          </span>
        )}
        {data.environment && (
          <span className="text-xs uppercase tracking-wide" data-testid="text-odoo-environment">
            Ambiente: {data.environment}
          </span>
        )}
      </div>
    );
  };

  return (
    <Card className="border border-slate-200" data-testid="card-odoo-crm-block">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <img src={OdooLogo} alt="Odoo" className="h-4 w-auto" />
            <span>Odoo CRM</span>
            <Badge variant="outline">Odoo</Badge>
          </CardTitle>
          <CardDescription className="text-xs">Integração com o Odoo CRM para esta empresa.</CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{odooEnabled ? "Ativo" : "Inativo"}</span>
          <Switch
            checked={odooEnabled}
            onCheckedChange={setOdooEnabled}
            data-testid="toggle-odoo-crm-enabled"
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderStatus()}

        <div className="grid gap-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="odoo-base-url">URL da instância Odoo</Label>
            <Input
              id="odoo-base-url"
              placeholder="https://a-tua-instancia.odoo.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              data-testid="input-odoo-base-url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="odoo-db-name">Nome da base de dados</Label>
            <Input
              id="odoo-db-name"
              placeholder="ex: odoo_test_123"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              data-testid="input-odoo-db-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="odoo-username">Utilizador Odoo</Label>
            <Input
              id="odoo-username"
              placeholder="o_teu_email_no_odoo@example.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              data-testid="input-odoo-username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="odoo-api-key">API Key Odoo</Label>
            <Input
              id="odoo-api-key"
              type="password"
              placeholder="Introduz a tua API Key do Odoo"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              data-testid="input-odoo-api-key"
            />
            <p className="text-xs text-muted-foreground">
              A API Key é guardada de forma segura e não será mostrada novamente depois de guardares.
            </p>
          </div>

          <div className="space-y-2 rounded-md border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label htmlFor="odoo-lead-type-field">Campo custom Odoo para Tipo de Lead</Label>
                <p className="text-xs text-muted-foreground">
                  Opcional. Se deixares vazio, o Tipo de Lead fica apenas dentro da app.
                </p>
              </div>
              <Badge variant={leadTypeFieldVerified ? "default" : "outline"}>
                {leadTypeFieldVerified ? "Validado" : "Por validar"}
              </Badge>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="odoo-lead-type-field"
                placeholder="x_studio_tipo_de_lead"
                value={leadTypeFieldName}
                onChange={(e) => handleLeadTypeFieldChange(e.target.value)}
                data-testid="input-odoo-lead-type-field"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleVerifyLeadTypeField}
                disabled={isVerifyingLeadTypeField || !leadTypeFieldName.trim()}
                data-testid="button-verify-odoo-lead-type-field"
              >
                {isVerifyingLeadTypeField && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Validar campo
              </Button>
            </div>

            {(leadTypeFieldLabel || leadTypeFieldType) && (
              <p className="text-xs text-muted-foreground">
                {leadTypeFieldLabel ? `Label: ${leadTypeFieldLabel}` : "Campo encontrado"}
                {leadTypeFieldType ? ` | Tipo: ${leadTypeFieldType}` : ""}
              </p>
            )}

            {leadTypeFieldType === "selection" && leadTypeFieldOptions.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Opções detetadas: {leadTypeFieldOptions.map((option) => option.label).join(", ")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <div className="flex gap-2 text-sm">
                <Button
                  type="button"
                  variant={environment === "test" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEnvironment("test")}
                  data-testid="button-odoo-env-test"
                >
                  Teste
                </Button>
                <Button
                  type="button"
                  variant={environment === "production" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEnvironment("production")}
                  data-testid="button-odoo-env-production"
                >
                  Produção
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="odoo-active-switch">Estado Configuração</Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="odoo-active-switch"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(checked)}
                  data-testid="switch-odoo-active"
                />
                <span className="text-sm text-muted-foreground">
                  {isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSaveOdooConfigAndFlag}
          disabled={isSaving}
          data-testid="button-save-odoo-crm"
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar configuração Odoo
        </Button>
      </CardFooter>
    </Card>
  );
}
