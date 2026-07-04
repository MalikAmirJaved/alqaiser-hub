"use client";

import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, RotateCcw, Receipt, ShoppingCart,
  CheckCircle2, XCircle, Loader2, User,
} from "lucide-react";
import { useReturnDetail, useCancelReturn } from "@/hooks/useReturns";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { format } from "date-fns";

const STATUS_CONFIG: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; cls: string }> = {
  INVOICE: { icon: <Receipt className="w-4 h-4" />, cls: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  POS: { icon: <ShoppingCart className="w-4 h-4" />, cls: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" },
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.INVOICE;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.icon}
      {type === "INVOICE" ? "Customer Invoice" : "POS Sale"}
    </span>
  );
}

export default function ReturnDetailPage() {
  const formatCurrency = useFormatCurrency();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: detail, isLoading } = useReturnDetail(id);
  const cancelMutation = useCancelReturn();
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <RotateCcw className="w-10 h-10 opacity-30" />
        <p className="text-sm">Return not found</p>
        <button onClick={() => router.back()} className="text-xs underline">Go back</button>
      </div>
    );
  }

  const handleCancel = () => {
    confirm({
      title: "Cancel Return",
      message: `Cancel return ${detail.return_number}? This cannot be undone.`,
      type: "danger",
      onConfirm: async () => {
        await cancelMutation.mutateAsync(id);
        router.back();
      },
    });
  };

  const fmtDt = (d?: string | null) => {
    if (!d) return "—";
    return format(new Date(d), "MMM d, yyyy HH:mm");
  };

  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        onClick={() => router.push("/inventory/returns")}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Returns
      </button>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-medium font-mono">{detail.return_number}</h1>
            <StatusBadge status={detail.status} />
            <TypeBadge type={detail.return_type} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Created {fmtDt(detail.created_at)}
            {detail.updated_at !== detail.created_at && ` · Updated ${fmtDt(detail.updated_at)}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {detail.status === "DRAFT" && (
            <button
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border rounded-lg transition-colors bg-red-50 text-red-600 border-red-200 hover:bg-red-100 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              {cancelMutation.isPending ? "Cancelling…" : "Cancel Return"}
            </button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Document info */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <SectionTitle icon={<Receipt className="w-3.5 h-3.5" />}>Document Info</SectionTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <InfoRow label="Document" value={detail.document_number} />
            <InfoRow label="Customer" value={detail.customer_name || "—"} />
            <InfoRow label="Return Date" value={detail.return_date ? format(new Date(detail.return_date), "MMM d, yyyy") : "—"} />
            <InfoRow label="Warehouse" value={detail.warehouse_name || "—"} />
            <InfoRow label="Total Refund" value={<span className="font-semibold text-base">{formatCurrency(detail.total_refund_amount)}</span>} />
            {detail.reason && <InfoRow label="Reason" value={detail.reason} />}
          </dl>
        </div>

        {/* Whodunnit */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <SectionTitle icon={<User className="w-3.5 h-3.5" />}>Audit Trail</SectionTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <InfoRow
              label="Created by"
              value={
                <span>
                  <span className="font-medium">{detail.created_by_name || "—"}</span>
                  <span className="text-xs text-muted-foreground ml-1">({fmtDt(detail.created_at)})</span>
                </span>
              }
            />
            <InfoRow
              label="Updated by"
              value={
                <span>
                  <span className="font-medium">{detail.updated_by_name || "—"}</span>
                  <span className="text-xs text-muted-foreground ml-1">({fmtDt(detail.updated_at)})</span>
                </span>
              }
            />
            {detail.completed_by_name && (
              <InfoRow
                label="Completed by"
                value={
                  <span>
                    <span className="font-medium">{detail.completed_by_name}</span>
                    <span className="text-xs text-muted-foreground ml-1">({fmtDt(detail.completed_at)})</span>
                  </span>
                }
              />
            )}
          </dl>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <SectionTitle icon={<RotateCcw className="w-3.5 h-3.5" />}>Return Lines</SectionTitle>
          <span className="text-xs text-muted-foreground">{detail.lines?.length || 0} items</span>
        </div>

        {(!detail.lines || detail.lines.length === 0) ? (
          <div className="py-10 text-center text-muted-foreground">
            <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No line items</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">Product</th>
                  <th className="px-4 py-2.5 text-left">SKU</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5 text-right">Unit Price</th>
                  <th className="px-4 py-2.5 text-right">Refund</th>
                  <th className="px-4 py-2.5 text-center">Restock</th>
                  <th className="px-4 py-2.5 text-center">To Supplier</th>
                  <th className="px-4 py-2.5 text-left">Disposition</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((line) => (
                  <tr key={line._id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{line.variant_name || line.manual_variant_name || "—"}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {line.variant_sku || line.manual_variant_sku || "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{line.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(line.unit_price)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatCurrency(line.refund_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {line.restock ? <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" /> : <XCircle className="w-4 h-4 text-muted-foreground inline" />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {line.return_to_supplier ? <CheckCircle2 className="w-4 h-4 text-amber-500 inline" /> : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {(line.disposition_action || line.return_to_supplier || line.restock) && (
                        <span className="text-xs">
                          {line.disposition_action === "GO_TO_PRODUCT" && "Go to Product"}
                          {line.disposition_action === "RETURN_TO_SUPPLIER" && "Return to Supplier"}
                          {line.product_qty !== undefined && line.product_qty > 0 && (
                            <span className="text-muted-foreground">
                              {line.disposition_action ? " · " : ""}Product: {line.product_qty}
                            </span>
                          )}
                          {line.damage_qty !== undefined && line.damage_qty > 0 && (
                            <span className="text-red-500">
                              {line.product_qty ? " · " : ""}Damage: {line.damage_qty}
                            </span>
                          )}
                        </span>
                      )}
                      {!line.disposition_action && !line.return_to_supplier && !line.restock && "—"}
                    </td>
                  </tr>
                ))}
                {/* Total row */}
                <tr className="bg-muted/40 border-t border-border">
                  <td colSpan={4} className="px-4 py-2.5 text-right text-sm text-muted-foreground font-medium">
                    Total Refund
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-semibold">
                    {formatCurrency(detail.total_refund_amount)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>

            {/* Damage reasons */}
            {detail.lines.some((l) => (l.damage_qty ?? 0) > 0 && l.damage_reason) && (
              <div className="px-4 py-3 border-t border-border space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Damage Reasons</p>
                {detail.lines.filter((l) => (l.damage_qty ?? 0) > 0 && l.damage_reason).map((l) => (
                  <p key={l._id} className="text-xs text-muted-foreground">
                    <span className="font-medium">{l.variant_name || l.manual_variant_name}</span>
                    {": "}"{l.damage_reason}" ({(l.damage_qty ?? 0)} unit{(l.damage_qty ?? 0) !== 1 ? "s" : ""})
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer timestamps */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span>Created: {fmtDt(detail.created_at)}</span>
        {detail.completed_at && <span>Completed: {fmtDt(detail.completed_at)}</span>}
        <span className="ml-auto">ID: {detail._id}</span>
      </div>

      <ConfirmModal />
    </div>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {icon}
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground whitespace-nowrap">{label}</dt>
      <dd className="text-right">{value}</dd>
    </>
  );
}
