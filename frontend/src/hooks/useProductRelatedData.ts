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

export interface ProductRelatedData {
  stock_movements: StockMovement[];
  purchase_orders: PurchaseOrderRelated[];
  sales_orders: SalesOrderRelated[];
  quotes: QuoteRelated[];
  invoices: InvoiceRelated[];
}

export function useProductRelatedData(productId: string | null) {
  const api = useApi();

  return useQuery<ProductRelatedData>({
    queryKey: ["productRelatedData", productId],
    queryFn: () =>
      api<ProductRelatedData>(
        `/api/inventory/products/${productId}/related-data/`
      ),
    enabled: !!productId,
    staleTime: 30_000,
  });
}
