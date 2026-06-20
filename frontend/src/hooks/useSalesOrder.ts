// src/hooks/useSalesOrder.ts
"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface SalesOrderLineItem {
  line_id?: string;          
  variant: string;
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
  status: "DRAFT" | "COMPLETE";
  create_invoice?: boolean;
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
  id: string;
  return_number: string;
  sales_order: string;
}

export interface SalesOrderResponse {
  id: string;
  order_number: string;
  total_amount: number ;
  customer_name?: string;
  customer?: { id: string; name: string };
  warehouse?: { id: string; warehouse_name: string };
  order_date: string;
  created_at: string;
  status: string;
  notes?: string;
  lines?: Array<{
    id: string;
    variant: string;
    variant_sku: string;
    variant_name: string;
    discount_amount: number;
    discount_pct: number;
    discount_fixed: number;
    quantity_ordered: number;
    unit_price: number;
    tax_rate: number;
    status: string;
  }>;
}

export interface CartLine {
  variant: any;
  qty: number;
  unitPrice: number;
  discountPct: number;
  discountFixed: number;
  taxRate: number;
  notes: string;
  salesOrderLineId?: string,
}

export const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const lineSubtotal = (l: CartLine) => {
  const base = l.qty * l.unitPrice;
  const disc = l.discountFixed > 0 ? l.discountFixed : (base * l.discountPct) / 100;
  return Math.max(0, base - disc);
};
export const lineTax = (l: CartLine) => lineSubtotal(l) * (l.taxRate / 100);
export const lineTotal = (l: CartLine) => lineSubtotal(l) + lineTax(l);
export const cartTotal = (cart: CartLine[]) => cart.reduce((s, l) => s + lineTotal(l), 0);
export const cartSubtotal = (cart: CartLine[]) => cart.reduce((s, l) => s + lineSubtotal(l), 0);
export const cartTax = (cart: CartLine[]) => cart.reduce((s, l) => s + lineTax(l), 0);


type ApiResponse<T> = { data?: T; results?: T[] } | T;
type ListResponse<T> = { results: T[] };

export function cartToLineItems(cart: CartLine[]): SalesOrderLineItem[] {
  return cart.map((line) => ({
    line_id: line.salesOrderLineId,
    variant: line.variant.id,
    quantity_ordered: line.qty,
    unit_price: line.unitPrice,
    tax_rate: line.taxRate,
    discount_pct: line.discountPct,
    discount_fixed: line.discountFixed,
  }));
}

export function useCreateSalesOrder() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateSalesOrderParams) => {
      const createPayload: Record<string, any> = {
        customer: params.customer,
        warehouse: params.warehouse,
        order_date: params.order_date,
        notes: params.notes,
        line_items: params.line_items,
        status: params.status,
      };
      if (params.create_invoice) {
        createPayload.create_invoice = true;
      }
      const resp = await api<ApiResponse<any>>("/api/inventory/sales-orders/", {
        method: "POST",
        body: JSON.stringify(createPayload),
      });
      return resp.data || resp;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["inventory_sales_order"] });
      if (variables.status === "COMPLETE") {
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
      }
    },
  });
}

export function useCompleteSalesOrder() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, line_items, create_invoice }: { orderId: string; line_items?: SalesOrderLineItem[]; create_invoice?: boolean }) => {
      const payload: Record<string, any> = {};
      if (line_items) payload.line_items = line_items;
      if (create_invoice) payload.create_invoice = true;
      return api(`/api/inventory/sales-orders/${orderId}/complete/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ["inventory_sales_order"] });
      queryClient.invalidateQueries({ queryKey: ["salesOrder", orderId] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useCancelSalesOrder() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      return api(`/api/inventory/sales-orders/${orderId}/cancel/`, { method: "POST" });
    },
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: ["inventory_sales_order"] });
      queryClient.invalidateQueries({ queryKey: ["salesOrder", orderId] });
    },
  });
}

export function useFetchSalesOrder(orderNumberOrId?: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["salesOrder", orderNumberOrId],
    queryFn: async () => {
      if (!orderNumberOrId) return null;
      const resp = await api<ListResponse<any>>(
        `/api/inventory/sales-orders/?order_number=${encodeURIComponent(orderNumberOrId)}`
      );
      const order = resp?.results?.[0];
      if (order) return order;
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
      queryClient.invalidateQueries({ queryKey: ["inventory_sales_order"] });
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

/**
 * Update an existing sales order (e.g. save draft changes)
 */
export function useUpdateSalesOrder() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: Record<string, any> }) =>
      api(`/api/inventory/sales-orders/${orderId}/`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ["inventory_sales_order"] });
      queryClient.invalidateQueries({ queryKey: ["salesOrder", orderId] });
      queryClient.invalidateQueries({ queryKey: ["inventory_variant"] });
      queryClient.invalidateQueries({ queryKey: ["batchStock"] });
    },
  });
}

export function useDraftSalesOrders() {
  const api = useApi();
  return useQuery({
    queryKey: ["inventory_sales_order", "draft"],
    queryFn: () => api<{ results: SalesOrderResponse[] }>("/api/inventory/sales-orders/?status=DRAFT"),
    select: (data) => data.results,
    staleTime: 30_000,
  });
}


export function useSalesOrders(filters?: { status?: string; customer?: string }) {
  const api = useApi();
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.customer) params.append("customer", filters.customer);
  const url = `/api/inventory/sales-orders/${params.toString() ? `?${params}` : ""}`;
  return useQuery<
  { results: SalesOrderResponse[] }, // queryFn return type
  Error,
  SalesOrderResponse[]               // final selected type
>({
    queryKey: ["inventory_sales_order", filters],
    queryFn: () => api(url),
    select: (data) => data.results,
    staleTime: 30_000,
  });
}
