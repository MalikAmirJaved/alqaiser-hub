// components/AppLayout.tsx
"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import Topbar from "@/components/navbar/Topbar";
import { useAuth } from "@/hooks/useAuth";
import { loadPermissions } from "@/store/slices/permissionSlice";
import { loadCompanySettings } from "@/store/slices/companySettingsSlice";
import type { AppDispatch, RootState } from "@/store";
import { publicRoutes, getRequiredPermission } from "@/config/routePermissions";
import { usePermissionSocket } from "@/hooks/usePermissions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();
  const [open, setOpen] = useState(false);
  
  const { initialized: permissionsInitialized, permissions } = useSelector((state: RootState) => state.permissions);
  const { initialized: settingsInitialized } = useSelector((state: RootState) => state.companySettings);

  usePermissionSocket(user?.id);

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

  // Route protection based on permissions
  useEffect(() => {
    if (ready && user && permissionsInitialized && pathname) {
      // Skip public routes
      if (publicRoutes.includes(pathname)) return;
      
      const requiredPerm = getRequiredPermission(pathname);
      if (requiredPerm) {
        const hasAccess = permissions.some(p => p.toLowerCase() === requiredPerm.toLowerCase());
        if (!hasAccess) {
          router.replace("/unauthorized");
        }
      }
    }
  }, [ready, user, permissionsInitialized, pathname, permissions, router]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (ready && !user && !publicRoutes.includes(pathname)) {
      router.push("/login");
    }
  }, [ready, user, pathname, router]);

  // Loading state
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

  // If user is not authenticated and route is not public, redirect already happened
  if (!user) return null;

  return (
    <div className="h-screen overflow-y-hidden flex bg-background text-foreground">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onToggleSidebar={() => setOpen((s) => !s)} />
        <main className="flex-1 p-4 sm:p-6 w-full overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}