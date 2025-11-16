import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FABProps {
  onClick: () => void;
  label?: string;
  testId?: string;
}

export function FAB({ onClick, label = "Criar", testId = "button-fab" }: FABProps) {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-40"
      data-testid={testId}
    >
      <Plus className="h-6 w-6" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
