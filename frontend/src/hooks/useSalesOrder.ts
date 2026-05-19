// src/hooks/useSalesOrder.ts
"use client";
import { useMutation,useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { CartLine } from "@/lib/utils";

export interface SalesOrderLineItem {
  variant: string; // variant ID
  quantity_ordered: number;
  unit_price: number;
  tax_rate: number;
  discount_pct: number;
  discount_fixed: number;
}

export interface CreateSalesOrderParams {
  customer: string | null;
  warehouse: string;
  order_date: string;
  notes: string;
  line_items: SalesOrderLineItem[];
  status: "DRAFT" | "CONFIRMED";
}

export interface ConfirmSalesOrderParams {
  orderId: string;
}
export interface ReturnLinePayload {
  sales_order_line_id: string;
  quantity_returned: number;
  restock: boolean;
  unit_cost: number;
  reason: string;
}

export interface CreateSalesReturnParams {
  sales_order: string;     
  warehouse: string;       
  return_date: string;
  reason?: string;
  return_lines: ReturnLinePayload[];
}

export interface SalesReturnResponse {
  _id: string;
  return_number: string;
  sales_order: string;
}

export interface SalesOrderResponse {
  _id: string;
  order_number: string;
  customer_name?: string;
  order_date: string;
  status: string;
  lines?: any[];
}

type ApiResponse<T> = {
  data?: T;
  results?: T[];
} | T;
type ListResponse<T> = {
  results: T[];
};
/**
 * Convert cart lines to API-ready line items
 */
export function cartToLineItems(cart: CartLine[]): SalesOrderLineItem[] {
  return cart.map((line) => ({
    variant: line.variant.id,
    quantity_ordered: line.qty,
    unit_price: line.unitPrice,
    tax_rate: line.taxRate,
    discount_pct: line.discountPct,
    discount_fixed: line.discountFixed,
  }));
}

/**
 * Create a sales order (DRAFT or CONFIRMED)
 * If status is CONFIRMED, automatically calls the confirm endpoint after creation
 */
export function useCreateSalesOrder() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateSalesOrderParams) => {
      // First create the order
      const createPayload = {
        customer: params.customer,
        warehouse: params.warehouse,
        order_date: params.order_date,
        notes: params.notes,
        line_items: params.line_items,
      };

      const resp = await api<ApiResponse<any>>("/api/inventory/sales-orders/", {
        method: "POST",
        body: JSON.stringify(createPayload),
        });
      const order = resp.data || resp;

      // If confirmed, call the confirm endpoint
      if (params.status === "CONFIRMED" && order._id) {
        await api(`/api/inventory/sales-orders/${order._id}/confirm/`, {
          method: "POST",
        });
      }

      return order;
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
      if (variables.status === "CONFIRMED") {
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
      }
    },
  });
}

/**
 * Confirm an existing DRAFT sales order
 */
export function useConfirmSalesOrder() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId }: ConfirmSalesOrderParams) => {
      return api(`/api/inventory/sales-orders/${orderId}/confirm/`, {
        method: "POST",
      });
    },
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
      queryClient.invalidateQueries({ queryKey: ["salesOrder", orderId] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

/**
 * Fetch a single sales order by ID or order number
 */
export function useFetchSalesOrder(orderNumberOrId?: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["salesOrder", orderNumberOrId],
    queryFn: async () => {
      if (!orderNumberOrId) return null;
      // Try to fetch by order number first
      const resp = await api<ListResponse<any>>(
  `/api/inventory/sales-orders/?order_number=${encodeURIComponent(orderNumberOrId)}`
);

      const order = resp?.results?.[0];
      if (order) return order;
      // If not found, try as ID
      return api(`/api/inventory/sales-orders/${orderNumberOrId}/`);
    },
    enabled: !!orderNumberOrId,
    staleTime: 30 * 1000,
  });
}

export function useCreateSalesReturn() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation<SalesReturnResponse, Error, CreateSalesReturnParams>({
    mutationFn: (params) =>
      api<SalesReturnResponse>("/api/inventory/sales-returns/", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salesOrders"] });
      queryClient.invalidateQueries({ queryKey: ["currentStock"] });
    },
  });
}

export function useFetchSalesOrderByNumber(orderNumber: string) {
  const api = useApi();

  return useQuery<SalesOrderResponse | null>({
    queryKey: ["salesOrder", orderNumber],

    queryFn: async () => {
      const resp = await api<{ results: SalesOrderResponse[] }>(
        `/api/inventory/sales-orders/?order_number=${encodeURIComponent(orderNumber)}`
      );

      return resp.results?.[0] || null;
    },

    enabled: !!orderNumber,
    staleTime: 30_000,
  });
}

export function useDraftSalesOrders() {
  const api = useApi();
  return useQuery({
    queryKey: ["salesOrders", "draft"],
    queryFn: () =>
      api<{ results: any[] }>("/api/inventory/sales-orders/?status=DRAFT"),
    select: (data) => data.results,
    staleTime: 30_000,
  });
}
