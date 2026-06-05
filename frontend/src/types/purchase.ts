// src/types/purchase.ts
export interface PurchaseOrderLine {
  id: string;
  variant: string;          // UUID
  variant_sku: string;
  variant_name: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_pending: number;
  unit_cost: number;
  tax_rate: number;
  line_total: number;
  status: 'PENDING' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED' | 'CANCELLED';
  notes: string;
}

export interface PurchaseOrder {
  _id: string;
  order_number: string;
  supplier: string;         // UUID
  supplier_name: string;
  warehouse: string;        // UUID
  warehouse_name: string;
  status: 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED' | 'CANCELLED';
  order_date: string | null;
  expected_delivery_date: string | null;
  payment_status: string | null;
  total_paid: number | 0;
  total_amount: number;
  notes: string;
  lines: PurchaseOrderLine[];
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderPayload {
  supplier: string;
  warehouse: string;
  order_date?: string;
  expected_delivery_date?: string;
  notes?: string;
  line_items: Array<{
    variant: string;
    quantity_ordered: number;
    unit_cost: number;
    tax_rate?: number;
  }>;
}

export interface GoodsReceipt {
  id: string;
  receipt_number: string;
  purchase_order: string;
  purchase_order_number: string;
  received_date: string;
  status: 'COMPLETED' | 'PARTIALLY_RETURNED';
  notes: string;
  lines: GoodsReceiptLine[];
}

export interface GoodsReceiptLine {
  id: string;
  purchase_order_line: string;
  quantity_received: number;
  unit_cost: number;
  accepted: boolean;
  variant_name: string;
}

export interface GoodsReceiptPayload {
  purchase_order: string;
  received_date: string;
  notes?: string;
  receipt_lines: Array<{
    purchase_order_line_id: string;
    quantity_received: number;
    unit_cost: number;
    accepted?: boolean;
  }>;
}