import { ChevronRight, Mail, Phone, Building2, Briefcase, UserCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ContactoWithRelations } from "@shared/schema";
import OdooLogo from "@/assets/crm/odoo.svg";

interface ContactoCardProps {
  contacto: ContactoWithRelations;
  onClick: () => void;
}

export function ContactoCard({ contacto, onClick }: ContactoCardProps) {
  const initials = contacto.nome
    .split(" ")
    .slice(0, 2)
    .map(word => word[0])
    .join("")
    .toUpperCase();

  return (
    <Card
      onClick={onClick}
      className="p-4 hover-elevate active-elevate-2 cursor-pointer transition-all"
      data-testid={`card-contacto-${contacto.id}`}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          {contacto.fotoUrl && <AvatarImage src={contacto.fotoUrl} alt={contacto.nome} />}
          <AvatarFallback className="bg-accent text-accent-foreground font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-base text-foreground truncate" data-testid={`text-contacto-nome-${contacto.id}`}>
            {contacto.nome}
          </h3>
          
          <div className="flex flex-col gap-1 mt-1">
            {contacto.assignedUser && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <UserCheck className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">
                  {contacto.assignedUser.firstName && contacto.assignedUser.lastName
                    ? `${contacto.assignedUser.firstName} ${contacto.assignedUser.lastName}`
                    : contacto.assignedUser.email}
                </span>
              </div>
            )}
            {contacto.funcao && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{contacto.funcao}</span>
              </div>
            )}
            {contacto.gabinete && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{contacto.gabinete.nome}</span>
              </div>
            )}
            {contacto.telemovel && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{contacto.telemovel}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <img
            src={OdooLogo}
            alt="Odoo CRM"
            className={
              contacto.odooPartnerId
                ? "h-5 w-auto"
                : "h-5 w-auto opacity-30 grayscale"
            }
            title={
              contacto.odooPartnerId
                ? "Ligado ao Odoo CRM"
                : "CRM desligado"
            }
            data-testid={`img-odoo-contacto-${contacto.id}`}
          />
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}
