/**
 * hooks/useFeaturePermissions.ts
 *
 * Returns the full PermissionActions map for a given module + resource.
 * COMPANY_ADMIN short-circuits to all-true.
 *
 * Usage:
 *   const p = useFeaturePermissions("HR", "employee");
 *   if (p.create)              { ... }   // standard action
 *   if (p.activate)            { ... }   // custom action
 *   if (p.view_compensation)   { ... }   // fine-grained finance action
 */
"use client";

import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useAuth } from "@/hooks/useAuth";
import { getPermissions, PermissionActions, PERMISSIONS } from "@/lib/permissions";

export function useFeaturePermissions(module: string, resource: string): PermissionActions {
  const { user } = useAuth();
  const permissions = useSelector((state: RootState) => state.permissions.permissions);

  // COMPANY_ADMIN always gets everything — build the full map from the registry
  if (user?.role === "COMPANY_ADMIN") {
    const moduleRegistry = (PERMISSIONS as Record<string, Record<string, readonly string[]>>)[module];
    if (!moduleRegistry) return {};
    const actions = moduleRegistry[resource];
    if (!actions) return {};
    return Object.fromEntries(actions.map(a => [a, true]));
  }

  return getPermissions(permissions, module, resource);
}

/**
 * One-shot boolean hook.
 *
 * Usage:
 *   const canPaySalary = useHasPermission("HR:payroll:pay_salary");
 */
export function useHasPermission(code: string): boolean {
  const { user } = useAuth();
  const permissions = useSelector((state: RootState) => state.permissions.permissions);

  if (user?.role === "COMPANY_ADMIN") return true;
  return permissions.includes(code);
}

/**
 * Returns true if the user holds ALL of the provided codes.
 */
export function useHasAllPermissions(codes: string[]): boolean {
  const { user } = useAuth();
  const permissions = useSelector((state: RootState) => state.permissions.permissions);

  if (user?.role === "COMPANY_ADMIN") return true;
  return codes.every(c => permissions.includes(c));
}

/**
 * Returns true if the user holds ANY of the provided codes.
 */
export function useHasAnyPermission(codes: string[]): boolean {
  const { user } = useAuth();
  const permissions = useSelector((state: RootState) => state.permissions.permissions);

  if (user?.role === "COMPANY_ADMIN") return true;
  return codes.some(c => permissions.includes(c));
}