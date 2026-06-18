// src/hooks/useNotificationsApi.ts
"use client";
import { useCallback, useMemo } from "react";
import { useApi } from "@/hooks/useApi";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------
export interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  read_at: string | null;
  is_favourite: boolean;
  created_at: string;
  notification_type: string;
}

export interface PaginatedNotificationsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Notification[];
}

/**
 * Hook providing notification CRUD operations
 * Returns functions to fetch, mark as read, mark all as read, and toggle favourite
 */
export function useNotificationsApi() {
  const api = useApi();

  const fetchNotifications = useCallback(async (): Promise<Notification[]> => {
    const data = await api<PaginatedNotificationsResponse>("/api/notifications/");
    return data.results || [];
  }, [api]);

  const markAsRead = useCallback(async (id: string): Promise<void> => {
    await api(`/api/notifications/${id}/mark_read/`, { method: "POST" });
  }, [api]);

  const markAllAsRead = useCallback(async (): Promise<void> => {
    await api("/api/notifications/mark_all_read/", { method: "POST" });
  }, [api]);

  const toggleFavourite = useCallback(async (id: string): Promise<{ is_favourite: boolean }> => {
    return api<{ is_favourite: boolean }>(`/api/notifications/${id}/toggle_favourite/`, {
      method: "POST",
    });
  }, [api]);

  return useMemo(
    () => ({ fetchNotifications, markAsRead, markAllAsRead, toggleFavourite }),
    [fetchNotifications, markAsRead, markAllAsRead, toggleFavourite],
  );
}
