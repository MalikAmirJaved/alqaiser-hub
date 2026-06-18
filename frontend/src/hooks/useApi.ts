import { useCallback } from "react";
import { apiFetch } from "@/lib/api";

export function useApi() {
  const fetch = useCallback(
    async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
      return apiFetch<T>(endpoint, options);
    },
    []
  );

  return fetch;
}