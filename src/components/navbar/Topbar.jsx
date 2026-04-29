import { Bell, Menu, Moon, Search, Sun, LogOut } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "@tanstack/react-router";

export default function Topbar({ onToggleSidebar }) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b border-border">
      <div className="flex items-center gap-3 px-4 h-14">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-md hover:bg-muted"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search modules, records..."
            className="w-full bg-muted/60 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button onClick={toggle} className="p-2 rounded-md hover:bg-muted" aria-label="Theme">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button className="p-2 rounded-md hover:bg-muted relative" aria-label="Notifications">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
        </button>

        <div className="hidden sm:flex flex-col items-end leading-tight">
          <span className="text-sm font-medium">{user?.name || "User"}</span>
          <span className="text-[11px] text-muted-foreground">{user?.role || "—"}</span>
        </div>
        <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-semibold">
          {(user?.name || "U").charAt(0)}
        </div>
        <button onClick={handleLogout} className="p-2 rounded-md hover:bg-muted" aria-label="Logout">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
