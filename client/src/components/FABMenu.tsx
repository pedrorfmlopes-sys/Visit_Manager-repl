import { useState, useEffect, useRef } from "react";
import { Plus, FileText, CheckCircle2, Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface FABPosition {
  x: number;
  y: number;
}

const DEFAULT_POSITION: FABPosition = { x: 16, y: 96 };
const FAB_STORAGE_KEY = "fab-position";
const FAB_SIZE = 56;
const GAP = 16; // Increased gap between buttons

export function FABMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<FABPosition>(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [shouldOpenUp, setShouldOpenUp] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
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

  // Determine if menu should open upwards
  useEffect(() => {
    const totalMenuHeight = 56 * 5 + GAP * 4;
    setShouldOpenUp(position.y + totalMenuHeight > window.innerHeight);
  }, [position]);

  // Handle drag on global events
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      const boundedX = Math.max(0, Math.min(newX, window.innerWidth - FAB_SIZE));
      const boundedY = Math.max(0, Math.min(newY, window.innerHeight - FAB_SIZE));

      setPosition({ x: boundedX, y: boundedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      localStorage.setItem(FAB_STORAGE_KEY, JSON.stringify(position));
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, position]);

  const menuItems = [
    { icon: CheckCircle2, label: "Tarefa", action: "/tarefas/nova", testId: "fab-new-tarefa" },
    { icon: FileText, label: "Visita", action: "/visitas/nova", testId: "fab-new-visita" },
    { icon: Users, label: "Contacto", action: "/contactos/novo", testId: "fab-new-contacto" },
    { icon: Building2, label: "Entidade", action: "/entidades/nova", testId: "fab-new-entidade" },
  ];

  const handleMainButtonMouseDown = (e: React.MouseEvent) => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Start long press timer for drag activation
    longPressTimer.current = setTimeout(() => {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }, 3000);
  };

  const handleMainButtonMouseUp = () => {
    // If timer is still active, it means user didn't hold for 3 seconds
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      
      // This is a regular click - toggle menu
      setIsOpen(!isOpen);
    }
  };

  const handleMenuItemClick = (action: string) => {
    setIsOpen(false);
    setLocation(action);
  };

  // Calculate menu item position
  const getMenuItemStyle = (index: number) => {
    const itemOffset = index * (56 + GAP); // button height + gap
    if (shouldOpenUp) {
      // Menu opens upwards - items positioned above the main button
      return {
        bottom: `${56 + GAP + itemOffset}px`,
        left: "0",
      };
    } else {
      // Menu opens downwards - items positioned below the main button
      return {
        top: `${56 + GAP + itemOffset}px`,
        left: "0",
      };
    }
  };

  return (
    <div
      className="fixed z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: "56px",
        height: "56px",
      }}
    >
      {/* Main FAB button - always at position (0,0) within container */}
      <Button
        ref={buttonRef}
        size="icon"
        variant="default"
        onMouseDown={handleMainButtonMouseDown}
        onMouseUp={handleMainButtonMouseUp}
        className={`h-14 w-14 rounded-full shadow-lg transition-transform absolute ${
          isOpen ? "rotate-45" : "rotate-0"
        } ${isDragging ? "opacity-75 scale-125" : ""}`}
        style={{
          left: "0",
          top: "0",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        data-testid={isOpen ? "fab-close" : "fab-open"}
        disabled={isDragging}
        title={isDragging ? "Arrasta para mover o botão" : "Clica para abrir, segura 3 segundos para mover"}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Menu items - positioned absolutely */}
      {isOpen && !isDragging && (
        <>
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.testId}
                size="icon"
                variant="default"
                onClick={() => handleMenuItemClick(item.action)}
                className="h-14 w-14 rounded-full shadow-lg absolute"
                style={getMenuItemStyle(index)}
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
