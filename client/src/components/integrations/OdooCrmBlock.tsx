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

interface OdooStatus {
  configured: boolean;
  baseUrl?: string;
  dbName?: string;
  username?: string;
  environment?: string;
  isActive?: boolean;
}

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
        body: JSON.stringify({ odooCrmEnabled: odooEnabled }),
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
            <DatabaseZap className="h-4 w-4" />
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
