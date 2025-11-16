import { Building2, ChevronRight, Mail, Phone, MapPin, Users, Package, Briefcase, Construction, HandHeart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Entidade } from "@shared/schema";

interface EntidadeCardProps {
  entidade: Entidade;
  onClick: () => void;
  showSyncStatus?: boolean;
}

const tipoIcons = {
  Gabinete: Building2,
  Cliente: Users,
  Distribuidor: Package,
  Obra: Construction,
  Parceiro: Briefcase,
  Outro: HandHeart,
};

const tipoLabels = {
  Gabinete: "Gabinete",
  Cliente: "Cliente",
  Distribuidor: "Distribuidor",
  Obra: "Obra",
  Parceiro: "Parceiro",
  Outro: "Outro",
};

export function EntidadeCard({ entidade, onClick, showSyncStatus = false }: EntidadeCardProps) {
  const initials = entidade.nome
    .split(" ")
    .slice(0, 2)
    .map(word => word[0])
    .join("")
    .toUpperCase();

  const TipoIcon = tipoIcons[entidade.tipoEntidade as keyof typeof tipoIcons] || Building2;

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
              {tipoLabels[entidade.tipoEntidade as keyof typeof tipoLabels]}
            </Badge>
          </div>
          
          <div className="flex flex-col gap-1">
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
        
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </div>
    </Card>
  );
}
