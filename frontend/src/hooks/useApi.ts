import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useDispatch } from "react-redux";
import { setUnauthenticated } from "@/store/slices/authSlice";

let refreshPromise: Promise<any> | null = null;

export function useApi() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  const logout = useCallback(async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/accounts/logout/`, { method: "POST", credentials: "include" });
    } catch {}
    queryClient.setQueryData(["user"], null);
    dispatch(setUnauthenticated());
    router.push("/login");
  }, [queryClient, router, dispatch]);

  const fetch = useCallback(
    async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
      try {
        return await apiFetch<T>(endpoint, options);
      } catch (error: any) {
        if (error.status === 401 && !["/api/accounts/login/", "/api/accounts/logout/", "/api/accounts/token/refresh/"].includes(endpoint)) {
          if (!refreshPromise) {
            refreshPromise = apiFetch("/api/accounts/token/refresh/", { method: "POST" }).finally(() => {
              refreshPromise = null;
            });
          }
          try {
            await refreshPromise;
            return await apiFetch<T>(endpoint, options);
          } catch (refreshError) {
            await logout();
            throw refreshError;
          }
        }
        throw error;
      }
    },
    [logout]
  );

  return fetch;
}