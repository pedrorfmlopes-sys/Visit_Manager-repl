import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";

interface AdminTopBarProps {
  onMenuClick?: () => void;
}

export function AdminTopBar({ onMenuClick }: AdminTopBarProps) {
  const { user, empresa } = useAuth();
  const isMobile = useIsMobile();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-card-border px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Menu button (mobile only) */}
        <div>
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              data-testid="button-menu-toggle"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Center: Company info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {empresa?.nome}
          </p>
        </div>

        {/* Right: User info and logout */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:block text-right">
            <p className="text-xs text-muted-foreground truncate max-w-[150px]">
              {user?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            data-testid="button-logout-topbar"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
