import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

type Lead = {
  id: string;
  titulo: string;
  entidadeId: string;
  contactoId: string;
  visitaId: string | null;
  marca: string | null;
  estado: string;
  valorPrevisto: string | null;
  moeda: string | null;
  createdAt: string;
};

type LeadsResponse =
  | { leads: Lead[] }
  | { success: false; notEnabled?: boolean; message?: string };

export default function AdminLeadsPage() {
  const [, navigate] = useLocation();

  const { data, isLoading, isError } = useQuery<LeadsResponse>({
    queryKey: ["/api/crm/leads"],
    queryFn: async () => {
      const resp = await fetch("/api/crm/leads", { credentials: "include" });
      const json = await resp.json();
      return json;
    },
  });

  const leadsDisabled =
    data &&
    "success" in data &&
    data.success === false &&
    data.notEnabled === true;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Lista de oportunidades / leads da empresa.
          </p>
        </div>
      </div>

      {isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Carregando leads...</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      )}

      {isError && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar leads</CardTitle>
            <CardDescription>
              Tenta recarregar a página ou verifica a ligação.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {leadsDisabled && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Módulo de Leads desativado</CardTitle>
            <CardDescription>
              O módulo de Leads CRM não está ativo para esta empresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Ativa o módulo de Leads nas definições de CRMs para começar a
              criar e gerir leads.
            </p>
            <Button
              size="sm"
              onClick={() => navigate("/admin/empresa")}
              data-testid="button-go-to-settings"
            >
              Ir para Definições / CRMs
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && !leadsDisabled && data && "leads" in data && (
        <Card data-testid="card-leads-list">
          <CardHeader>
            <CardTitle>Leads</CardTitle>
            <CardDescription>
              {data.leads.length === 0
                ? "Ainda não existem leads registados."
                : "Leads criados nesta empresa."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.leads.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum lead encontrado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-2">Título</th>
                      <th className="text-left py-2 pr-2">Marca</th>
                      <th className="text-left py-2 pr-2">Estado</th>
                      <th className="text-left py-2 pr-2">Valor</th>
                      <th className="text-left py-2 pr-2">Criado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="border-b hover:bg-muted cursor-pointer"
                        data-testid={`row-lead-${lead.id}`}
                        onClick={() => navigate(`/admin/leads/${lead.id}`)}
                      >
                        <td className="py-2 pr-2">{lead.titulo}</td>
                        <td className="py-2 pr-2">
                          {lead.marca ?? "—"}
                        </td>
                        <td className="py-2 pr-2 capitalize">
                          {lead.estado}
                        </td>
                        <td className="py-2 pr-2">
                          {lead.valorPrevisto
                            ? `${lead.valorPrevisto} ${lead.moeda || "EUR"}`
                            : "—"}
                        </td>
                        <td className="py-2 pr-2">
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
