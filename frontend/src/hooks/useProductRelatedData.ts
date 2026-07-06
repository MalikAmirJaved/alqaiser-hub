// src/hooks/useProductRelatedData.ts
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface StockMovement {
  id: string;
  transaction_id: string;
  variant_id: string;
  variant_sku: string;
  warehouse_name: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost: string;
  transaction_type: string;
  transaction_type_display: string;
  reason_text: string;
  source_document_type: string;
  source_document_id: string | null;
  created_at: string;
  created_by_name: string | null;
}

export interface PurchaseOrderRelated {
  id: string;
  order_number: string;
  order_id: string;
  supplier_name: string | null;
  status: string;
  line_status: string;
  variant_sku: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: string;
  order_date: string | null;
  created_at: string;
  created_by_name: string | null;
}

export interface SalesOrderRelated {
  id: string;
  order_number: string;
  order_id: string;
  customer_name: string | null;
  status: string;
  line_status: string;
  source: string;
  variant_sku: string;
  quantity_ordered: number;
  quantity_returned: number;
  unit_price: string;
  order_date: string | null;
  created_at: string;
  created_by_name: string | null;
}

export interface QuoteRelated {
  id: string;
  quote_number: string;
  quote_id: string;
  customer_name: string | null;
  lead_name: string | null;
  status: string;
  variant_sku: string;
  quantity: number;
  unit_price: string;
  discount_amount: string;
  date: string | null;
  created_at: string;
  created_by_name: string | null;
}

export interface InvoiceRelated {
  id: string;
  invoice_number: string;
  invoice_id: string;
  customer_name: string | null;
  status: string;
  source: string;
  variant_sku: string;
  quantity: number;
  unit_price: string;
  discount_amount: string;
  cost_price: string | null;
  invoice_date: string | null;
  created_at: string;
  created_by_name: string | null;
}

export interface PaginatedResult<T> {
  count: number;
  total_pages: number;
  current_page: number;
  next: boolean;
  previous: boolean;
  results: T[];
}

export type RelatedTab = "stock-movements" | "purchase-orders" | "sales-orders" | "quotes" | "invoices";

export interface RelatedTabParams {
  productId: string | null;
  tab: RelatedTab;
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
}

export function useRelatedTabData({ productId, tab, page = 1, pageSize = 20, dateFrom, dateTo }: RelatedTabParams) {
  const api = useApi();

  const params = new URLSearchParams();
  params.set("tab", tab);
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);

  return useQuery<PaginatedResult<any>>({
    queryKey: ["productRelatedTab", productId, tab, page, pageSize, dateFrom, dateTo],
    queryFn: () =>
      api<PaginatedResult<any>>(
        `/api/inventory/products/${productId}/related-data/?${params.toString()}`
      ),
    enabled: !!productId,
    staleTime: 30_000,
  });
}

export function useProductRelatedData(productId: string | null) {
  const api = useApi();

  return useQuery<{
    stock_movements: PaginatedResult<StockMovement>;
    purchase_orders: PaginatedResult<PurchaseOrderRelated>;
    sales_orders: PaginatedResult<SalesOrderRelated>;
    quotes: PaginatedResult<QuoteRelated>;
    invoices: PaginatedResult<InvoiceRelated>;
  }>({
    queryKey: ["productRelatedData", productId],
    queryFn: () =>
      api(
        `/api/inventory/products/${productId}/related-data/`
      ),
    enabled: !!productId,
    staleTime: 30_000,
  });
}
