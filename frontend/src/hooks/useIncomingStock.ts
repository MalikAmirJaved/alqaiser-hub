import { useQuery } from "@tanstack/react-query";
import { useApi } from "./useApi";

export function useIncomingStock(variantIds: string[]) {
  const api = useApi();

  // Create stable key
  const sortedIds = [...variantIds].sort().join(",");

  return useQuery<Record<string, number>>({
    queryKey: ["incoming_stock", sortedIds],
    queryFn: async () => {
      if (variantIds.length === 0) return {};
      const response = await api<{ results: Record<string, number> }>(
        "/api/inventory/variants/incoming-stock/",
        {
          method: "POST",
          body: JSON.stringify({ variant_ids: variantIds }),
        }
      );
      return response.results;
    },
    enabled: variantIds.length > 0,
    staleTime: 60_000, // incoming stock changes less frequently
  });
}