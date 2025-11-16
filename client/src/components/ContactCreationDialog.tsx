import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Link2, UserX } from "lucide-react";

interface ContactCreationDialogProps {
  open: boolean;
  contactName: string;
  onCreateEntity: (entityName: string) => void;
  onAssociateLater: () => void;
  onKeepWithoutEntity: () => void;
}

export function ContactCreationDialog({
  open,
  contactName,
  onCreateEntity,
  onAssociateLater,
  onKeepWithoutEntity,
}: ContactCreationDialogProps) {
  const [entityName, setEntityName] = useState("");
  const [showEntityInput, setShowEntityInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateEntity = async () => {
    if (entityName.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await onCreateEntity(entityName.trim());
        setEntityName("");
        setShowEntityInput(false);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleAssociateLater = () => {
    if (!isSubmitting) {
      onAssociateLater();
      setEntityName("");
      setShowEntityInput(false);
    }
  };

  const handleKeepWithoutEntity = () => {
    if (!isSubmitting) {
      onKeepWithoutEntity();
      setEntityName("");
      setShowEntityInput(false);
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent data-testid="dialog-contact-creation">
        <AlertDialogHeader>
          <AlertDialogTitle>Contacto sem Entidade</AlertDialogTitle>
          <AlertDialogDescription>
            O contacto <strong>{contactName}</strong> não tem uma entidade (empresa) associada. 
            O que deseja fazer?
          </AlertDialogDescription>
        </AlertDialogHeader>

        {showEntityInput ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entity-name">Nome da Entidade</Label>
              <Input
                id="entity-name"
                data-testid="input-entity-name"
                placeholder="Nome da empresa..."
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && entityName.trim()) {
                    handleCreateEntity();
                  }
                }}
                autoFocus
              />
            </div>
            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowEntityInput(false)}
                data-testid="button-cancel-entity"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateEntity}
                disabled={!entityName.trim() || isSubmitting}
                data-testid="button-confirm-entity"
              >
                <Building2 className="h-4 w-4 mr-2" />
                {isSubmitting ? "A criar..." : "Criar Entidade"}
              </Button>
            </AlertDialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <Button
              variant="default"
              className="w-full justify-start"
              onClick={() => setShowEntityInput(true)}
              disabled={isSubmitting}
              data-testid="button-create-entity"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Criar Nova Entidade
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleAssociateLater}
              disabled={isSubmitting}
              data-testid="button-associate-later"
            >
              <Link2 className="h-4 w-4 mr-2" />
              Associar a Entidade Existente Mais Tarde
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleKeepWithoutEntity}
              disabled={isSubmitting}
              data-testid="button-keep-without-entity"
            >
              <UserX className="h-4 w-4 mr-2" />
              Manter Sem Entidade
            </Button>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
