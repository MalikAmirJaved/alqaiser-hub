// hooks/usePermissions.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useEffect, useRef, useCallback } from "react";
import { useDispatch } from "react-redux";
import { loadPermissions } from "@/store/slices/permissionSlice";
import { AppDispatch } from "@/store";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface PermissionUser {
  id: number;
  _id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  department: string | null;
  designation: string | null;
  is_active: boolean;
  role: string;
}

export interface ActionNode {
  code: string;
  name: string;
  granted: boolean;
}

export interface ResourceNode {
  code: string;
  name: string;
  actions: ActionNode[];
}

export interface ModuleNode {
  code: string;
  name: string;
  resources: ResourceNode[];
}

export interface UserRole {
  id: number;
  role: {
    id: number;
    name: string;
    description: string;
    is_system: boolean;
  };
  assigned_at: string;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  is_system: boolean;
  permission_count?: number;
}

export interface UserPermissionOverride {
  id: number;
  permission: {
    id: number;
    code: string;
    description: string;
  };
  granted: boolean;
  reason: string;
  expires_at: string | null;
  created_at: string;
  granted_by: {
    id: number;
    username: string;
  } | null;
}

export interface BulkPermissionPayload {
  user_id: number;
  permissions: {
    permission_code: string;
    granted: boolean;
    reason?: string;
  }[];
}

export interface AssignRolePayload {
  user_id: number;
  role_id: number;
}

// ─────────────────────────────────────────────────────────────
// Query Keys
// ─────────────────────────────────────────────────────────────

export const permissionKeys = {
  all: ["permissions"] as const,
  users: () => [...permissionKeys.all, "users"] as const,
  userModules: (userId: number) => [...permissionKeys.all, "user-modules", userId] as const,
  userRoles: (userId: number) => [...permissionKeys.all, "user-roles", userId] as const,
  userOverrides: (userId: number) => [...permissionKeys.all, "user-overrides", userId] as const,
  roles: () => [...permissionKeys.all, "roles"] as const,
  modules: () => [...permissionKeys.all, "modules"] as const,
};

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

/** All users in the current company (for the left panel list) */
export function usePermissionUsers() {
  const api = useApi();
  return useQuery<PermissionUser[]>({
    queryKey: permissionKeys.users(),
    queryFn: () => api<PermissionUser[]>("/api/organization/users/"),
    select: (res: any) => res.results,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });
}

/** Full module → resource → action tree for a specific user with granted flags */
export function useUserModules(userId: number | null) {
  const api = useApi();
  return useQuery<ModuleNode[]>({
    queryKey: permissionKeys.userModules(userId!),
    queryFn: () => api<ModuleNode[]>(`/api/permissions/modules/?user_id=${userId}`),
    enabled: !!userId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });
}

/** Roles assigned to a user */
export function useUserRoles(userId: number | null) {
  const api = useApi();
  return useQuery<UserRole[]>({
    queryKey: permissionKeys.userRoles(userId!),
    queryFn: () => api<UserRole[]>(`/api/permissions/users/${userId}/roles/`),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** User-specific permission overrides */
export function useUserOverrides(userId: number | null) {
  const api = useApi();
  return useQuery<UserPermissionOverride[]>({
    queryKey: permissionKeys.userOverrides(userId!),
    queryFn: () => api<UserPermissionOverride[]>(`/api/permissions/users/${userId}/overrides/`),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** All available roles */
export function useRoles() {
  const api = useApi();
  return useQuery<Role[]>({
    queryKey: permissionKeys.roles(),
    queryFn: () => api<Role[]>("/api/permissions/roles/"),
    staleTime: 5 * 60_000,
  });
}

// ─────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────

/** Bulk set permission overrides for a user */
export function useBulkSetPermissions() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BulkPermissionPayload) =>
      api(`/api/permissions/users/${payload.user_id}/bulk-override/`, {
        method: "POST",
        body: JSON.stringify({ permissions: payload.permissions }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.userModules(variables.user_id) });
      queryClient.invalidateQueries({ queryKey: permissionKeys.userOverrides(variables.user_id) });
    },
  });
}

/** Assign a role to a user */
export function useAssignRole() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AssignRolePayload) =>
      api(`/api/permissions/users/${payload.user_id}/assign-role/`, {
        method: "POST",
        body: JSON.stringify({ role_id: payload.role_id }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.userRoles(variables.user_id) });
      queryClient.invalidateQueries({ queryKey: permissionKeys.userModules(variables.user_id) });
    },
  });
}

/** Remove a role from a user */
export function useRemoveRole() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number }) =>
      api(`/api/permissions/users/${userId}/remove-role/${roleId}/`, {
        method: "DELETE",
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.userRoles(variables.userId) });
      queryClient.invalidateQueries({ queryKey: permissionKeys.userModules(variables.userId) });
    },
  });
}

/** Remove a specific user override */
export function useRemoveOverride() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, overrideId }: { userId: number; overrideId: number }) =>
      api(`/api/permissions/users/${userId}/overrides/${overrideId}/`, {
        method: "DELETE",
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.userOverrides(variables.userId) });
      queryClient.invalidateQueries({ queryKey: permissionKeys.userModules(variables.userId) });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// WebSocket Hook — real-time permission invalidation
// ─────────────────────────────────────────────────────────────

type WsMessage =
  | { type: "permission_changed"; user_id: number }
  | { type: "role_changed"; user_id: number }
  | { type: "self_permission_changed" };

/**
 * usePermissionSocket
 *
 * Connects to the Django Channels WebSocket endpoint and automatically
 * invalidates React Query cache when the server pushes a change event.
 *
 * Also re-dispatches loadPermissions so the Redux store (used by Sidebar)
 * updates in real time without a page refresh.
 *
 * Backend endpoint: ws://<host>/ws/permissions/
 * Expected message shape: { type: "permission_changed", user_id: 42 }
 *
 * Django Channels consumer should be placed at:
 *   consumers/permission_consumer.py  (see companion file)
 */
export function usePermissionSocket(watchedUserId?: number | null) {
  const queryClient = useQueryClient();
  const dispatch = useDispatch<AppDispatch>();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/permissions/`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);

        switch (msg.type) {
          case "permission_changed":
          case "role_changed":
            // Invalidate the specific user's data
            queryClient.invalidateQueries({ queryKey: permissionKeys.userModules(msg.user_id) });
            queryClient.invalidateQueries({ queryKey: permissionKeys.userRoles(msg.user_id) });
            queryClient.invalidateQueries({ queryKey: permissionKeys.userOverrides(msg.user_id) });

            // If it is the watched user in the UI panel, also invalidate the panel
            if (watchedUserId && msg.user_id === watchedUserId) {
              queryClient.invalidateQueries({ queryKey: permissionKeys.userModules(watchedUserId) });
            }
            break;

          case "self_permission_changed":
            // Re-load the current user's own permissions into Redux (updates Sidebar, etc.)
            dispatch(loadPermissions());
            break;

          default:
            break;
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      // Exponential back-off reconnect (max 30 s)
      reconnectTimerRef.current = setTimeout(connect, Math.min(30_000, 3_000));
    };

    ws.onerror = () => ws.close();
  }, [queryClient, dispatch, watchedUserId]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}