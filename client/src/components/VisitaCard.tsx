import { Calendar, Building2, User, ChevronRight, Image as ImageIcon, Mic, UserCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RichTextViewer } from "@/components/RichTextViewer";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import type { VisitaWithRelations } from "@shared/schema";

interface VisitaCardProps {
  visita: VisitaWithRelations;
  onClick: () => void;
  currentEntidadeName?: string;
  currentUserId?: string;
}

export function VisitaCard({ visita, onClick, currentEntidadeName, currentUserId }: VisitaCardProps) {
  const hasMedia = (visita.mediaUrls && visita.mediaUrls.length > 0) || visita.audioUrl;
  const dataFormatada = format(new Date(visita.dataVisita), "d 'de' MMMM, yyyy", { locale: pt });
  
  // Contactos presentes (excluindo o utilizador atual)
  const contactosOutros = (visita.contactosPresentes || []).filter(
    (vc: any) => vc.contacto && vc.contacto.id !== currentUserId
  );
  const contactosLabel = contactosOutros.length > 0
    ? contactosOutros.map((vc: any) => vc.contacto?.nome || vc.contacto?.email).filter(Boolean).join(", ")
    : "Sem contactos registados";

  return (
    <Card
      onClick={onClick}
      className="p-4 hover-elevate active-elevate-2 cursor-pointer transition-all"
      data-testid={`card-visita-${visita.id}`}
    >
      <div className="flex gap-3">
        {hasMedia && visita.mediaUrls && visita.mediaUrls.length > 0 && (
          <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img 
              src={visita.mediaUrls[0]} 
              alt="Preview" 
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-medium text-base text-foreground" data-testid={`text-visita-gabinete-${visita.id}`}>
              {visita.entidade?.nome ?? currentEntidadeName ?? "Entidade desconhecida"}
            </h3>
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              {dataFormatada}
            </Badge>
          </div>
          
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{contactosLabel}</span>
            </div>
            
            {visita.assignedUser && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <UserCheck className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">
                  {visita.assignedUser.firstName && visita.assignedUser.lastName
                    ? `${visita.assignedUser.firstName} ${visita.assignedUser.lastName}`
                    : visita.assignedUser.email}
                </span>
              </div>
            )}
            
            {visita.notas && (
              <div className="text-sm text-muted-foreground line-clamp-2 overflow-hidden" data-testid="text-notas">
                <RichTextViewer content={visita.notas} />
              </div>
            )}
            
            <div className="flex items-center gap-2 mt-1">
              {visita.audioUrl && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Mic className="h-3 w-3" />
                  Áudio
                </Badge>
              )}
              {visita.mediaUrls && visita.mediaUrls.length > 0 && (
                <Badge variant="outline" className="text-xs gap-1">
                  <ImageIcon className="h-3 w-3" />
                  {visita.mediaUrls.length} {visita.mediaUrls.length === 1 ? "foto" : "fotos"}
                </Badge>
              )}
              {visita.marcasEntregues && visita.marcasEntregues.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {visita.marcasEntregues.length} {visita.marcasEntregues.length === 1 ? "marca" : "marcas"}
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 self-center" />
      </div>
      
      {visita.proximaVisita && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-sm text-primary">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              Próxima visita: {format(new Date(visita.proximaVisita), "d 'de' MMMM", { locale: pt })}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
