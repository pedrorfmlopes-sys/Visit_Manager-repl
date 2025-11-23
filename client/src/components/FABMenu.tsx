import { useState, useEffect, useRef } from "react";
import { Plus, FileText, CheckCircle2, Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface FABPosition {
  x: number;
  y: number;
}

const DEFAULT_POSITION: FABPosition = { x: 16, y: 96 }; // bottom-right: right-4, bottom-24
const FAB_STORAGE_KEY = "fab-position";

export function FABMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<FABPosition>(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const fabRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  // Load position from localStorage on mount
  useEffect(() => {
    const savedPosition = localStorage.getItem(FAB_STORAGE_KEY);
    if (savedPosition) {
      try {
        setPosition(JSON.parse(savedPosition));
      } catch {
        setPosition(DEFAULT_POSITION);
      }
    }
  }, []);

  // Save position to localStorage when it changes
  useEffect(() => {
    if (isDragging) {
      localStorage.setItem(FAB_STORAGE_KEY, JSON.stringify(position));
    }
  }, [position, isDragging]);

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

  // Long press detection for drag mode
  const handleMouseDown = (e: React.MouseEvent) => {
    // Close menu if open
    setIsOpen(false);

    const rect = fabRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }, 3000); // 3 seconds
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isDragging) {
      setIsDragging(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    // Calculate new position relative to viewport
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Keep within bounds (rough viewport constraints)
    const boundedX = Math.max(0, Math.min(newX, window.innerWidth - 56)); // 56px = h-14 w-14
    const boundedY = Math.max(0, Math.min(newY, window.innerHeight - 56));

    setPosition({ x: boundedX, y: boundedY });
  };

  return (
    <div
      ref={fabRef}
      className={`fixed z-50 flex flex-col-reverse items-end gap-2 transition-all ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseUp}
    >
      {/* Main FAB button */}
      <Button
        size="icon"
        variant="default"
        onClick={() => !isDragging && setIsOpen(!isOpen)}
        className={`h-14 w-14 rounded-full shadow-lg transition-transform ${
          isOpen ? "rotate-45" : "rotate-0"
        } ${isDragging ? "opacity-75 scale-110" : ""}`}
        data-testid={isOpen ? "fab-close" : "fab-open"}
        disabled={isDragging}
        title={isDragging ? "Arrasta para mover o botão" : "Segura 3 segundos para mover"}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Menu items */}
      {isOpen && !isDragging && (
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
