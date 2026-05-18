// src/components/purchase/PurchaseOrderTable.tsx
import { TableView, Column } from '@/components/reuseable/TableGridView';
import { Badge } from '@/components/ui/badge'; // you'll need a simple badge component or use custom
import { Button } from '@/components/ui/button';
import { Eye, Edit, Trash2, CheckCircle, XCircle, Truck } from 'lucide-react';
import type { PurchaseOrder } from '@/types/purchase';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PARTIALLY_RECEIVED: 'bg-yellow-100 text-yellow-800',
  FULLY_RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  PARTIALLY_RECEIVED: 'Partially Received',
  FULLY_RECEIVED: 'Fully Received',
  CANCELLED: 'Cancelled',
};

interface PurchaseOrderTableProps {
  orders: PurchaseOrder[];
  loading?: boolean;
  onView: (order: PurchaseOrder) => void;
  onEdit: (order: PurchaseOrder) => void;
  onCancel: (order: PurchaseOrder) => void;
  onConfirm: (order: PurchaseOrder) => void;
  onReceive: (order: PurchaseOrder) => void;
}
type PO = Record<string, unknown>;

export function PurchaseOrderTable({
  orders,
  loading,
  onView,
  onEdit,
  onCancel,
  onConfirm,
  onReceive,
}: PurchaseOrderTableProps) {
  const columns: Column<Record<string, unknown>>[] = [
    { key: 'order_number', label: 'Order #', sortable: true },
    { key: 'supplier_name', label: 'Supplier', sortable: true },
    { key: 'warehouse_name', label: 'Warehouse', sortable: true },
    {
      key: 'order_date',
      label: 'Order Date',
      sortable: true,
      render: (val) => val ? new Date(val as string).toLocaleDateString() : '-',
    },
    {
      key: 'expected_delivery_date',
      label: 'Expected Delivery',
      sortable: true,
      render: (val) => val ? new Date(val as string).toLocaleDateString() : '-',
    },
    {
      key: 'total_amount',
      label: 'Total Amount',
      sortable: true,
      render: (val) => `$${Number(val)}`,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val) => {
  const status = val as PurchaseOrder['status'];

  return (
    <Badge className={statusColors[status] || 'bg-gray-100'}>
      {statusLabels[status] ?? status}
    </Badge>
  );
}
    },
  ];

  const actions = (row: PO) => {
  const order = row as unknown as PurchaseOrder;

  return (
    <div className="flex items-center justify-end gap-1">
      <Button onClick={() => onView(order)}>
        <Eye className="w-4 h-4" />
      </Button>

      {order.status === "DRAFT" && (
        <>
          <Button onClick={() => onEdit(order)}>
            <Edit className="w-4 h-4" />
          </Button>

          <Button onClick={() => onConfirm(order)}>
            <CheckCircle className="w-4 h-4" />
          </Button>

          <Button onClick={() => onCancel(order)}>
            <XCircle className="w-4 h-4" />
          </Button>
        </>
      )}
    </div>
  );
};
  return (
    <TableView
  columns={columns}
  data={orders as unknown as PO[]}
  loading={loading}
  actions={actions}
  onRowClick={(row) => onView(row as unknown as PurchaseOrder)}
  emptyMessage="No purchase orders found"
/>
  );
}