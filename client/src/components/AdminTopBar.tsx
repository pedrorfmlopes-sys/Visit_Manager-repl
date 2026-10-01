import { Link } from "wouter";
import { UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/BrandLogo";

export function AdminTopBar() {
  const { user, empresa } = useAuth();
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "";

  return (
    <header className="sticky top-0 z-30 border-b border-card-border bg-card/95 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex min-h-11 max-w-lg items-center gap-3">
        <BrandMark className="h-10 w-10" title="Visit Manager" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {empresa?.nome}
          </p>
          <p className="truncate text-base font-semibold text-foreground">
            {user?.role === "admin" ? "Área de gestão" : "Área de visitas"}
          </p>
        </div>

        <Link
          href="/perfil"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary"
          title={displayName}
          aria-label="Abrir perfil"
          data-testid="mobile-topbar-profile"
        >
          <UserRound className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
