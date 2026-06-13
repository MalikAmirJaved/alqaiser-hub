"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { companyContext } from "@/services/companyContextService";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import {
  registerServiceWorker,
  requestNotificationPermission,
  showDesktopNotification,
} from "@/lib/notifications";

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

};

interface NotificationContextProps {
  notifications: any[];
  isConnected: boolean;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  toggleFavourite: (id: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextProps>({
  notifications: [],
  isConnected: false,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  toggleFavourite: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const api = useApi();
  const queryClient = useQueryClient();

  const fetchNotifications = async () => {
    try {
      const data = await api<any[]>("/api/notifications/");
      setNotifications(data);
    } catch (e) {
      console.error("Error fetching notifications", e);
    }
  };

  // Register service worker and request permission on mount
  useEffect(() => {
    registerServiceWorker();
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let ws: WebSocket;

    const connectSocket = async () => {
      if (!companyContext.initialized) {
        await companyContext.init();
      }

      const companyId = companyContext.getCurrentCompanyId();
      const branchId = companyContext.getCurrentBranchId();

      if (!companyId || !branchId) return;

      await fetchNotifications();

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      const wsUrl =
        apiUrl.replace(/^http/, "ws") +
        `/ws/notifications/${companyId}/${branchId}/`;

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle notification messages
          if (data.type === "notification") {
            setNotifications((prev) => {
              // If the message has an id, prevent duplicates
              if (data.id && prev.find((n) => n.id === data.id)) return prev;

              // Convert the WebSocket message into a notification object
              const newNotif = {
                id: data.id || Date.now(), // fallback unique ID
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

            // In‑app toast
            toast(data.title || "New Notification", {
              description: data.message,
            });

            // Desktop/system notification
            showDesktopNotification(data.title || "New Notification", {
              body: data.message,
              data: { notificationId: data.id },
            });
          }
          // Handle data update messages (cache invalidation)
          else if (data.type === "data_update") {
            const { entity, action, record_id } = data;
            const queryKeys = ENTITY_TO_QUERY_KEY[entity];
            if (queryKeys) {
              queryKeys.forEach((key) => {
                // Invalidate all queries that start with this key
                queryClient.invalidateQueries({ queryKey: [key] });
              });
              console.log(
                `[Realtime] Invalidated queries for ${entity} (${action})${record_id ? ` id:${record_id}` : ""}`
              );
            }
          }
        } catch (e) {
          console.error("Error parsing websocket message", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectSocket, 5000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    };

    connectSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [api, queryClient]);

  const markAsRead = async (id: number) => {
    try {
      await api(`/api/notifications/${id}/mark_read/`, {
        method: "POST",
      });

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                is_read: true,
                read_at: new Date().toISOString(),
              }
            : n
        )
      );
    } catch (e) {
      console.error("Error marking notification as read", e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api(`/api/notifications/mark_all_read/`, {
        method: "POST",
      });

      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          is_read: true,
          read_at: n.read_at || new Date().toISOString(),
        }))
      );
    } catch (e) {
      console.error("Error marking all notifications as read", e);
    }
  };

  const toggleFavourite = async (id: number) => {
    try {
      const res = await api<{ is_favourite: boolean }>(
        `/api/notifications/${id}/toggle_favourite/`,
        {
          method: "POST",
        }
      );

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                is_favourite: res.is_favourite,
              }
            : n
        )
      );
    } catch (e) {
      console.error("Error toggling favourite", e);
    }
  };

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