import { useState } from "react";
import { Plus, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export function FABMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  const handleNewVisita = () => {
    setIsOpen(false);
    setLocation("/visitas/nova");
  };

  const handleNewTarefa = () => {
    setIsOpen(false);
    setLocation("/tarefas/nova");
  };

  if (isOpen) {
    return (
      <div className="fixed bottom-24 right-4 z-40 space-y-2">
        <Button
          size="icon"
          variant="default"
          onClick={handleNewTarefa}
          className="flex flex-col items-center h-14 w-14 rounded-full shadow-lg"
          data-testid="fab-new-tarefa"
        >
          <CheckCircle2 className="h-6 w-6" />
        </Button>
        <Button
          size="icon"
          variant="default"
          onClick={handleNewVisita}
          className="flex flex-col items-center h-14 w-14 rounded-full shadow-lg"
          data-testid="fab-new-visita"
        >
          <FileText className="h-6 w-6" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setIsOpen(false)}
          className="flex flex-col items-center h-14 w-14 rounded-full shadow-lg"
          data-testid="fab-close"
        >
          <Plus className="h-6 w-6 rotate-45" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="icon"
      variant="default"
      onClick={() => setIsOpen(true)}
      className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full shadow-lg"
      data-testid="fab-open"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
