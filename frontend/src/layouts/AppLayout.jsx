"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import Topbar from "@/components/navbar/Topbar";
import { useAuth } from "@/hooks/useAuth";
import { useCompanySettingsQuery } from "@/hooks/useCompanySettings";
import CompanySetupModal from "@/components/CompanySetupModal";
import { companyContext } from "@/services/companyContextService";
import { permissionService } from "@/services/permissionService";

export default function AppLayout({ children }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const { data: settings } = useCompanySettingsQuery();

  useEffect(() => {
    async function initializeContext() {
      if (ready && user) {
        // Initialize company context and permissions from backend
        await companyContext.init();
        await permissionService.init();
        setContextReady(true);
      }
    }
    
    initializeContext();
  }, [ready, user]);

  useEffect(() => {
    if (ready && !user) router.push("/login");
  }, [ready, user, router]);

  if (!ready || !contextReady) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading workspace...</p>
        </div>
      </div>
    );
  }
  
  if (!user) return null;

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