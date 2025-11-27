import { Building2, ChevronRight, Mail, Phone, MapPin, User, Package, Briefcase, Construction, UserCheck, Store, Factory, Home, Handshake, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { EntidadeWithRelations } from "@shared/schema";
import OdooLogo from "@/assets/crm/odoo.svg";

interface EntidadeCardProps {
  entidade: EntidadeWithRelations;
  onClick: () => void;
  showSyncStatus?: boolean;
}

// FASE 30: Icon map for entity type display
const iconMap = {
  Building2,
  Store,
  Factory,
  Briefcase,
  Users,
  Home,
  Handshake,
  Package,
};

// Legacy mapping (fallback)
const tipoLabels = {
  Gabinete: "Gabinete",
  Distribuidor: "Distribuidor",
  Parceiro: "Parceiro",
  Construtor: "Construtor",
};

export function EntidadeCard({ entidade, onClick, showSyncStatus = false }: EntidadeCardProps) {
  const initials = entidade.nome
    .split(" ")
    .slice(0, 2)
    .map(word => word[0])
    .join("")
    .toUpperCase();

  // FASE 30: Use icon from entidade.entidadeTipo.icon, fallback to Building2
  const iconName = entidade.entidadeTipo?.icon ?? "Building2";
  const TipoIcon = iconMap[iconName as keyof typeof iconMap] ?? Building2;
  const tipoNome = entidade.entidadeTipo?.nome ?? entidade.tipoEntidade ?? "Desconhecido";

  return (
    <Card
      onClick={onClick}
      className="p-4 hover-elevate active-elevate-2 cursor-pointer transition-all"
      data-testid={`card-entidade-${entidade.id}`}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 bg-primary/10">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-base text-foreground truncate" data-testid={`text-entidade-nome-${entidade.id}`}>
              {entidade.nome}
            </h3>
            <Badge variant="outline" className="flex items-center gap-1 text-xs no-default-hover-elevate no-default-active-elevate" data-testid={`badge-tipo-${entidade.id}`}>
              <TipoIcon className="h-3 w-3" />
              {tipoLabels[tipoNome as keyof typeof tipoLabels] || tipoNome}
            </Badge>
          </div>
          
          <div className="flex flex-col gap-1">
            {entidade.assignedUser && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <UserCheck className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">
                  {entidade.assignedUser.firstName && entidade.assignedUser.lastName
                    ? `${entidade.assignedUser.firstName} ${entidade.assignedUser.lastName}`
                    : entidade.assignedUser.email}
                </span>
              </div>
            )}
            {entidade.cidade && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{entidade.cidade}</span>
              </div>
            )}
            {entidade.telefone && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{entidade.telefone}</span>
              </div>
            )}
            {entidade.email && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{entidade.email}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <img
            src={OdooLogo}
            alt="Odoo CRM"
            className={
              entidade.odooPartnerId
                ? "h-5 w-auto"
                : "h-5 w-auto opacity-30 grayscale"
            }
            title={
              entidade.odooPartnerId
                ? "Ligado ao Odoo CRM"
                : "CRM desligado"
            }
            data-testid={`img-odoo-entidade-${entidade.id}`}
          />
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}
