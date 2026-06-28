"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DetailLayout, StandardSidebar, RelatedRecords, type DetailTab } from "@/components/reuseable/final/DetailLayout";
import { useSupplierBill, useUpdateSupplierBill } from "@/hooks/finance/useSupplierBills";
import { usePurchaseOrder } from "@/hooks/usePurchaseOrders";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import SupplierBillFormModal from "@/components/finance/supplier-bills/SupplierBillFormModal";
import { ExternalLink, Building2, ShoppingCart, CreditCard, Calendar, FileText, MapPin, Phone, Mail, User as UserIcon } from "lucide-react";

const toNumber = (value: number | string): number => {
  return typeof value === "string" ? parseFloat(value) : value;
};

// --- Sub-components for rich display ---

function SupplierInfoCard({ bill }: { bill: any }) {
  const addressStr = getSupplierAddress(bill);
  return (
    <div className="rounded-lg border border-border/60 bg-surface-1/50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        Supplier Information
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">Name</span>
          <p className="font-medium">{bill.supplier_name || "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Code</span>
          <p className="font-medium">{bill.supplier_code || "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</span>
          <p className="font-medium">{bill.supplier_phone || "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>
          <p className="font-medium">{bill.supplier_email || "—"}</p>
        </div>
        {bill.supplier_contact_person && (
          <div className="sm:col-span-2">
            <span className="text-muted-foreground flex items-center gap-1"><UserIcon className="h-3 w-3" /> Contact Person</span>
            <p className="font-medium">{bill.supplier_contact_person}</p>
          </div>
        )}
        {addressStr !== "—" && (
          <div className="sm:col-span-2">
            <span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Address</span>
            <p className="font-medium">{addressStr}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PurchaseOrderInfoCard({ purchaseOrderId }: { purchaseOrderId: string | null }) {
  const { data: po, isLoading } = usePurchaseOrder(purchaseOrderId);
  if (!purchaseOrderId) return null;
  if (isLoading) return <div className="text-xs text-muted-foreground animate-pulse">Loading purchase order...</div>;
  if (!po) return null;

  const lines = po.lines || [];
  return (
    <div className="rounded-lg border border-border/60 bg-surface-1/50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        Items Purchased — <a href={`/inventory/purchase-orders/${po._id}`} className="text-primary hover:underline inline-flex items-center gap-1">{po.order_number} <ExternalLink className="h-3 w-3" /></a>
      </div>
      <div className="text-xs text-muted-foreground">Status: {po.status} · Total: {lines.reduce((s, l) => s + l.quantity_ordered * l.unit_cost, 0).toLocaleString()}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60 text-muted-foreground">
              <th className="text-left py-2 pr-2">Item</th>
              <th className="text-right py-2 px-2">Qty</th>
              <th className="text-right py-2 px-2">Unit Cost</th>
              <th className="text-right py-2 pl-2">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line: any) => (
              <tr key={line.id} className="border-b border-border/30">
                <td className="py-2 pr-2">
                  <span className="font-medium">{line.variant_name || line.asset_name || "Item"}</span>
                  {line.variant_sku && <span className="text-muted-foreground ml-1">({line.variant_sku})</span>}
                </td>
                <td className="text-right py-2 px-2 num">{line.quantity_ordered}</td>
                <td className="text-right py-2 px-2 num">{line.unit_cost}</td>
                <td className="text-right py-2 pl-2 num font-medium">{(line.quantity_ordered * line.unit_cost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2 pr-2">Total</td>
              <td className="text-right py-2 px-2">{lines.reduce((s, l) => s + l.quantity_ordered, 0)}</td>
              <td className="text-right py-2 px-2"></td>
              <td className="text-right py-2 pl-2">{po.total_amount}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function PaymentHistoryCard({ payments }: { payments: any[] }) {
  const formatCurrency = useFormatCurrency();
  if (!payments || payments.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-surface-1/50 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          Payment History
        </div>
        <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-surface-1/50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CreditCard className="h-4 w-4 text-muted-foreground" />
        Payment History ({payments.length})
      </div>
      <div className="space-y-2">
        {payments.map((pmt, idx) => (
          <div key={pmt.id || idx} className="flex items-center justify-between text-xs p-2 rounded-md bg-background/50 border border-border/30">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${pmt.status === "CONFIRMED" ? "bg-success" : pmt.status === "DRAFT" ? "bg-warning" : "bg-destructive"}`} />
              <div>
                <span className="font-medium">{pmt.payment_date}</span>
                <span className="text-muted-foreground ml-2">{pmt.payment_method}</span>
              </div>
              {pmt.reference_number && <span className="text-muted-foreground">Ref: {pmt.reference_number}</span>}
            </div>
            <span className="font-semibold num">{formatCurrency(Number(pmt.amount))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BillOverviewTab({ bill }: { bill: any }) {
  const formatCurrency = useFormatCurrency();
  const amount = toNumber(bill.amount);
  const paid = toNumber(bill.paid_amount);
  const outstanding = toNumber(bill.outstanding);
  const paymentPct = amount > 0 ? Math.round((paid / amount) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Bill Financial Summary */}
      <div className="rounded-lg border border-border/60 bg-surface-1/50 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Bill Summary
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-muted-foreground">Bill Amount</span>
            <p className="text-lg font-semibold num">{formatCurrency(amount)}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Paid</span>
            <p className="text-lg font-semibold num text-success">{formatCurrency(paid)}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Outstanding</span>
            <p className={`text-lg font-semibold num ${outstanding > 0 ? "text-warning" : "text-success"}`}>{formatCurrency(outstanding)}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Payment Progress</span>
            <div className="mt-1">
              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full transition-all" style={{ width: `${paymentPct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground num mt-0.5 block">{paymentPct}% paid</span>
            </div>
          </div>
        </div>
      </div>

      {/* Why I Pay — Notes / Reason */}
      {bill.notes && (
        <div className="rounded-lg border border-border/60 bg-surface-1/50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Reason / Notes
          </div>
          <p className="text-sm whitespace-pre-wrap">{bill.notes}</p>
        </div>
      )}

      {/* Which Is I Buying — Purchase Order Items */}
      {bill.purchase_order && <PurchaseOrderInfoCard purchaseOrderId={bill.purchase_order} />}

      {/* Where I Buying — Supplier Info */}
      <SupplierInfoCard bill={bill} />

      {/* Payment History */}
      {bill.payments && <PaymentHistoryCard payments={bill.payments} />}

      {/* Timeline */}
      <div className="rounded-lg border border-border/60 bg-surface-1/50 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          Timeline
        </div>
        <div className="space-y-3">
          {[
            { label: "Bill Date", value: bill.bill_date, icon: "📅" },
            { label: "Due Date", value: bill.due_date, icon: "⏰" },
            { label: "Created", value: new Date(bill.created_at).toLocaleString(), icon: "🆕" },
            { label: "Last Updated", value: new Date(bill.updated_at).toLocaleString(), icon: "🔄" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 text-xs">
              <span className="text-base">{item.icon}</span>
              <span className="text-muted-foreground w-24">{item.label}</span>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Helper to build supplier address ---
function getSupplierAddress(bill: any): string {
  return [bill.supplier_address, bill.supplier_city, bill.supplier_state, bill.supplier_country, bill.supplier_postal_code].filter(Boolean).join(", ") || "—";
}

export default function SupplierBillDetailPage() {
  const formatCurrency = useFormatCurrency();
  const { id } = useParams();
  const router = useRouter();
  const { data: bill, isLoading, refetch } = useSupplierBill(id as string);
  const permissions = useFeaturePermissions("FINANCE", "supplier_bill");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any>(null);

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!bill) return <div className="p-8 text-center">Bill not found</div>;

  const amount = toNumber(bill.amount);
  const paidAmount = toNumber(bill.paid_amount);
  const outstanding = toNumber(bill.outstanding);
  const payments = bill.payments || [];

  const handleEdit = () => {
    setEditingBill(bill);
    setModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    refetch();
    setModalOpen(false);
    setEditingBill(null);
  };

  // Build related records
  const relatedItems: { id: string; type: string; title: string; amount?: string; status?: string }[] = [];
  if (bill.purchase_order) {
    relatedItems.push({
      id: bill.purchase_order,
      type: "Purchase Order",
      title: bill.purchase_order_number || "PO reference",
      amount: formatCurrency(amount),
      status: bill.purchase_order_status || "—",
    });
  }
  if (bill.journal_entry) {
    relatedItems.push({
      id: String(bill.journal_entry),
      type: "Journal",
      title: "Journal entry",
      status: "Posted",
    });
  }
  payments.forEach((pmt: any) => {
    relatedItems.push({
      id: pmt.id,
      type: "Payment",
      title: `${pmt.payment_date} — ${pmt.payment_method}`,
      amount: formatCurrency(Number(pmt.amount)),
      status: pmt.status === "CONFIRMED" ? "Confirmed" : pmt.status,
    });
  });

  const paymentSummaryTone = outstanding > 0 ? "warning" : "success";
  const daysOverdue = bill.due_date ? Math.max(0, Math.floor((new Date().getTime() - new Date(bill.due_date).getTime()) / (1000 * 60 * 60 * 24))) : 0;

  const tabs: DetailTab[] = [
    {
      id: "overview",
      label: "Overview",
      render: () => <BillOverviewTab bill={bill} />,
    },
  ];

  if (relatedItems.length > 0) {
    tabs.push({
      id: "related",
      label: "Related",
      count: relatedItems.length,
      render: () => <RelatedRecords items={relatedItems} />,
    });
  }

  const subtitleParts = [
    `Bill Date: ${bill.bill_date}`,
    `Due: ${bill.due_date}`,
    daysOverdue > 0 ? `${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue` : "",
  ].filter(Boolean);

  return (
    <>
      <DetailLayout
        breadcrumbs={["Payables", "Supplier Bills", bill.bill_number]}
        entityId={bill.bill_number}
        title={`${bill.supplier_name || "Supplier"} — ${bill.bill_number}`}
        status={bill.payment_status || bill.status}
        subtitle={subtitleParts.join(" · ")}
        data={bill}
        meta={[
          { label: "Supplier", value: bill.supplier_name || "—" },
          { label: "Supplier Code", value: bill.supplier_code || "—" },
          { label: "PO Reference", value: bill.purchase_order_number || "—" },
          { label: "Due Date", value: bill.due_date },
        ]}
        summary={[
          { label: "Bill Total", value: amount, tone: "info", isCurrency: true },
          { label: "Paid", value: paidAmount, tone: "success", isCurrency: true },
          { label: "Outstanding", value: outstanding, tone: outstanding > 0 ? "warning" : "success", isCurrency: true },
          { label: "Due Date", value: bill.due_date, isCurrency: false },
        ]}
        tabs={tabs}
        sidebar={
          <StandardSidebar
            riskIndicators={[
              { label: "Payment status", value: bill.payment_status || bill.status, tone: paymentSummaryTone },
              { label: "High value", value: amount > 50000 ? "> $50k" : "Within limit", tone: amount > 50000 ? "warning" : "success" },
              { label: "Overdue", value: daysOverdue > 0 ? `${daysOverdue}d overdue` : "On time", tone: daysOverdue > 0 ? "destructive" : "success" },
              { label: "Payments", value: `${payments.length} payment${payments.length !== 1 ? "s" : ""}`, tone: payments.length > 0 ? "success" : "info" },
            ]}
            metadata={[
              ["Created", new Date(bill.created_at).toLocaleString()],
              ["Created by", String(bill.created_by || "-")],
              ["Modified", new Date(bill.updated_at).toLocaleString()],
              ["Bill Date", bill.bill_date || "-"],
              ["Due Date", bill.due_date || "-"],
              ["Supplier Code", bill.supplier_code || "-"],
              ["Supplier Phone", bill.supplier_phone || "-"],
              ["Supplier Email", bill.supplier_email || "-"],
              ["Supplier Address", getSupplierAddress(bill)],
              ["Source", bill.purchase_order ? "Purchase Order" : "Manual"],
            ]}
          />
        }
        onPrimaryAction={() => router.push(`/finance/payments/new?bill=${bill.id}`)}
        primaryActionLabel={outstanding > 0 ? "Record Payment" : undefined}
        permissions={{ view: true }}
        currencyFormatter={formatCurrency}
      />
      <SupplierBillFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingBill(null);
        }}
        initialData={editingBill}
        onSuccess={handleUpdateSuccess}
      />
    </>
  );
}
