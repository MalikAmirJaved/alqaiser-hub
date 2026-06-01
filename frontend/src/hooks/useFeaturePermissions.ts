"use client";

import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useAuth } from "@/hooks/useAuth";
import { getPermissions, PermissionActions } from "@/lib/permissions";

/**
 * Custom hook to get permission actions for a specific module and feature.
 * Automatically grants full access if the current user is a COMPANY_ADMIN.
 */
export function useFeaturePermissions(module: string, feature: string): PermissionActions {
  const { user } = useAuth();
  const permissions = useSelector(
    (state: RootState) => state.permissions.permissions
  );

  const isCompanyAdmin = user?.role === "COMPANY_ADMIN";

  const rawPermissions = getPermissions(permissions, module, feature);

  if (isCompanyAdmin) {
    return {
      view: true,
      create: true,
      update: true,
      delete: true,
      export: true,
      approve: true,
      reject: true,
      assign: true,
      publish: true,
      archive: true,
    };
  }

  return rawPermissions;
}
