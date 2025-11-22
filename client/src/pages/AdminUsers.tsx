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
import { Trash2, UserPlus } from "lucide-react";

const createUserSchema = z.object({
  email: z.string().email("Email inválido"),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  role: z.enum(["admin", "agent"]).default("agent"),
});

const updateUserSchema = z.object({
  role: z.enum(["admin", "agent"]).optional(),
  ativo: z.boolean().optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;
type UpdateUserForm = z.infer<typeof updateUserSchema>;

export default function AdminUsers() {
  const { toast } = useToast();

  const { data: utilizadores = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/utilizadores"],
  });

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "agent" },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserForm) =>
      apiRequest("POST", "/api/admin/utilizadores", data),
    onSuccess: () => {
      toast({ title: "Utilizador criado com sucesso" });
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
    <div className="min-h-screen pb-32 pt-4">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Create User Form */}
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-admin-users-create-title">Criar Novo Utilizador</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
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

                <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-user">
                  <UserPlus className="w-4 h-4 mr-2" />
                  {createMutation.isPending ? "Criando..." : "Criar Utilizador"}
                </Button>
              </form>
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
                          {user.role}
                        </Badge>
                        <Badge variant={user.ativo ? "outline" : "destructive"} data-testid={`badge-user-ativo-${user.id}`}>
                          {user.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Select
                        value={user.role}
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
                        disabled={updateMutation.isPending}
                        data-testid={`button-toggle-ativo-${user.id}`}
                      >
                        {user.ativo ? "Desativar" : "Ativar"}
                      </Button>
                    </div>
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
