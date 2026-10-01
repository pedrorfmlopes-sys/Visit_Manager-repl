import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { ExternalLink, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const createUserSchema = z.object({
  email: z.string().email("Email inválido"),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  role: z.enum(["admin", "agent"]).default("agent"),
});

const updateUserSchema = z.object({
  role: z.enum(["admin", "agent"]).optional(),
  ativo: z.boolean().optional(),
  odooPartnerId: z.string().nullable().optional(),
  odooLeadAccess: z.enum(["view", "propose", "publish"]).optional(),
  odooLeadCanCreate: z.boolean().optional(),
  odooLeadCanViewAttachments: z.boolean().optional(),
  odooLeadCanViewChatter: z.boolean().optional(),
  odooLeadCanPublishChatter: z.boolean().optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;
type UpdateUserForm = z.infer<typeof updateUserSchema>;

export default function AdminUsers() {
  const { toast } = useToast();
  const { user: currentUser, empresa } = useAuth();
  const [invitationUrl, setInvitationUrl] = useState("");

  const { data: utilizadores = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/utilizadores"],
  });

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "agent" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const response = await apiRequest("POST", "/api/admin/utilizadores", data);
      return response.json();
    },
    onSuccess: (result) => {
      setInvitationUrl(result.developmentInvitationUrl || "");
      toast({ title: "Convite criado com sucesso" });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/utilizadores"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar utilizador",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(
        "POST",
        `/api/admin/utilizadores/${id}/invite`,
      );
      return response.json();
    },
    onSuccess: (result) => {
      setInvitationUrl(result.developmentInvitationUrl || "");
      toast({ title: "Convite reenviado" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/utilizadores"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao reenviar convite",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserForm }) =>
      apiRequest("PATCH", `/api/admin/utilizadores/${id}`, data),
    onSuccess: () => {
      toast({ title: "Utilizador atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/utilizadores"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar utilizador",
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

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-emerald-950">
                  Licença {empresa?.licensePlan?.toUpperCase() || "ENTERPRISE"}
                </p>
                <p className="text-sm text-emerald-800">
                  {empresa?.licenseMaxUsers
                    ? `Até ${empresa.licenseMaxUsers} utilizadores ativos`
                    : "Sem limite de utilizadores configurado"}
                </p>
              </div>
              <Badge variant="outline" className="border-emerald-300 bg-white">
                {empresa?.licenseStatus === "active" || !empresa?.licenseStatus
                  ? "Licença ativa"
                  : "Licença inativa"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {invitationUrl && (
          <Card className="border-lime-300 bg-lime-50">
            <CardContent className="pt-6">
              <p className="font-semibold">Link de convite local</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Em produção este link é enviado por email. Localmente pode abri-lo diretamente.
              </p>
              <Button asChild className="mt-4" data-testid="button-open-invitation">
                <a href={invitationUrl}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir convite
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create User Form */}
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-admin-users-create-title">Criar Novo Utilizador</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="user@example.com" {...field} data-testid="input-user-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primeiro Nome</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-user-firstName" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Último Nome</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-user-lastName" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-user-role">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="agent">Agent</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="button"
                  onClick={form.handleSubmit((data) => createMutation.mutate(data))}
                  disabled={createMutation.isPending}
                  data-testid="button-create-user"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {createMutation.isPending ? "Criando..." : "Criar Utilizador"}
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-admin-users-list-title">Utilizadores da Empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {utilizadores.length === 0 ? (
                <p className="text-muted-foreground">Nenhum utilizador encontrado</p>
              ) : (
                utilizadores.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col gap-3 p-4 border rounded-lg hover-elevate"
                    data-testid={`card-user-${user.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold" data-testid={`text-user-email-${user.id}`}>
                          {user.email}
                        </p>
                        {(user.firstName || user.lastName) && (
                          <p className="text-sm text-muted-foreground" data-testid={`text-user-name-${user.id}`}>
                            {user.firstName} {user.lastName}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={user.role === "admin" ? "default" : "secondary"} data-testid={`badge-user-role-${user.id}`}>
                          {user.isOwner ? "Proprietário" : user.role === "admin" ? "Admin" : "Agente"}
                        </Badge>
                        {!user.acceptedAt && (
                          <Badge variant="secondary" data-testid={`badge-user-pending-${user.id}`}>
                            Convite pendente
                          </Badge>
                        )}
                        <Badge variant={user.ativo ? "outline" : "destructive"} data-testid={`badge-user-ativo-${user.id}`}>
                          {user.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Select
                        value={user.role}
                        disabled={
                          user.isOwner ||
                          (!currentUser?.isOwner && user.role === "admin")
                        }
                        onValueChange={(newRole: "admin" | "agent") =>
                          updateMutation.mutate({ id: user.id, data: { role: newRole } })
                        }
                      >
                        <SelectTrigger className="w-32" data-testid={`select-user-role-${user.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agent">Agent</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        variant={user.ativo ? "outline" : "default"}
                        onClick={() =>
                          updateMutation.mutate({
                            id: user.id,
                            data: { ativo: !user.ativo },
                          })
                        }
                        disabled={
                          updateMutation.isPending ||
                          user.isOwner ||
                          user.id === currentUser?.id ||
                          (!currentUser?.isOwner && user.role === "admin")
                        }
                        data-testid={`button-toggle-ativo-${user.id}`}
                      >
                        {user.ativo ? "Desativar" : "Ativar"}
                      </Button>

                      {!user.acceptedAt && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => inviteMutation.mutate(user.id)}
                          disabled={inviteMutation.isPending}
                          data-testid={`button-resend-invite-${user.id}`}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Reenviar convite
                        </Button>
                      )}

                      {user.isOwner && (
                        <span className="flex items-center text-xs text-muted-foreground">
                          <ShieldCheck className="mr-1 h-4 w-4" />
                          Conta protegida
                        </span>
                      )}
                    </div>

                    {user.role === "agent" && (
                      <div className="grid gap-3 border-t pt-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Email ou ID do contacto Odoo
                          </label>
                          <div className="flex gap-2">
                            <Input
                              key={user.odooPartnerId ?? "empty"}
                              defaultValue={user.odooPartnerId ?? ""}
                              inputMode="email"
                              autoComplete="off"
                              placeholder={user.email ?? "agente@empresa.pt"}
                              data-testid={`input-user-odoo-partner-${user.id}`}
                              onBlur={(event) => {
                                const value = event.currentTarget.value.trim();
                                if (value !== (user.odooPartnerId ?? "")) {
                                  updateMutation.mutate({
                                    id: user.id,
                                    data: {
                                      odooPartnerId: value || null,
                                    },
                                  });
                                }
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Pode indicar o email do agente. A app encontra e
                            guarda automaticamente o contacto correspondente no
                            Odoo.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Permissão sobre leads seguidos
                          </label>
                          <Select
                            value={user.odooLeadAccess ?? "view"}
                            onValueChange={(
                              value: "view" | "propose" | "publish"
                            ) =>
                              updateMutation.mutate({
                                id: user.id,
                                data: { odooLeadAccess: value },
                              })
                            }
                          >
                            <SelectTrigger
                              data-testid={`select-user-odoo-lead-access-${user.id}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view">
                                Apenas consultar
                              </SelectItem>
                              <SelectItem value="propose">
                                Propor alterações
                              </SelectItem>
                              <SelectItem value="publish">
                                Publicar alterações
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-wrap gap-2 md:col-span-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              user.odooLeadCanCreate ? "default" : "outline"
                            }
                            onClick={() =>
                              updateMutation.mutate({
                                id: user.id,
                                data: {
                                  odooLeadCanCreate:
                                    !user.odooLeadCanCreate,
                                },
                              })
                            }
                          >
                            Criar no Odoo
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              user.odooLeadCanViewAttachments
                                ? "default"
                                : "outline"
                            }
                            onClick={() =>
                              updateMutation.mutate({
                                id: user.id,
                                data: {
                                  odooLeadCanViewAttachments:
                                    !user.odooLeadCanViewAttachments,
                                },
                              })
                            }
                          >
                            Consultar anexos
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              user.odooLeadCanViewChatter
                                ? "default"
                                : "outline"
                            }
                            onClick={() =>
                              updateMutation.mutate({
                                id: user.id,
                                data: {
                                  odooLeadCanViewChatter:
                                    !user.odooLeadCanViewChatter,
                                  ...(
                                    user.odooLeadCanViewChatter
                                      ? { odooLeadCanPublishChatter: false }
                                      : {}
                                  ),
                                },
                              })
                            }
                          >
                            Consultar mensagens
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              user.odooLeadCanPublishChatter
                                ? "default"
                                : "outline"
                            }
                            onClick={() =>
                              updateMutation.mutate({
                                id: user.id,
                                data: {
                                  odooLeadCanPublishChatter:
                                    !user.odooLeadCanPublishChatter,
                                  ...(
                                    !user.odooLeadCanPublishChatter
                                      ? { odooLeadCanViewChatter: true }
                                      : {}
                                  ),
                                },
                              })
                            }
                          >
                            Publicar mensagens
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
