// ============================================================
// File: frontend/src/types/purchase.ts
// ============================================================

export interface PurchaseOrderLine {
  id: string;
  _id: string;
  variant: string;
  asset: string;
  variant_sku: string;
  variant_name: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_pending: number;
  unit_cost: number;
  tax_rate: number;
  line_total: number;
  status: "PENDING" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED" | "CANCELLED";
  notes?: string;
}

export interface PurchaseOrder {
  _id: string;
  id: string;
  order_number: string;
  supplier: string;
  supplier_name: string;
  warehouse: string;
  warehouse_name: string;
  inventory_type: "FOR_SALE" | "OFFICE_INVENTORY";  // ← ADDED
  status: "DRAFT" | "CONFIRMED" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED" | "CANCELLED";
  order_date: string;
  expected_delivery_date?: string;
  total_amount: number;
  total_paid: number;
  payment_status: "UNPAID" | "PARTIAL" | "PAID";
  notes?: string;
  lines: PurchaseOrderLine[];
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderLinePayload {
  variant?: string;          // UUID for FOR_SALE
  asset?: string;            // UUID for OFFICE_INVENTORY
  quantity_ordered: number;
  unit_cost: number;
  tax_rate: number;
}

export interface PurchaseOrderPayload {
  supplier: string;
  warehouse?: string;
  inventory_type: 'FOR_SALE' | 'OFFICE_INVENTORY';
  order_date?: string;
  expected_delivery_date?: string;
  notes?: string;
  line_items: PurchaseOrderLinePayload[];
  request_ids?: string[];  // Asset purchase request UUIDs to link and mark as fulfilled
}

export interface GoodsReceiptLinePayload {
  purchase_order_line_id: string;
  quantity_received: number;
  unit_cost: number;
  accepted: boolean;
}

export interface GoodsReceiptPayload {
  purchase_order: string;
  received_date: string;
  notes?: string;
  receipt_lines: GoodsReceiptLinePayload[];
}

export interface GoodsReceiptLine {
  id: string;
  purchase_order_line_id: string;
  quantity_received: number;
  unit_cost: number;
  accepted: boolean;
  variant_name?: string;
}

export interface GoodsReceipt {
  id: string;
  receipt_number: string;
  purchase_order: string;
  purchase_order_number: string;
  received_date: string;
  received_by: string;
  status: "COMPLETED" | "PARTIALLY_RETURNED";
  notes?: string;
  lines: GoodsReceiptLine[];
  created_at: string;
  updated_at: string;
}