import { ReactNode, useState } from "react";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminTopBar } from "@/components/AdminTopBar";
import { AdminDrawerMenu } from "@/components/AdminDrawer";
import { BottomNav } from "@/components/BottomNav";
import { SyncIndicator } from "@/components/SyncIndicator";
import { AlertRibbon } from "@/components/AlertRibbon";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isAdmin, empresa } = useAuth();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isAdmin) {
    return (
      <div className="flex h-screen bg-background">
        {/* Desktop sidebar (hidden on mobile) */}
        <div className="hidden md:block">
          <AdminSidebar />
        </div>

        {/* Mobile drawer */}
        {isMobile && (
          <AdminDrawerMenu open={drawerOpen} onOpenChange={setDrawerOpen} />
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden md:ml-64">
          {/* Top bar for mobile or admin header for desktop */}
          {isMobile ? (
            <AdminTopBar onMenuClick={() => setDrawerOpen(true)} />
          ) : (
            empresa?.logoUrl && (
              <header className="sticky top-0 z-20 bg-background border-b border-border px-6 py-3">
                <div className="flex items-center h-10">
                  <img 
                    src={empresa.logoUrl} 
                    alt={empresa.nome} 
                    className="h-full max-h-10 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              </header>
            )
          )}

          {/* Alert Ribbon */}
          <AlertRibbon />

          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Agent layout: bottom nav + content
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Logo header for agents */}
      {empresa?.logoUrl && (
        <header className="sticky top-0 z-20 bg-background border-b border-border px-4 py-2">
          <div className="flex items-center justify-center h-12">
            <img 
              src={empresa.logoUrl} 
              alt={empresa.nome} 
              className="h-full max-h-12 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </header>
      )}

      {/* Alert Ribbon */}
      <AlertRibbon />

      <main className="max-w-2xl mx-auto">
        {children}
      </main>
      <BottomNav />
      <SyncIndicator />
    </div>
  );
}
