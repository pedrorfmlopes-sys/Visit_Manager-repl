import { Building2, ChevronRight, Mail, Phone, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Gabinete } from "@shared/schema";

interface GabineteCardProps {
  gabinete: Gabinete;
  onClick: () => void;
}

export function GabineteCard({ gabinete, onClick }: GabineteCardProps) {
  const initials = gabinete.nome
    .split(" ")
    .slice(0, 2)
    .map(word => word[0])
    .join("")
    .toUpperCase();

  return (
    <Card
      onClick={onClick}
      className="p-4 hover-elevate active-elevate-2 cursor-pointer transition-all"
      data-testid={`card-gabinete-${gabinete.id}`}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 bg-primary/10">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-base text-foreground truncate" data-testid={`text-gabinete-nome-${gabinete.id}`}>
            {gabinete.nome}
          </h3>
          
          <div className="flex flex-col gap-1 mt-1">
            {gabinete.cidade && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{gabinete.cidade}</span>
              </div>
            )}
            {gabinete.telefone && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{gabinete.telefone}</span>
              </div>
            )}
            {gabinete.email && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{gabinete.email}</span>
              </div>
            )}
          </div>
        </div>
        
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </div>
    </Card>
  );
}
