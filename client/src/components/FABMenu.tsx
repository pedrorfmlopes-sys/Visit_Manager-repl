import { useState } from "react";
import { Plus, FileText, CheckCircle2, Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export function FABMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  const menuItems = [
    { icon: CheckCircle2, label: "Tarefa", action: "/tarefas/nova", testId: "fab-new-tarefa" },
    { icon: FileText, label: "Visita", action: "/visitas/nova", testId: "fab-new-visita" },
    { icon: Users, label: "Contacto", action: "/contactos/novo", testId: "fab-new-contacto" },
    { icon: Building2, label: "Entidade", action: "/entidades/nova", testId: "fab-new-entidade" },
  ];

  const handleMenuItemClick = (action: string) => {
    setIsOpen(false);
    setLocation(action);
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
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.testId}
                size="icon"
                variant="default"
                onClick={() => handleMenuItemClick(item.action)}
                className="h-14 w-14 rounded-full shadow-lg"
                data-testid={item.testId}
                title={item.label}
              >
                <Icon className="h-6 w-6" />
              </Button>
            );
          })}
        </>
      )}
    </div>
  );
}
