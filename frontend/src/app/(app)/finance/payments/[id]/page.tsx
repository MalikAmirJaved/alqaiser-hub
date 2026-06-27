"use client";

import { useParams } from "next/navigation";
import { DetailLayout, StandardSidebar } from "@/components/reuseable/final/DetailLayout";
import { usePayment } from "@/hooks/finance/usePayments";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { ExternalLink, Building2, User, Banknote, Calendar, FileText, CreditCard, CheckCircle, XCircle, Clock } from "lucide-react";

const toNumber = (value: number | string): number => {
  return typeof value === "string" ? parseFloat(value) : value;
};

// --- Sub-components ---

function PayableInfoCard({ payment }: { payment: any }) {
  const isPayment = payment.payment_type === "PAYMENT";
  const icon = isPayment ? Building2 : User;
  const label = isPayment ? "Paid To (Supplier)" : "Received From (Customer)";
  const name = isPayment ? payment.supplier_name : payment.customer_name;
  const Icon = icon;

  // Build a link to the source document
  const sourceLinks: { label: string; href: string }[] = [];
  if (payment.payable_type === "supplier_bill" && payment.payable_id) {
    sourceLinks.push({ label: payment.payable_label || "View Bill", href: `/finance/supplier-bills/${payment.payable_id}` });
  } else if (payment.payable_type === "customer_invoice" && payment.payable_id) {
    sourceLinks.push({ label: payment.payable_label || "View Invoice", href: `/finance/customer-invoices/${payment.payable_id}` });
  } else if (payment.payable_type === "expense" && payment.payable_id) {
    sourceLinks.push({ label: payment.payable_label || "View Expense", href: `/finance/expenses/${payment.payable_id}` });
  } else if (payment.payable_type === "pos_sale" && payment.payable_id) {
    sourceLinks.push({ label: payment.payable_label || "View Sale", href: `/sales/orders/${payment.payable_id}` });
  }

  return (
    <div className="rounded-lg border border-border/60 bg-surface-1/50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </div>
      <div className="space-y-2 text-sm">
        {name && (
          <div>
            <span className="text-muted-foreground">Name</span>
            <p className="font-medium">{name}</p>
          </div>
        )}
        {payment.payable_label && (
          <div>
            <span className="text-muted-foreground">Document</span>
            <p className="font-medium">{payment.payable_label}</p>
          </div>
        )}
        {sourceLinks.length > 0 && (
          <div className="pt-1 flex flex-wrap gap-2">
            {sourceLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentMethodCard({ payment }: { payment: any }) {
  const methodIcons: Record<string, string> = {
    CASH: "💵",
    BANK_TRANSFER: "🏦",
    CHEQUE: "📄",
    CREDIT_CARD: "💳",
    OTHER: "🔗",
  };
  const methodLabels: Record<string, string> = {
    CASH: "Cash",
    BANK_TRANSFER: "Bank Transfer",
    CHEQUE: "Cheque",
    CREDIT_CARD: "Credit Card",
    OTHER: "Other",
  };
  return (
    <div className="rounded-lg border border-border/60 bg-surface-1/50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CreditCard className="h-4 w-4 text-muted-foreground" />
        Payment Method
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">{methodIcons[payment.payment_method] || "💳"}</span>
          <span className="font-medium">{methodLabels[payment.payment_method] || payment.payment_method}</span>
        </div>
        {payment.bank_account_name && (
          <div>
            <span className="text-muted-foreground">Bank Account</span>
            <p className="font-medium">{payment.bank_account_name}</p>
          </div>
        )}
        {payment.reference_number && (
          <div>
            <span className="text-muted-foreground">Reference</span>
            <p className="font-medium">{payment.reference_number}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentTimelineCard({ payment }: { payment: any }) {
  const events = [
    {
      icon: "📝",
      label: "Payment Created",
      value: new Date(payment.created_at).toLocaleString(),
      status: "completed",
    },
    {
      icon: "✅",
      label: "Payment Confirmed",
      value: payment.status === "CONFIRMED" ? new Date(payment.updated_at).toLocaleString() : "Pending",
      status: payment.status === "CONFIRMED" ? "completed" : "pending",
    },
    {
      icon: "📒",
      label: "Journal Entry",
      value: payment.journal_entry ? "Posted" : "Not created",
      status: payment.journal_entry ? "completed" : "pending",
    },
  ];

  if (payment.status === "CANCELLED") {
    events.push({
      icon: "❌",
      label: "Cancelled",
      value: new Date(payment.updated_at).toLocaleString(),
      status: "cancelled",
    });
  }

  return (
    <div className="rounded-lg border border-border/60 bg-surface-1/50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Clock className="h-4 w-4 text-muted-foreground" />
        Timeline
      </div>
      <div className="space-y-0">
        {events.map((event, idx) => (
          <div key={idx} className="flex items-start gap-3 pb-3 relative">
            {idx < events.length - 1 && (
              <div className={`absolute left-[11px] top-6 w-0.5 h-full ${
                event.status === "completed" ? "bg-success/40" : "bg-border"
              }`} />
            )}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 shrink-0 ${
              event.status === "completed"
                ? "border-success bg-success/10"
                : event.status === "cancelled"
                ? "border-destructive bg-destructive/10"
                : "border-border bg-background"
            }`}>
              {event.status === "completed" ? (
                <CheckCircle className="h-3 w-3 text-success" />
              ) : event.status === "cancelled" ? (
                <XCircle className="h-3 w-3 text-destructive" />
              ) : (
                <Clock className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-xs font-medium">{event.label}</div>
              <div className={`text-xs ${event.status === "completed" ? "text-muted-foreground" : event.status === "cancelled" ? "text-destructive" : "text-warning"}`}>
                {event.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransactionDetailsCard({ payment }: { payment: any }) {
  const formatCurrency = useFormatCurrency();
  const amount = toNumber(payment.amount);
  return (
    <div className="rounded-lg border border-border/60 bg-surface-1/50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Banknote className="h-4 w-4 text-muted-foreground" />
        Transaction Details
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">Amount</span>
          <p className="text-lg font-semibold num">{formatCurrency(amount)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Date</span>
          <p className="font-medium">{payment.payment_date}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Type</span>
          <p className="font-medium">{payment.payment_type === "RECEIPT" ? "Receipt (from Customer)" : "Payment (to Supplier)"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Status</span>
          <p className={`font-medium ${
            payment.status === "CONFIRMED" ? "text-success" :
            payment.status === "CANCELLED" ? "text-destructive" : "text-warning"
          }`}>{payment.status}</p>
        </div>
      </div>
    </div>
  );
}

function NotesCard({ payment }: { payment: any }) {
  if (!payment.notes) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-surface-1/50 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <FileText className="h-4 w-4 text-muted-foreground" />
        Notes
      </div>
      <p className="text-sm whitespace-pre-wrap">{payment.notes}</p>
    </div>
  );
}

export default function PaymentDetailPage() {
  const formatCurrency = useFormatCurrency();
  const { id } = useParams();
  const { data: payment, isLoading } = usePayment(id as string);
  const permissions = useFeaturePermissions("FINANCE", "payment");

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!payment) return <div className="p-8 text-center">Payment not found</div>;

  const amount = toNumber(payment.amount);
  const isReceipt = payment.payment_type === "RECEIPT";
  const statusLabel = payment.status === "CONFIRMED" ? "Confirmed" : payment.status === "DRAFT" ? "Draft" : "Cancelled";

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      render: () => (
        <div className="space-y-5">
          {/* Transaction Summary */}
          <TransactionDetailsCard payment={payment} />

          {/* Who it's to/from — Payable Info */}
          <PayableInfoCard payment={payment} />

          {/* How it was paid */}
          <PaymentMethodCard payment={payment} />

          {/* Notes */}
          <NotesCard payment={payment} />

          {/* Timeline */}
          <PaymentTimelineCard payment={payment} />
        </div>
      ),
    },
  ];

  return (
    <DetailLayout
      breadcrumbs={["Banking & Cash", "Payments", `${isReceipt ? "Receipt" : "Payment"} #${payment.reference_number || payment.id.slice(0, 8)}`]}
      entityId={payment.reference_number || payment.id.slice(0, 8)}
      title={`${isReceipt ? "Receipt" : "Payment"} — ${payment.reference_number || payment.id.slice(0, 8)}`}
      status={statusLabel}
      subtitle={`${payment.payment_date} · ${payment.payment_method}`}
      data={payment}
      meta={[
        { label: "Type", value: isReceipt ? "Receipt (from Customer)" : "Payment (to Supplier)" },
        { label: "Method", value: payment.payment_method },
        { label: "Bank Account", value: payment.bank_account_name || "—" },
        { label: "Payable", value: payment.payable_label || "—" },
      ]}
      summary={[
        { label: "Amount", value: amount, tone: "info", isCurrency: true },
        {
          label: "Document",
          value: payment.payable_label || "—",
          tone: "info",
          isCurrency: false,
        },
        {
          label: "Status",
          value: statusLabel,
          tone: payment.status === "CONFIRMED" ? "success" : payment.status === "CANCELLED" ? "destructive" : "warning",
          isCurrency: false,
        },
        {
          label: "Payment Date",
          value: payment.payment_date,
          isCurrency: false,
        },
      ]}
      tabs={tabs}
      sidebar={
        <StandardSidebar
          riskIndicators={[
            {
              label: "Type",
              value: isReceipt ? "Receipt (Incoming)" : "Payment (Outgoing)",
              tone: isReceipt ? "success" : "info",
            },
            {
              label: "Amount",
              value: formatCurrency(amount),
              tone: amount > 10000 ? "warning" : "success",
            },
            {
              label: "Status",
              value: statusLabel,
              tone: payment.status === "CONFIRMED" ? "success" : payment.status === "CANCELLED" ? "destructive" : "warning",
            },
          ]}
          metadata={[
            ["Created", new Date(payment.created_at).toLocaleString()],
            ["Updated", new Date(payment.updated_at).toLocaleString()],
            ["Payment Date", payment.payment_date],
            ["Reference", payment.reference_number || "-"],
            ["Payable Type", payment.payable_type || "-"],
            ["Payable Label", payment.payable_label || "-"],
            ["Bank Account", payment.bank_account_name || "-"],
            ["Journal Entry", payment.journal_entry || "Not posted"],
          ]}
        />
      }
      permissions={{ view: true }}
      currencyFormatter={formatCurrency}
    />
  );
}
