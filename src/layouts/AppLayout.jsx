import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "@tanstack/react-router";
import Sidebar from "../components/sidebar/Sidebar";
import Topbar from "../components/navbar/Topbar";
import { useAuth } from "../context/AuthContext";

export default function AppLayout() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/login" });
  }, [ready, user, navigate]);

  if (!ready) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onToggleSidebar={() => setOpen((s) => !s)} />
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
