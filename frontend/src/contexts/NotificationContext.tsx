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
  inventory_category: ["categories"],
  inventory_brand: ["brands"],
  inventory_warehouse: ["warehouses", "warehouseStats"],
  product: ["products", "productStats"],
  inventory: ["inventory", "productInventory"],
  tags: ["tags"],
  supplier: ["suppliers", "supplierStats"],
  vendor: ["vendors", "vendorStats"],
  variant: ["allVariantsSimple", "allVariants", "variantStock", "batchStock"],
  stock: ["batchStock", "currentStock", "variantStock"],
  sales_order: ["salesOrders"], // ✅ CRITICAL: now sales orders will invalidate
  sales_return: ["salesReturns"],
  stock_transfer: ["stockTransfers"],
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
  const reconnectTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const heartbeatIntervalRef =
    useRef<ReturnType<typeof setInterval> | null>(null);
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
      console.log("  :: ", user)
      const companyId = user?.companyId;
      const branchId = user?.branchId;

      if (!companyId || !branchId) {
        console.warn("Missing company or branch ID, cannot open WebSocket");
        return;
      }

      await fetchNotifications();

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const wsUrl = apiUrl.replace(/^http/, "ws") + `/ws/notifications/${companyId}/${branchId}/`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Reset retry count on successful connection
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
          console.error("Error parsing websocket message", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        // Exponential backoff: 2^retryCount * 1000 ms, capped at 30 seconds
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectSocket(retryCount + 1);
        }, delay);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    },
    [api, fetchNotifications, queryClient]
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
        // Refresh critical data every 30 seconds when offline
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