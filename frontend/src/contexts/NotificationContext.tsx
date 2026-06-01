// src/contexts/NotificationContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import {
  registerServiceWorker,
  requestNotificationPermission,
  showDesktopNotification,
} from "@/lib/notifications";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

// Map backend entity names to React Query keys for cache invalidation
const ENTITY_TO_QUERY_KEY: Record<string, string[]> = {
  // HR
  assets: ["assets", "assetStats"],
  assetCategories: ["assetCategories", "assetCategoryStats"],
  employees: ["employees", "employeeStats"],
  leaves: ["leaves", "leaveStats", "leaveBalances"],
  shiftTemplates: ["shiftTemplates"],
  shiftOverrides: ["shiftOverrides", "resolvedShifts", "shiftStatistics"],
  shiftDateRange: ["shiftDateRange", "resolvedShifts", "shiftStatistics"],
  payroll: ["payroll", "payrollStats"],
  recruitment: ["recruitment", "recruitmentStats"],
  exitRecords: ["exitRecords", "exitMetrics"],
  policies: ["policies"],
  compensations: ["compensations"],
  loans: ["loans"],

  // Inventory – exact matches (sent from backend)
  inventory_category: ["inventory_category"],
  inventory_brand: ["inventory_brand"],
  inventory_warehouse: ["inventory_warehouse"],
  inventory_product: ["inventory_product"],
  inventory_supplier: ["inventory_supplier"],
  inventory_variant: ["inventory_variant"],
  inventory_stock: ["inventory_stock"],
  inventory_sales_order: ["inventory_sales_order"],
  inventory_stock_transfer: ["inventory_stock_transfer"],

  // Inventory – alias keys for convenience (optional)
  product: ["inventory_product"],
  inventory: ["inventory_product"],
  supplier: ["inventory_supplier"],
  vendor: ["inventory_supplier"],
  variant: ["inventory_variant"],
  stock: ["inventory_stock"],
  sales_order: ["inventory_sales_order"],
  sales_return: ["inventory_sales_order"],
  stock_transfer: ["inventory_stock_transfer"],
  inventory_purchase_order: ["inventory_purchase_order"],

  // Company & settings
  company: ["company_settings"],
  branch: ["branch"],
  user: ["users", "user"],
  company_settings: ["companySettings"],
  designation: ["designation", "companySettings"],
};

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  read_at: string | null;
  is_favourite: boolean;
  created_at: string;
  notification_type: string;
}

interface PaginatedNotificationsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Notification[];
}

interface NotificationContextProps {
  notifications: Notification[];
  isConnected: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  toggleFavourite: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextProps>({
  notifications: [],
  isConnected: false,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  toggleFavourite: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const user = useSelector((state: RootState) => state.auth.user);

  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const api = useApi();
  const queryClient = useQueryClient();

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api<PaginatedNotificationsResponse>("/api/notifications/");
      setNotifications(data.results || []);
    } catch (e) {
      console.error("Error fetching notifications", e);
    }
  }, [api]);

  // Register service worker and request permission on mount
  useEffect(() => {
    registerServiceWorker();
    requestNotificationPermission();
  }, []);

  // WebSocket connection with exponential backoff
  const connectSocket = useCallback(
    async (retryCount = 0) => {
      const companyId = user?.companyId;
      const branchId = user?.branchId;
      if (!companyId || !branchId) {
        console.warn(
          "[NotificationContext] Missing company or branch ID – waiting for user data. Retry will happen when user loads."
        );
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        console.error(
          "[NotificationContext] NEXT_PUBLIC_API_URL is not defined. WebSocket will not connect."
        );
        return;
      }

      await fetchNotifications();

      const wsUrl = apiUrl.replace(/^http/, "ws") + `/ws/notifications/${companyId}/${branchId}/`;
      console.log(`[NotificationContext] Connecting to ${wsUrl} (attempt ${retryCount + 1})`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[NotificationContext] WebSocket opened");
        setIsConnected(true);
        reconnectTimeoutRef.current && clearTimeout(reconnectTimeoutRef.current);

        // Start heartbeat
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "ping" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "notification") {
            setNotifications((prev) => {
              if (data.id && prev.find((n) => n.id === data.id)) return prev;
              const newNotif = {
                id: data.id || Date.now().toString(),
                title: data.title,
                message: data.message,
                is_read: false,
                read_at: null,
                is_favourite: false,
                created_at: data.created_at || new Date().toISOString(),
                notification_type: data.notification_type,
              };
              return [newNotif, ...prev];
            });

            showDesktopNotification(data.title || "New Notification", {
              body: data.message,
              data: { notificationId: data.id },
            });
          } else if (data.type === "data_update") {
            const { entity, action, record_id } = data;
            const queryKeys = ENTITY_TO_QUERY_KEY[entity];
            if (queryKeys) {
              queryKeys.forEach((key) => {
                queryClient.invalidateQueries({ queryKey: [key] });
              });
            }
          }
        } catch (e) {
          console.error("[NotificationContext] Error parsing websocket message", e);
        }
      };

      ws.onclose = (event) => {
        if (!wsRef.current) return;
        console.warn(`[NotificationContext] Closed (code ${event.code}). Reconnecting...`);
        setIsConnected(false);
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectSocket(retryCount + 1);
        }, delay);
      };

      ws.onerror = (error) => {
        console.error("[NotificationContext] WebSocket error:", error);
        ws.close(); // trigger reconnect
      };
    },
    [api, fetchNotifications, queryClient, user?.companyId, user?.branchId]
  );

  useEffect(() => {
    connectSocket();
    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectSocket]);

  // Fallback polling when WebSocket is disconnected (optional)
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    if (!isConnected) {
      pollInterval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
        queryClient.invalidateQueries({ queryKey: ["currentStock"] });
      }, 30000);
    }
    return () => clearInterval(pollInterval);
  }, [isConnected, queryClient]);

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await api(`/api/notifications/${id}/mark_read/`, { method: "POST" });
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
          )
        );
      } catch (e) {
        console.error("Error marking notification as read", e);
      }
    },
    [api]
  );

  const markAllAsRead = useCallback(async () => {
    try {
      await api("/api/notifications/mark_all_read/", { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at || new Date().toISOString() }))
      );
    } catch (e) {
      console.error("Error marking all notifications as read", e);
    }
  }, [api]);

  const toggleFavourite = useCallback(
    async (id: string) => {
      try {
        const res = await api<{ is_favourite: boolean }>(`/api/notifications/${id}/toggle_favourite/`, {
          method: "POST",
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_favourite: res.is_favourite } : n))
        );
      } catch (e) {
        console.error("Error toggling favourite", e);
      }
    },
    [api]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        isConnected,
        markAsRead,
        markAllAsRead,
        toggleFavourite,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};