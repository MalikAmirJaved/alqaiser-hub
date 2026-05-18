// src/hooks/useGoodsReceipts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';
import type { GoodsReceipt, GoodsReceiptPayload } from '@/types/purchase';

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function useGoodsReceipts(poId?: string) {
  const api = useApi();
  const params = poId ? `?purchase_order=${poId}` : '';

  return useQuery<PaginatedResponse<GoodsReceipt>, Error, GoodsReceipt[]>({
    queryKey: ['goodsReceipts', poId],
    queryFn: () => api(`/api/inventory/goods-receipts/${params}`),
    select: (data) => data.results, // ✅ THIS FIXES IT
  });
}

export function useCreateGoodsReceipt() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GoodsReceiptPayload) =>
      api<GoodsReceipt>('/api/inventory/goods-receipts/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goodsReceipts'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
    },
  });
}