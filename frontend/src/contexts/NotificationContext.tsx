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
import { useNotificationsApi } from "@/hooks/useNotificationsApi";
import {
  registerServiceWorker,
  requestNotificationPermission,
  showDesktopNotification,
} from "@/lib/notifications";
import { useSelector } from "react-redux";
import { RootState, store } from "@/store";
import { loadCompanySettings } from "@/store/slices/companySettingsSlice";
import { setUnauthenticated } from "@/store/slices/authSlice";

// ----------------------------------------------------------------------
// Map backend entity names to React Query keys for cache invalidation
// ----------------------------------------------------------------------
const ENTITY_TO_QUERY_KEY: Record<string, string[]> = {
  // ---------- HR ----------
  assets: ["assets", "assetStats"],
  assetCategories: ["assetCategories", "assetCategoryStats"],
  employees: ["employees", "employeeStats"],
  leaves: ["leaves", "leaveStats", "leaveBalances"],
  shiftTemplates: ["shiftTemplates"],
  shiftOverrides: ["shiftOverrides", "resolvedShifts", "shiftStatistics"],
  shiftDateRange: ["shiftDateRange", "resolvedShifts", "shiftStatistics"],
  payroll: ["payroll", "payrollStats"],
  recruitment: ["recruitment", "recruitmentStats"],
  exitRecords: ["exitRecords", "exitStats"],
  policies: ["policies"],
  compensations: ["compensations"],
  loans: ["loans", "employeeLoans"],

  employeeAssets: ["employee-assignments", "available-assets"],

  // ---------- HR ----------
  asset_purchase_request: ["assetPurchaseRequests"],

  // ---------- Company & Settings ----------
  designation: ["designations", "companySettings"],

  // ---------- Inventory ----------
  inventory_category: ["inventory_category"],
  inventory_brand: ["inventory_brand"],
  inventory_warehouse: ["inventory_warehouse"],
  inventory_product: ["inventory_product", "pos_catalog"],
  inventory_supplier: ["inventory_supplier"],
  inventory_variant: ["inventory_variant", "pos_catalog"],
  inventory_stock: ["inventory_stock", "pos_catalog"],
  inventory_sales_order: ["inventory_sales_order", "pos_catalog", "inventory_variant", "inventory_stock", "batchStock"],
  pos_catalog: ["pos_catalog"],
  inventory_stock_transfer: ["inventory_stock_transfer"],
  inventory_purchase_order: ["inventory_purchase_order"],

  // Inventory aliases
  product: ["inventory_product"],
  inventory: ["inventory_product"],
  supplier: ["inventory_supplier"],
  vendor: ["inventory_supplier"],
  variant: ["inventory_variant", "batchStock"],
  stock: ["inventory_stock", "batchStock"],
  sales_order: ["inventory_sales_order"],
  sales_return: ["inventory_sales_order"],
  stock_transfer: ["inventory_stock_transfer"],

  // ---------- Sales ----------
  sales_lead: ["sales_leads", "sales_lead"],
  sales_quote: ["sales_quotes", "sales_quote"],
  lead: ["sales_leads"],
  quote: ["sales_quotes"],

  // ---------- Finance ----------
  finance_account: ["finance_accounts"],
  finance_journal_entry: ["finance_journal_entries", "finance_journal_entry"],
  finance_supplier_bill: ["finance_supplier_bills"],
  finance_customer_invoice: ["finance_customer_invoices"],
  finance_payment: ["finance_payments"],
  finance_bank_transaction: ["finance_bank_transactions"],
  finance_budget: ["finance_budgets"],
  finance_expense: ["finance_expenses"],
  supplier_bill: ["finance_supplier_bills"],
  customer_invoice: ["finance_customer_invoices"],
  bank_transaction: ["finance_bank_transactions"],

  // ---------- Company & Settings ----------
  company: ["company_settings"],
  branch: ["branch"],
  user: ["users", "user"],
  company_settings: ["companySettings"],

  // ---------- Monitoring ----------
  monitoring_site: ["monitoring_sites"],
  monitoring_nvr: ["monitoring_nvrs"],
  monitoring_camera: ["monitoring_cameras"],
};

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------
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

// ----------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------
const NotificationContext = createContext<NotificationContextProps>({
  notifications: [],
  isConnected: false,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  toggleFavourite: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

// ----------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------
export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const user = useSelector((state: RootState) => state.auth.user);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intentionalCloseRef = useRef(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 10;
  const { fetchNotifications: fetchNotificationsApi, markAsRead: markAsReadApi, markAllAsRead: markAllAsReadApi, toggleFavourite: toggleFavouriteApi } = useNotificationsApi();
  const queryClient = useQueryClient();

  const fetchNotifications = useCallback(async () => {
    try {
      const results = await fetchNotificationsApi();
      setNotifications(results);
    } catch (e) {
      console.error("Error fetching notifications", e);
    }
  }, [fetchNotificationsApi]);

  // Register service worker and request permission on mount
  useEffect(() => {
    registerServiceWorker();
    requestNotificationPermission();
  }, []);

  // WebSocket connection with exponential backoff
  const connectSocket = useCallback(
    async () => {
      if (!isAuthenticated || !user) {
        console.warn(
          "[NotificationContext] User not authenticated – skipping WebSocket connection."
        );
        return;
      }

      const companyId = user?.companyId;
      const branchId = user?.branchId;
      if (!companyId) {
        console.warn(
          "[NotificationContext] Missing company ID – waiting for user data. Retry will happen when user loads."
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

      if (retryCountRef.current >= MAX_RETRIES) {
        console.warn(`[NotificationContext] Max retries (${MAX_RETRIES}) reached. Giving up.`);
        return;
      }

      await fetchNotifications();

      const wsUrl = apiUrl.replace(/^http/, "ws") + `/ws/notifications/${companyId}/${branchId || "None"}/`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        retryCountRef.current = 0;
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

            if (entity === "company_settings") {
              console.log("[NotificationContext] Refreshing company settings via Redux thunk");
              store
                .dispatch(loadCompanySettings())
                .unwrap()
                .then(() => {
                  console.log("[NotificationContext] Company settings refreshed successfully");
                })
                .catch((err) => {
                  console.error("[NotificationContext] Failed to refresh company settings:", err);
                });
            }
          }
        } catch (e) {
          console.error("[NotificationContext] Error parsing websocket message", e);
        }
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        if (intentionalCloseRef.current) {
          intentionalCloseRef.current = false;
          return;
        }
        console.warn(`[NotificationContext] Closed (code ${event.code}). Reconnecting...`);
        setIsConnected(false);
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

        if (event.code === 4403 || event.code === 1008) {
          console.warn("[NotificationContext] Auth rejected – clearing session.");
          store.dispatch(setUnauthenticated());
          return;
        }

        retryCountRef.current += 1;
        if (retryCountRef.current >= MAX_RETRIES) {
          console.warn(`[NotificationContext] Max retries (${MAX_RETRIES}) reached. Giving up.`);
          return;
        }

        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectSocket();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error("[NotificationContext] WebSocket error:", error);
        ws.close();
      };
    },
    [fetchNotifications, queryClient, user?.companyId, user?.branchId, isAuthenticated]
  );

  useEffect(() => {
    connectSocket();
    return () => {
      intentionalCloseRef.current = true;
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
        queryClient.invalidateQueries({ queryKey: ["inventory_sales_order"] });
        queryClient.invalidateQueries({ queryKey: ["inventory_stock"] });
        queryClient.invalidateQueries({ queryKey: ["pos_catalog"] });
        queryClient.invalidateQueries({ queryKey: ["companySettings"] });
      }, 30000);
    }
    return () => clearInterval(pollInterval);
  }, [isConnected, queryClient]);

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await markAsReadApi(id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
          )
        );
      } catch (e) {
        console.error("Error marking notification as read", e);
      }
    },
    [markAsReadApi]
  );

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllAsReadApi();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at || new Date().toISOString() }))
      );
    } catch (e) {
      console.error("Error marking all notifications as read", e);
    }
  }, [markAllAsReadApi]);

  const toggleFavourite = useCallback(
    async (id: string) => {
      try {
        const res = await toggleFavouriteApi(id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_favourite: res.is_favourite } : n))
        );
      } catch (e) {
        console.error("Error toggling favourite", e);
      }
    },
    [toggleFavouriteApi]
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