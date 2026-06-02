// src/hooks/usePurchaseOrders.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';
import type { PurchaseOrder, PurchaseOrderPayload } from '@/types/purchase';

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function usePurchaseOrders(filters?: { status?: string; supplier?: string }) {
  const api = useApi();
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.supplier) params.append('supplier', filters.supplier);
  const url = `/api/inventory/purchase-orders/${params.toString() ? `?${params}` : ''}`;

  return useQuery<PaginatedResponse<PurchaseOrder>, Error, PurchaseOrder[]>({
    queryKey: ['inventory_purchase_order', filters],
    queryFn: () => api(url),
    select: (data) => data.results,
  });
}

export function usePurchaseOrder(id: string | null) {
  const api = useApi();
  return useQuery<PurchaseOrder>({
    queryKey: ['purchaseOrder', id],
    queryFn: () => api(`/api/inventory/purchase-orders/${id}/`),
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PurchaseOrderPayload) =>
      api<PurchaseOrder>('/api/inventory/purchase-orders/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_purchase_order'] });
    },
  });
}

export function useCancelPurchaseOrder() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/inventory/purchase-orders/${id}/cancel/`, { method: 'POST' }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['inventory_purchase_order'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', id] });
    },
  });
}

export function useConfirmPurchaseOrder() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/inventory/purchase-orders/${id}/confirm/`, { method: 'POST' }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['inventory_purchase_order'] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', id] });
    },
  });
}