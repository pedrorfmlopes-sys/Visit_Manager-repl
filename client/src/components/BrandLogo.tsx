import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
  title?: string;
}

export function BrandMark({ className, title }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect x="4" y="4" width="56" height="56" rx="16" fill="#073B4C" />
      <path d="M15 18h10l10 18-6 11L15 18Z" fill="#FFFFFF" />
      <path d="M27 29h9l4 8 10-19h10L40 51 27 29Z" fill="#22C7A9" />
    </svg>
  );
}

interface BrandLogoProps {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  compact?: boolean;
  inverse?: boolean;
}

export function BrandLogo({
  className,
  markClassName,
  wordmarkClassName,
  compact = false,
  inverse = false,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark className={cn("h-10 w-10", markClassName)} title="Visit Manager" />
      {!compact && (
        <span
          className={cn(
            "whitespace-nowrap text-lg font-semibold tracking-[-0.03em]",
            inverse ? "text-white" : "text-foreground",
            wordmarkClassName,
          )}
        >
          Visit Manager
        </span>
      )}
    </div>
  );
}
