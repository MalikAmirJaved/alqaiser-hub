// hooks/usePermissions.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useEffect, useRef, useCallback } from "react";
import { useDispatch } from "react-redux";
import { loadPermissions } from "@/store/slices/permissionSlice";
import { AppDispatch } from "@/store";

// ─────────────────────────────────────────────────────────────
// Types (unchanged)
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
// Query Keys (unchanged)
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
// Hooks (unchanged)
// ─────────────────────────────────────────────────────────────

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

export function useUserRoles(userId: number | null) {
  const api = useApi();
  return useQuery<UserRole[]>({
    queryKey: permissionKeys.userRoles(userId!),
    queryFn: () => api<UserRole[]>(`/api/permissions/users/${userId}/roles/`),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useUserOverrides(userId: number | null) {
  const api = useApi();
  return useQuery<UserPermissionOverride[]>({
    queryKey: permissionKeys.userOverrides(userId!),
    queryFn: () => api<UserPermissionOverride[]>(`/api/permissions/users/${userId}/overrides/`),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useRoles() {
  const api = useApi();
  return useQuery<Role[]>({
    queryKey: permissionKeys.roles(),
    queryFn: () => api<Role[]>("/api/permissions/roles/"),
    staleTime: 5 * 60_000,
  });
}

// ─────────────────────────────────────────────────────────────
// Mutations (unchanged)
// ─────────────────────────────────────────────────────────────

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
// FIXED WebSocket Hook — connects to BACKEND, not frontend
// ─────────────────────────────────────────────────────────────

type WsMessage =
  | { type: "permission_changed"; user_id: number }
  | { type: "role_changed"; user_id: number }
  | { type: "self_permission_changed" };

/**
 * usePermissionSocket
 *
 * Connects to the Django Channels WebSocket endpoint (via NEXT_PUBLIC_API_URL)
 * and automatically invalidates React Query cache + Redux store when a change occurs.
 *
 * Backend endpoint: ws://<BACKEND_HOST>/ws/permissions/
 */
// hooks/usePermissions.ts (only the usePermissionSocket function)

export function usePermissionSocket(watchedUserId?: number | null) {
  const queryClient = useQueryClient();
  const dispatch = useDispatch<AppDispatch>();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Helper to reload permissions for the current user
  const reloadCurrentUserPermissions = useCallback(() => {
    if (mountedRef.current && watchedUserId) {
      dispatch(loadPermissions());
    }
  }, [dispatch, watchedUserId]);

  const connect = useCallback(
    (retryCount = 0) => {
      if (!mountedRef.current) return;
      if (!watchedUserId && !(typeof window !== 'undefined' && document.cookie.includes('access_token'))) {
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        console.error("[usePermissionSocket] NEXT_PUBLIC_API_URL is not defined.");
        return;
      }

      const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws/permissions/";

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectTimerRef.current && clearTimeout(reconnectTimerRef.current);

        // ✅ Reload permissions immediately after reconnect
        reloadCurrentUserPermissions();

        // ✅ Start heartbeat (keep connection alive)
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);

          switch (msg.type) {
            case "permission_changed":
            case "role_changed":
              queryClient.invalidateQueries({ queryKey: permissionKeys.userModules(msg.user_id) });
              queryClient.invalidateQueries({ queryKey: permissionKeys.userRoles(msg.user_id) });
              queryClient.invalidateQueries({ queryKey: permissionKeys.userOverrides(msg.user_id) });

              if (watchedUserId && msg.user_id === watchedUserId) {
                reloadCurrentUserPermissions();
              }
              break;

            case "self_permission_changed":
              reloadCurrentUserPermissions();
              break;

            default:
              break;
          }
        } catch (err) {
          console.error("[usePermissionSocket] Failed to parse message", err);
        }
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        console.warn(`[usePermissionSocket] Closed (code ${event.code}). Reconnecting...`);
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        reconnectTimerRef.current = setTimeout(() => connect(retryCount + 1), delay);
      };

      ws.onerror = (err) => {
        console.error("[usePermissionSocket] Error", err);
        ws.close();
      };
    },
    [queryClient, dispatch, watchedUserId, reloadCurrentUserPermissions]
  );

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}