"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import Topbar from "@/components/navbar/Topbar";
import { useAuth } from "@/context/AuthContext";
import { useCompanySettingsQuery } from "@/hooks/useCompanySettings";
import CompanySetupModal from "@/components/CompanySetupModal";

export default function AppLayout({ children }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: settings } = useCompanySettingsQuery();

  useEffect(() => {
    if (ready && !user) router.push("/login");
  }, [ready, user, router]);

  if (!ready) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!user) return null;

  // If company admin and setup not completed → show modal
  const showSetupModal =
    user.role === "COMPANY_ADMIN" &&
    settings &&
    !settings.isSetupCompleted;

  return (
    <>
      {showSetupModal && <CompanySetupModal />}
      <div className="min-h-screen flex bg-background text-foreground">
        <Sidebar open={open} onClose={() => setOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar onToggleSidebar={() => setOpen((s) => !s)} />
          <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}