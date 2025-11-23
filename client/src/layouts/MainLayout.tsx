import { ReactNode } from "react";
import { useLocation } from "wouter";
import { AdminSidebar } from "@/components/AdminSidebar";
import { BottomNav } from "@/components/BottomNav";
import { FABMenu } from "@/components/FABMenu";
import { SyncIndicator } from "@/components/SyncIndicator";
import { useAuth } from "@/hooks/useAuth";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isAdmin, empresa } = useAuth();
  const [location] = useLocation();
  
  // Agent pages where FAB should appear
  const agentMainPages = ["/", "/visitas", "/tarefas"];
  const showFAB = !isAdmin && agentMainPages.some(page => location === page || location.startsWith(page + "/"));

  if (isAdmin) {
    return (
      <div className="flex h-screen bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col overflow-hidden ml-64">
          {/* Admin header with logo */}
          {empresa?.logoUrl && (
            <header className="sticky top-0 z-20 bg-background border-b border-border px-6 py-3 hidden lg:block">
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
          )}
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
      <main className="max-w-2xl mx-auto">
        {children}
      </main>
      {showFAB && <FABMenu />}
      <BottomNav />
      <SyncIndicator />
    </div>
  );
}
