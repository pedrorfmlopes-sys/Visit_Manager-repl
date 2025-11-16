import { Link, useLocation } from "wouter";
import { LayoutDashboard, Building2, Users, FileText, CheckCircle2, QrCode } from "lucide-react";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/entidades", icon: Building2, label: "Entidades" },
  { path: "/qr", icon: QrCode, label: "QR" },
  { path: "/visitas", icon: FileText, label: "Visitas" },
  { path: "/tarefas", icon: CheckCircle2, label: "Tarefas" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-card-border z-50 safe-area-inset-bottom">
      <div className="h-full flex items-center justify-around max-w-2xl mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
          
          return (
            <Link
              key={item.path}
              href={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <div className={`flex flex-col items-center gap-1 px-4 py-2 rounded-md transition-colors ${
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover-elevate"
              }`}>
                <Icon className="h-6 w-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
