import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Empresa } from "@shared/schema";

const updateEmpresaSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório"),
  nif: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable(),
  telefone: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  mostrarMarcasEmVisitas: z.boolean().default(false),
});

type UpdateEmpresaForm = z.infer<typeof updateEmpresaSchema>;

export default function AdminEmpresa() {
  const { toast } = useToast();

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

  return (
    <div className="min-h-screen pb-32 pt-4">
      <div className="max-w-2xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-admin-empresa-title">Configuração da Empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Empresa</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-empresa-nome" />
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
                        <Input {...field} value={field.value || ""} data-testid="input-empresa-nif" />
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
                        <Input type="email" {...field} value={field.value || ""} data-testid="input-empresa-email" />
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
                        <Input {...field} value={field.value || ""} data-testid="input-empresa-telefone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da Logo</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="https://..." data-testid="input-empresa-logoUrl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mostrarMarcasEmVisitas"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-empresa-mostrarMarcas"
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">Mostrar marcas em visitas</FormLabel>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-submit-empresa"
                >
                  {updateMutation.isPending ? "Guardando..." : "Guardar Configuração"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
