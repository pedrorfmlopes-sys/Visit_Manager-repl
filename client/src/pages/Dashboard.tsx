import { useQuery } from "@tanstack/react-query";
import { Building2, Users, FileText, Package, Calendar, LogOut } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import type { VisitaWithRelations } from "@shared/schema";

interface DashboardStats {
  totalGabinetes: number;
  totalContactos: number;
  totalVisitas: number;
  visitasEstesMes: number;
  marcasMaisEntregues: { marca: string; count: number }[];
  proximasVisitas: VisitaWithRelations[];
}

export default function Dashboard() {
  const { user } = useAuth();
  
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Olá, {user?.firstName || user?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          </>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 text-center space-y-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-gabinetes">
                  {stats.totalGabinetes}
                </p>
                <p className="text-xs text-muted-foreground">Gabinetes</p>
              </Card>

              <Card className="p-4 text-center space-y-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-contactos">
                  {stats.totalContactos}
                </p>
                <p className="text-xs text-muted-foreground">Contactos</p>
              </Card>

              <Card className="p-4 text-center space-y-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-visitas">
                  {stats.totalVisitas}
                </p>
                <p className="text-xs text-muted-foreground">Visitas Total</p>
              </Card>

              <Card className="p-4 text-center space-y-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-visitas-mes">
                  {stats.visitasEstesMes}
                </p>
                <p className="text-xs text-muted-foreground">Este Mês</p>
              </Card>
            </div>

            {stats.marcasMaisEntregues.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Marcas Mais Entregues</h2>
                <Card className="p-4">
                  <div className="space-y-3">
                    {stats.marcasMaisEntregues.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium text-foreground">{item.marca}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{item.count}x</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {stats.proximasVisitas.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Próximas Visitas</h2>
                <div className="space-y-2">
                  {stats.proximasVisitas.map((visita) => (
                    <Card key={visita.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{visita.gabinete?.nome}</p>
                          {visita.contacto && (
                            <p className="text-sm text-muted-foreground">{visita.contacto.nome}</p>
                          )}
                        </div>
                        {visita.proximaVisita && (
                          <div className="text-right">
                            <p className="text-sm font-medium text-primary">
                              {format(new Date(visita.proximaVisita), "d MMM", { locale: pt })}
                            </p>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
