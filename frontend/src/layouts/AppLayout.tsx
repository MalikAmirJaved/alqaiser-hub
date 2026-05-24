"use client";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import Topbar from "@/components/navbar/Topbar";
import { useAuth } from "@/hooks/useAuth";
import CompanySetupModal from "@/components/CompanySetupModal";
import { loadPermissions } from "@/store/slices/permissionSlice";
import { loadCompanySettings } from "@/store/slices/companySettingsSlice";
import type { AppDispatch, RootState } from "@/store";

export default function AppLayout({ children }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const [open, setOpen] = useState(false);
  
  const { initialized: permissionsInitialized } = useSelector((state: RootState) => state.permissions);
  const { initialized: settingsInitialized, data: settings } = useSelector((state: RootState) => state.companySettings);

  // Load permissions and company settings after user is ready
  useEffect(() => {
    if (ready && user) {
      if (!permissionsInitialized) {
        dispatch(loadPermissions());
      }
      if (!settingsInitialized) {
        dispatch(loadCompanySettings());
      }
    }
  }, [ready, user, permissionsInitialized, settingsInitialized, dispatch]);

  useEffect(() => {
    if (ready && !user) router.push("/login");
  }, [ready, user, router]);

  if (!ready || !permissionsInitialized || !settingsInitialized) {
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
      <div className="h-screen overflow-y-hidden flex bg-background text-foreground">
        <Sidebar open={open} onClose={() => setOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar onToggleSidebar={() => setOpen((s) => !s)} />
          <main className="flex-1 p-4 sm:p-6 w-full overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}