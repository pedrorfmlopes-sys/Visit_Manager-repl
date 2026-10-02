import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminTopBar } from "@/components/AdminTopBar";
import { BottomNav } from "@/components/BottomNav";
import { TabletNavRail } from "@/components/TabletNavRail";
import { useViewportMode } from "@/hooks/use-mobile";
import {ContactAccessNotice} from '@/components/ContactAccessNotice';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const viewportMode = useViewportMode();

  return (
    <div className="flex h-screen bg-background">
      {viewportMode === "desktop" && <AdminSidebar />}
      {viewportMode === "tablet" && <TabletNavRail />}

      <div
        className="flex min-w-0 flex-1 flex-col overflow-hidden md:ml-24 xl:ml-64"
        data-testid="app-content-shell"
      >
        {viewportMode === "mobile" && <AdminTopBar />}

        <main
          className="flex-1 overflow-y-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0"
          data-testid="app-main-content"
        >
          <ContactAccessNotice />
          {children}
        </main>
      </div>

      {viewportMode === "mobile" && <BottomNav />}
    </div>
  );
}
