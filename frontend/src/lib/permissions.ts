// lib/permissions.ts
import { store } from "@/store";

/**
 * Get all actions for a module + feature
 * Example: getPermissions("HR", "employee")
 */
export function getPermissions(module: string, feature: string) {
  const state = store.getState();
  const permissions = state.permissions.permissions || [];

  const prefix = `${module}:${feature}:`;

  return permissions
    .filter((p) => p.startsWith(prefix))
    .reduce((acc, permission) => {
      const action = permission.split(":")[2];
      acc[action] = true;
      return acc;
    }, {} as Record<string, boolean>);
}