"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { companyContext } from "@/services/companyContextService";
import { toast } from "sonner";

interface NotificationContextProps {
  notifications: any[];
  isConnected: boolean;
}

const NotificationContext = createContext<NotificationContextProps>({
  notifications: [],
  isConnected: false,
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let ws: WebSocket;

    const connectSocket = async () => {
      // Ensure context is initialized
      if (!companyContext.initialized) {
        await companyContext.init();
      }

      const companyId = companyContext.getCurrentCompanyId();
      const branchId = companyContext.getCurrentBranchId();

      // Only connect if we have both context ids
      if (!companyId || !branchId) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const wsUrl = apiUrl.replace(/^http/, 'ws') + `/ws/notifications/${companyId}/${branchId}/`;
      
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Connected to notification socket");
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setNotifications((prev) => [data, ...prev]);
          
          // Show toast notification using Sonner
          toast(data.title || "New Notification", {
            description: data.message,
          });
        } catch (e) {
          console.error("Error parsing websocket message", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt to reconnect after 5 seconds
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
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, isConnected }}>
      {children}
    </NotificationContext.Provider>
  );
};
