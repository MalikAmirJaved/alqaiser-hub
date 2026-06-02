'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Truck,
  CheckCircle,
  XCircle,
  Package,
  ClipboardList,
  PackageCheck,
} from 'lucide-react';
import {
  usePurchaseOrder,
  useConfirmPurchaseOrder,
  useCancelPurchaseOrder,
} from '@/hooks/usePurchaseOrders';
import { useGoodsReceipts, useCreateGoodsReceipt } from '@/hooks/useGoodsReceipts';
import { useConfirmationModal } from '@/components/reuseable/ConfirmationModal';
import { GoodsReceiptModal } from '@/components/inventory/purchase/GoodsReceiptModal';
import type { GoodsReceiptPayload } from '@/types/purchase';
import { formatCurrency } from "@/lib/currency";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
  CONFIRMED: { label: 'Confirmed', cls: 'bg-blue-50 text-blue-700 border border-blue-100' },
  PARTIALLY_RECEIVED: { label: 'Partially Received', cls: 'bg-amber-50 text-amber-700 border border-amber-100' },
  FULLY_RECEIVED: { label: 'Fully Received', cls: 'bg-green-50 text-green-700 border border-green-100' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-red-50 text-red-600 border border-red-100' },
};

const LINE_STATUS: Record<string, { label: string; cls: string }> = {
  FULLY_RECEIVED: { label: 'Received', cls: 'bg-green-50 text-green-700 border border-green-100' },
  PARTIALLY_RECEIVED: { label: 'Partial', cls: 'bg-amber-50 text-amber-700 border border-amber-100' },
  PENDING: { label: 'Pending', cls: 'bg-gray-100 text-gray-500 border border-gray-200' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-red-50 text-red-500 border border-red-100' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function MiniStatusBadge({ status }: { status: string }) {
  const cfg = LINE_STATUS[status] ?? LINE_STATUS.PENDING;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function fmt(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDt(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function fmtAmt(val?: string | number) {
  return Number(val ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: order, isLoading } = usePurchaseOrder(id as string);
  const { data: receipts = [] } = useGoodsReceipts(id as string);
  const confirmMutation = useConfirmPurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();
  const createReceiptMutation = useCreateGoodsReceipt();
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Package className="w-10 h-10 opacity-30" />
        <p className="text-sm">Purchase order not found</p>
        <button onClick={() => router.back()} className="text-xs underline">Go back</button>
      </div>
    );
  }

  // ── Receipt progress ────────────────────────────────────────────────────────
  const totalOrdered = order.lines.reduce((s, l) => s + l.quantity_ordered, 0);
  const totalReceived = order.lines.reduce((s, l) => s + l.quantity_received, 0);
  const progressPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleConfirm = () =>
    confirm({
      title: 'Confirm Order',
      message: `Confirm order ${order.order_number}? This will allow receiving goods.`,
      type: 'warning',
      onConfirm: async () => { await confirmMutation.mutateAsync(order._id); },
    });

  const handleCancel = () =>
    confirm({
      title: 'Cancel Order',
      message: `Cancel order ${order.order_number}? This cannot be undone.`,
      type: 'danger',
      onConfirm: async () => { await cancelMutation.mutateAsync(order._id); },
    });

  const handleReceive = async (data: GoodsReceiptPayload) => {
    await createReceiptMutation.mutateAsync(data);
    setReceiptModalOpen(false);
  };

  const canReceive =
    order.status === 'CONFIRMED' || order.status === 'PARTIALLY_RECEIVED';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Purchase Orders
      </button>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-medium font-mono">{order.order_number}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Created {fmt(order.created_at)}
            {order.updated_at && order.updated_at !== order.created_at
              ? ` · Updated ${fmt(order.updated_at)}`
              : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {order.status === 'DRAFT' && (
            <>
              <ActionButton
                onClick={handleConfirm}
                variant="success"
                icon={<CheckCircle className="w-4 h-4" />}
                loading={confirmMutation.isPending}
              >
                Confirm Order
              </ActionButton>
              <ActionButton
                onClick={handleCancel}
                variant="danger"
                icon={<XCircle className="w-4 h-4" />}
              >
                Cancel
              </ActionButton>
            </>
          )}
          {canReceive && (
            <>
              <ActionButton
                onClick={() => setReceiptModalOpen(true)}
                variant="receive"
                icon={<Truck className="w-4 h-4" />}
              >
                Receive Goods
              </ActionButton>
              <ActionButton
                onClick={handleCancel}
                variant="danger"
                icon={<XCircle className="w-4 h-4" />}
              >
                Cancel Order
              </ActionButton>
            </>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Order info card */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <SectionTitle icon={<ClipboardList className="w-3.5 h-3.5" />}>Order info</SectionTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <InfoRow label="Supplier" value={order.supplier_name} />
            <InfoRow label="Warehouse" value={order.warehouse_name} />
            <InfoRow label="Order date" value={fmt(order.order_date)} />
            <InfoRow label="Expected delivery" value={fmt(order.expected_delivery_date)} />
            <InfoRow
              label="Order total"
              value={<span className="font-medium text-base">{formatCurrency(order.total_amount)}</span>}
            />
            {order.notes && <InfoRow label="Notes" value={order.notes} />}
          </dl>
        </div>

        {/* Receipt progress card */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <SectionTitle icon={<PackageCheck className="w-3.5 h-3.5" />}>Receipt progress</SectionTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <InfoRow label="Lines" value={`${order.lines.length} items`} />
            <InfoRow label="Units ordered" value={String(totalOrdered)} />
            <InfoRow
              label="Units received"
              value={<span className="text-green-600 font-medium">{totalReceived}</span>}
            />
            <InfoRow
              label="Units pending"
              value={
                <span className={totalOrdered - totalReceived > 0 ? 'text-amber-600 font-medium' : ''}>
                  {totalOrdered - totalReceived}
                </span>
              }
            />
            <InfoRow label="Receipts" value={`${receipts.length} goods receipt${receipts.length !== 1 ? 's' : ''}`} />
          </dl>

          <div className="pt-1">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Received</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Line items table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium">Line items</h3>
          <span className="text-xs text-muted-foreground">{order.lines.length} items</span>
        </div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 text-left">Product / Variant</th>
              <th className="px-4 py-2.5 text-left">SKU</th>
              <th className="px-4 py-2.5 text-right">Ordered</th>
              <th className="px-4 py-2.5 text-right">Received</th>
              <th className="px-4 py-2.5 text-right">Pending</th>
              <th className="px-4 py-2.5 text-right">Unit cost</th>
              <th className="px-4 py-2.5 text-right">Line total</th>
              <th className="px-4 py-2.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => {
              const lineStatus =
                line.quantity_received >= line.quantity_ordered
                  ? 'FULLY_RECEIVED'
                  : line.quantity_received > 0
                  ? 'PARTIALLY_RECEIVED'
                  : 'PENDING';

              return (
                <tr key={line.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{line.variant_name}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {line.variant_sku}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{line.quantity_ordered}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${line.quantity_received > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {line.quantity_received}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${line.quantity_pending > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                    {line.quantity_pending}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(line.unit_cost)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {formatCurrency(line.line_total)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MiniStatusBadge status={lineStatus} />
                  </td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr className="bg-muted/40 border-t border-border">
              <td colSpan={6} className="px-4 py-2.5 text-right text-sm text-muted-foreground font-medium">
                Order total
              </td>
              <td className="px-4 py-2.5 text-right text-sm font-semibold">
                {formatCurrency(order.total_amount)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Goods receipts */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium">Goods Receipts</h3>
          {canReceive && (
            <button
              onClick={() => setReceiptModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
            >
              <Truck className="w-3.5 h-3.5" /> New Receipt
            </button>
          )}
        </div>

        {receipts.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No goods received yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {receipts.map((gr) => (
              <div key={gr.id} className="flex items-start gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <PackageCheck className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium font-mono">{gr.receipt_number}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtDt(gr.received_date)}</p>
                  {gr.notes && (
                    <p className="text-xs text-muted-foreground/70 mt-1 truncate">{gr.notes}</p>
                  )}
                </div>
                <div className="text-xs font-medium text-muted-foreground flex-shrink-0 self-center">
                  {gr.lines?.reduce((s: number, l: { quantity_received: number }) => s + l.quantity_received, 0) ?? 0} units
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {receiptModalOpen && (
        <GoodsReceiptModal
          isOpen={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          purchaseOrder={order}
          onSubmit={handleReceive}
          loading={createReceiptMutation.isPending}
        />
      )}
      <ConfirmModal />
    </div>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground pb-2 border-b border-border">
      {icon}
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </>
  );
}

function ActionButton({
  children,
  onClick,
  icon,
  variant,
  loading,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon: React.ReactNode;
  variant: 'success' | 'danger' | 'receive';
  loading?: boolean;
}) {
  const cls = {
    success: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    danger: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100',
    receive: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border rounded-lg transition-colors disabled:opacity-50 ${cls}`}
    >
      {icon}
      {loading ? 'Processing…' : children}
    </button>
  );
}