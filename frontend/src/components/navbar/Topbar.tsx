
"use client";

import { Bell, Menu, Moon, Search, Sun, LogOut, Check, Star, CheckCheck } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { toggleTheme } from "@/store/slices/themeSlice";
import { RootState } from "@/store";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/contexts/NotificationContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";

export default function Topbar({ onToggleSidebar }) {
  const theme = useSelector((state: RootState) => state.theme.theme);
  const dispatch = useDispatch();
  const toggle = () => dispatch(toggleTheme());
  const { user, logout } = useAuth();
  const { notifications, markAsRead, markAllAsRead, toggleFavourite } = useNotifications();

  const handleLogout = () => {
    logout();
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="sticky top-0 z-30 bg-card/80 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between px-4 h-14 gap-3">

        {/* LEFT SIDE */}
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-md hover:bg-muted"
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
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-2">

          <button onClick={toggle} className="p-2 rounded-md hover:bg-muted">
            {theme === "dark"
              ? <Sun className="w-4 h-4" />
              : <Moon className="w-4 h-4" />}
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button className="p-2 rounded-md hover:bg-muted relative">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <span className="font-semibold text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <button 
                    onClick={() => markAllAsRead()}
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No notifications
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`p-3 border-b last:border-0 flex gap-3 group transition-colors ${notif.is_read ? 'bg-background' : 'bg-muted/30'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className={`text-sm font-medium truncate ${notif.is_read ? 'text-foreground/80' : 'text-foreground'}`}>
                            {notif.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {notif.created_at ? formatDistanceToNow(new Date(notif.created_at), { addSuffix: true }) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notif.message}
                        </p>
                        {notif.read_at && (
                          <p className="text-[10px] text-muted-foreground mt-1 opacity-70">
                            Read at: {new Date(notif.read_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => toggleFavourite(notif.id)}
                          className="p-1 rounded hover:bg-muted"
                          title="Favourite"
                        >
                          <Star className={`w-3.5 h-3.5 ${notif.is_favourite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                        </button>
                        {!notif.is_read && (
                          <button 
                            onClick={() => markAsRead(notif.id)}
                            className="p-1 rounded hover:bg-muted"
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5 text-primary" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <div className="hidden sm:flex flex-col items-end leading-tight ml-2">
            <span className="text-sm font-medium">{user?.username }</span>
            <span className="text-[11px] text-muted-foreground">{user?.role || "—"}</span>
          </div>

          <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-semibold ml-2">
            {(user?.username || "U").charAt(0).toUpperCase()}
          </div>

          <button onClick={handleLogout} className="p-2 rounded-md hover:bg-muted ml-1">
            <LogOut className="w-4 h-4" />
          </button>

        </div>
      </div>
    </header>
  );
}

