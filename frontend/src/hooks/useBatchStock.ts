// src/hooks/useBatchStock.ts
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

interface StockData {
  available: number;
  reserved: number;
  on_hand: number;
}

export function useBatchStock(variantIds: string[], warehouseId: string | null) {
  const api = useApi();

  // Create a stable string from variantIds for the query key
  const sortedIds = [...variantIds].sort().join(",");

  return useQuery<Record<string, StockData>>({
    // ✅ Changed: prefix with "inventory_stock" so WebSocket invalidation catches it
    queryKey: ["inventory_stock", "batch", warehouseId, sortedIds],
    queryFn: async () => {
      if (!warehouseId || variantIds.length === 0) return {};
      const response = await api<{ results: Record<string, StockData> }>(
        "/api/inventory/stock/batch-stock/",
        {
          method: "POST",
          body: JSON.stringify({
            variant_ids: variantIds,
            warehouse_id: warehouseId,
          }),
        }
      );
      return response.results;
    },
    enabled: !!warehouseId && variantIds.length > 0,
    staleTime: 2000, // 2 seconds – stock changes often in POS
    gcTime: 5000,
  });
}