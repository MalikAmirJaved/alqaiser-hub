"use client";

import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useAuth } from "@/hooks/useAuth";
import { usePathname } from "next/navigation";
import { getRequiredPermission } from "@/config/routePermissions";
import { ShieldAlert } from "lucide-react";

/**
 * Reusable permission guard that handles route protection automatically.
 * Displays a premium in-place Access Denied state under the active layout.
 */
export default function ModulePermissionGuard({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const pathname = usePathname() || "";
  
  const { initialized: permissionsInitialized, permissions } = useSelector(
    (state: RootState) => state.permissions
  );

  // Show loading spinner while authenticating or loading permissions
  if (!ready || !permissionsInitialized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Company Admins bypass all module permission restrictions
  if (user?.role === "COMPANY_ADMIN") {
    return <>{children}</>;
  }

  const requiredPerm = getRequiredPermission(pathname);

  if (requiredPerm) {
    const hasAccess = permissions.some(
      (p) => p.toLowerCase() === requiredPerm.toLowerCase()
    );

    if (!hasAccess) {
      return (
        <div className="flex items-center justify-center min-h-[450px] p-4">
          <div className="text-center max-w-md p-8 bg-card border border-border/80 rounded-2xl shadow-xl space-y-6 relative overflow-hidden">
            {/* Elegant glassmorphism styling card overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 via-transparent to-transparent pointer-events-none" />
            
            <div className="flex justify-center relative">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/20 shadow-inner">
                <ShieldAlert className="w-10 h-10 text-destructive animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Access Denied</h1>
              <p className="text-sm text-muted-foreground">
                You do not have the required permissions to view this section.
              </p>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                If you believe this is an error, please contact your workspace administrator.
              </p>
            </div>
            
            <div className="pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground font-mono bg-muted border border-border/60 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                Required: {requiredPerm}
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
