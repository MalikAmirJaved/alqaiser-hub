'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Package } from 'lucide-react';
import {
  usePurchaseOrders,
  useCreatePurchaseOrder,
  useCancelPurchaseOrder,
  useConfirmPurchaseOrder,
} from '@/hooks/usePurchaseOrders';
import { useCreateGoodsReceipt } from '@/hooks/useGoodsReceipts';
import { useConfirmationModal } from '@/components/reuseable/ConfirmationModal';
import { PurchaseOrderModal } from './PurchaseOrderModal';
import { GoodsReceiptModal } from './GoodsReceiptModal';
import type { PurchaseOrder, PurchaseOrderPayload, GoodsReceiptPayload } from '@/types/purchase';

// ─── Status config ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; badgeCls: string }
> = {
  DRAFT: {
    label: 'Draft',
    badgeCls: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
  CONFIRMED: {
    label: 'Confirmed',
    badgeCls: 'bg-blue-50 text-blue-700 border border-blue-100',
  },
  PARTIALLY_RECEIVED: {
    label: 'Partially Received',
    badgeCls: 'bg-amber-50 text-amber-700 border border-amber-100',
  },
  FULLY_RECEIVED: {
    label: 'Fully Received',
    badgeCls: 'bg-green-50 text-green-700 border border-green-100',
  },
  CANCELLED: {
    label: 'Cancelled',
    badgeCls: 'bg-red-50 text-red-600 border border-red-100',
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    badgeCls: 'bg-gray-100 text-gray-600',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cfg.badgeCls}`}
    >
      {cfg.label}
    </span>
  );
}

function fmt(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  });
}

function fmtAmount(val?: string | number) {
  const n = Number(val ?? 0);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  valueClass = '',
}: {
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="bg-muted/50 rounded-lg px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </p>
      <p className={`text-2xl font-medium ${valueClass}`}>{value}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { data: orders = [], isLoading } = usePurchaseOrders();
  const createMutation = useCreatePurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();
  const confirmMutation = useConfirmPurchaseOrder();
  const createReceiptMutation = useCreateGoodsReceipt();
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | undefined>();
  const [receiptOrder, setReceiptOrder] = useState<PurchaseOrder | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: orders.length,
    draft: orders.filter((o) => o.status === 'DRAFT').length,
    confirmed: orders.filter((o) => o.status === 'CONFIRMED').length,
    received: orders.filter((o) => o.status === 'FULLY_RECEIVED').length,
    cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
  }), [orders]);

  // ── Unique suppliers for filter dropdown ──────────────────────────────────
  const suppliers = useMemo(() => {
    const names = [...new Set(orders.map((o) => o.supplier_name).filter(Boolean))];
    return names as string[];
  }, [orders]);

  // ── Filtered orders ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const matchQ =
        !q ||
        o.order_number?.toLowerCase().includes(q) ||
        o.supplier_name?.toLowerCase().includes(q) ||
        o.warehouse_name?.toLowerCase().includes(q);
      const matchStatus = !statusFilter || o.status === statusFilter;
      const matchSupplier = !supplierFilter || o.supplier_name === supplierFilter;
      return matchQ && matchStatus && matchSupplier;
    });
  }, [orders, search, statusFilter, supplierFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleView = (order: PurchaseOrder) =>
    router.push(`purchases/${order._id}`);

  const handleEdit = (order: PurchaseOrder) => {
    setEditingOrder(order);
    setModalOpen(true);
  };

  const handleCancel = (order: PurchaseOrder) =>
    confirm({
      title: 'Cancel Purchase Order',
      message: `Are you sure you want to cancel order ${order.order_number}?`,
      type: 'danger',
      onConfirm: async () => { await cancelMutation.mutateAsync(order._id); },
    });

  const handleConfirm = (order: PurchaseOrder) =>
    confirm({
      title: 'Confirm Purchase Order',
      message: `Confirm order ${order.order_number}? This will allow receiving goods.`,
      type: 'warning',
      onConfirm: async () => { await confirmMutation.mutateAsync(order._id); },
    });

  const handleCreateOrder = async (data: PurchaseOrderPayload) => {
    await createMutation.mutateAsync(data);
    setModalOpen(false);
    setEditingOrder(undefined);
  };

  const handleCreateReceipt = async (data: GoodsReceiptPayload) => {
    await createReceiptMutation.mutateAsync(data);
    setReceiptOrder(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium">Purchase Orders</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage supplier orders and inventory inflows
          </p>
        </div>
        <button
          onClick={() => { setEditingOrder(undefined); setModalOpen(true); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-85 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Order
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2.5">
        <StatCard label="Total Orders" value={stats.total} />
        <StatCard label="Draft" value={stats.draft} valueClass="text-muted-foreground" />
        <StatCard label="Confirmed" value={stats.confirmed} valueClass="text-blue-600" />
        <StatCard label="Fully Received" value={stats.received} valueClass="text-green-600" />
        <StatCard label="Cancelled" value={stats.cancelled} valueClass="text-red-500" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search by order number, supplier, warehouse…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_CONFIG).map(([val, { label }]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
        >
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              {['Order #', 'Supplier', 'Warehouse', 'Order Date', 'Expected', 'Total', 'Status', ''].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center">
                  <Package className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No purchase orders match your filters</p>
                </td>
              </tr>
            )}
            {filtered.map((order) => (
              <tr
                key={order._id}
                onClick={() => handleView(order)}
                className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs font-medium">
                  {order.order_number}
                </td>
                <td className="px-4 py-3">{order.supplier_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{order.warehouse_name}</td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{fmt(order.order_date)}</td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{fmt(order.expected_delivery_date)}</td>
                <td className="px-4 py-3 tabular-nums font-medium">{fmtAmount(order.total_amount)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3">
                  <div
                    className="flex items-center justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* View */}
                    <ActionBtn
                      title="View details"
                      onClick={() => handleView(order)}
                      icon={
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      }
                    />
                    {/* Draft actions */}
                    {order.status === 'DRAFT' && (
                      <>
                        <ActionBtn
                          title="Edit"
                          onClick={() => handleEdit(order)}
                          icon={
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          }
                        />
                        <ActionBtn
                          title="Confirm order"
                          onClick={() => handleConfirm(order)}
                          variant="success"
                          icon={
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                          }
                        />
                        <ActionBtn
                          title="Cancel order"
                          onClick={() => handleCancel(order)}
                          variant="danger"
                          icon={
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          }
                        />
                      </>
                    )}
                    {/* Receive */}
                    {(order.status === 'CONFIRMED' || order.status === 'PARTIALLY_RECEIVED') && (
                      <ActionBtn
                        title="Receive goods"
                        onClick={() => setReceiptOrder(order)}
                        variant="receive"
                        icon={
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <rect x="1" y="3" width="15" height="13" rx="1" />
                            <path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                          </svg>
                        }
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modalOpen && (
        <PurchaseOrderModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setEditingOrder(undefined); }}
          onSubmit={handleCreateOrder}
          initialData={editingOrder}
          loading={createMutation.isPending}
        />
      )}
      {receiptOrder && (
        <GoodsReceiptModal
          isOpen={!!receiptOrder}
          onClose={() => setReceiptOrder(null)}
          purchaseOrder={receiptOrder}
          onSubmit={handleCreateReceipt}
          loading={createReceiptMutation.isPending}
        />
      )}
      <ConfirmModal />
    </div>
  );
}

// ─── Tiny reusable action button ──────────────────────────────────────────────
function ActionBtn({
  title,
  onClick,
  icon,
  variant = 'default',
}: {
  title: string;
  onClick: () => void;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'receive';
}) {
  const variantCls = {
    default: 'hover:bg-muted hover:text-foreground hover:border-border/60',
    success: 'hover:bg-green-50 hover:text-green-700 hover:border-green-200',
    danger: 'hover:bg-red-50 hover:text-red-600 hover:border-red-200',
    receive: 'hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200',
  }[variant];

  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex items-center justify-center w-7 h-7 rounded-md border border-border/40 text-muted-foreground transition-all ${variantCls}`}
    >
      {icon}
    </button>
  );
}