import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Layers, GitFork, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/themes", label: "Themes", icon: Layers },
  { to: "/tensions", label: "Tensions", icon: GitFork },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/admin", label: "Admin", icon: Settings },
];

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Top navigation */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center gap-1">
          {/* Logo / brand */}
          <span className="mr-6 text-lg font-bold tracking-tight text-primary">
            Trend Radar
          </span>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
