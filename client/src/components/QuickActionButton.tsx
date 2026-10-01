import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

interface QuickActionButtonProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}

export function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  testId,
}: QuickActionButtonProps) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[70px]">
      <Button
        variant="outline"
        size="icon"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "h-12 w-12 rounded-full",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        data-testid={testId}
      >
        <Icon className="h-5 w-5" />
      </Button>
      <span className={cn(
        "text-xs text-center text-muted-foreground",
        disabled && "opacity-50"
      )}>
        {label}
      </span>
    </div>
  );
}
