import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { useLocation } from "wouter";

interface FABPosition {
  x: number;
  y: number;
}

const DEFAULT_POSITION: FABPosition = { x: 16, y: 96 };
const FAB_STORAGE_KEY = "fab-position";
const FAB_SIZE = 56;
const BUTTON_HEIGHT = 56;

export function FABMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<FABPosition>(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [shouldOpenUp, setShouldOpenUp] = useState(false);
  const [dynamicGap, setDynamicGap] = useState(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  // Calculate gap based on half screen height
  const calculateGap = () => {
    const halfScreen = window.innerHeight / 2;
    const gap = (halfScreen - (5 * BUTTON_HEIGHT)) / 4;
    setDynamicGap(gap);
  };

  // Load position from localStorage and calculate initial gap
  useEffect(() => {
    const savedPosition = localStorage.getItem(FAB_STORAGE_KEY);
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        
        // Validate position is within viewport with safe margins
        // Keep it in top 70% of screen to ensure visibility above bottom nav
        const maxSafeY = Math.max(200, window.innerHeight * 0.7);
        const validX = Math.max(0, Math.min(parsed.x, window.innerWidth - FAB_SIZE));
        const validY = Math.max(0, Math.min(parsed.y, maxSafeY - FAB_SIZE));
        
        setPosition({ x: validX, y: validY });
      } catch {
        setPosition(DEFAULT_POSITION);
      }
    } else {
      setPosition(DEFAULT_POSITION);
    }
    
    calculateGap();
    window.addEventListener("resize", calculateGap);
    return () => window.removeEventListener("resize", calculateGap);
  }, []);

  // Determine if menu should open upwards
  useEffect(() => {
    const totalMenuHeight = 5 * BUTTON_HEIGHT + 4 * dynamicGap;
    setShouldOpenUp(position.y + totalMenuHeight > window.innerHeight);
  }, [position, dynamicGap]);

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
    { icon: "📋", label: "Tarefa", action: "/tarefas/nova", testId: "fab-new-tarefa" },
    { icon: "📄", label: "Visita", action: "/visitas/nova", testId: "fab-new-visita" },
    { icon: "👤", label: "Contacto", action: "/contactos/novo", testId: "fab-new-contacto" },
    { icon: "🏢", label: "Entidade", action: "/entidades/nova", testId: "fab-new-entidade" },
  ];

  const handleMainButtonMouseDown = (e: React.MouseEvent) => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    longPressTimer.current = setTimeout(() => {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }, 3000);
  };

  const handleMainButtonMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      setIsOpen(!isOpen);
    }
  };

  const handleMenuItemClick = (action: string) => {
    setIsOpen(false);
    setLocation(action);
  };

  // Calculate menu item position in viewport coordinates
  const getMenuItemPosition = (index: number) => {
    const spacing = BUTTON_HEIGHT + dynamicGap;
    const itemOffset = (index + 1) * spacing;
    
    if (shouldOpenUp) {
      return position.y - itemOffset;
    } else {
      return position.y + itemOffset;
    }
  };

  return (
    <>
      {/* Main FAB button - fixed positioning */}
      <div
        ref={buttonRef}
        onMouseDown={handleMainButtonMouseDown}
        onMouseUp={handleMainButtonMouseUp}
        className={`fixed z-50 h-14 w-14 rounded-full shadow-lg transition-transform flex items-center justify-center bg-green-500 hover:bg-green-600 cursor-pointer ${
          isOpen ? "rotate-45" : "rotate-0"
        } ${isDragging ? "opacity-75 scale-125" : ""}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? "grabbing" : "grab",
        }}
        data-testid={isOpen ? "fab-close" : "fab-open"}
        title={isDragging ? "Arrasta para mover o botão" : "Clica para abrir, segura 3 segundos para mover"}
      >
        <Plus className="h-6 w-6 text-white" />
      </div>

      {/* Menu items - fixed positioning in viewport */}
      {isOpen && !isDragging && (
        <>
          {menuItems.map((item, index) => {
            return (
              <div
                key={item.testId}
                onClick={() => handleMenuItemClick(item.action)}
                className="fixed z-40 h-14 w-14 rounded-full shadow-lg flex items-center justify-center bg-blue-500 hover:bg-blue-600 cursor-pointer text-white"
                style={{
                  left: `${position.x}px`,
                  top: `${getMenuItemPosition(index)}px`,
                }}
                data-testid={item.testId}
                title={item.label}
              >
                {item.icon}
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
