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

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col-reverse items-end gap-2">
      {/* Main FAB button - always visible, toggles menu */}
      <Button
        size="icon"
        variant="default"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-14 w-14 rounded-full shadow-lg transition-transform ${
          isOpen ? "rotate-45" : "rotate-0"
        }`}
        data-testid={isOpen ? "fab-close" : "fab-open"}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Menu items - shown when open */}
      {isOpen && (
        <>
          <Button
            size="icon"
            variant="default"
            onClick={handleNewTarefa}
            className="h-14 w-14 rounded-full shadow-lg"
            data-testid="fab-new-tarefa"
          >
            <CheckCircle2 className="h-6 w-6" />
          </Button>
          <Button
            size="icon"
            variant="default"
            onClick={handleNewVisita}
            className="h-14 w-14 rounded-full shadow-lg"
            data-testid="fab-new-visita"
          >
            <FileText className="h-6 w-6" />
          </Button>
        </>
      )}
    </div>
  );
}
