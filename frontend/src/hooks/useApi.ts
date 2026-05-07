import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useApi() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/accounts/logout/", { method: "POST" });
    } catch {}
    queryClient.setQueryData(["user"], null);
    router.push("/login");
  }, [queryClient, router]);

  const fetch = useCallback(
    async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
      try {
        return await apiFetch<T>(endpoint, options);
      } catch (error: any) {
        if (error.status === 401) await logout();
        throw error;
      }
    },
    [logout]
  );

  return fetch;
}