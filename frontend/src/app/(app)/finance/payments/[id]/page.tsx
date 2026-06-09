"use client";

import { useParams } from "next/navigation";
import { DetailLayout, StandardSidebar } from "@/components/reuseable/final/DetailLayout";
import { usePayment } from "@/hooks/finance/usePayments";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { formatCurrency } from "@/lib/currency";

export default function PaymentDetailPage() {
  const { id } = useParams();
  const { data: payment, isLoading } = usePayment(id as string);
  const permissions = useFeaturePermissions("FINANCE", "payment");

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!payment) return <div className="p-8 text-center">Payment not found</div>;

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      render: () => (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Type", payment.payment_type === "RECEIPT" ? "Receipt (Customer)" : "Payment (Supplier)"],
            ["Amount", formatCurrency(payment.amount)],
            ["Date", payment.payment_date],
            ["Method", payment.payment_method],
            ["Reference", payment.reference_number || "-"],
            ["Notes", payment.notes || "-"],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">{l}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <DetailLayout
      breadcrumbs={["Banking & Cash", "Payments", payment.id.slice(0, 8)]}
      entityId={payment.id.slice(0, 8)}
      title={`${payment.payment_type === "RECEIPT" ? "Receipt" : "Payment"} ${payment.reference_number || payment.id.slice(0, 8)}`}
      status={payment.journal_entry ? "Posted" : "Draft"}
      subtitle={payment.payment_date}
      data={payment}
      meta={[
        { label: "Type", value: payment.payment_type === "RECEIPT" ? "Receipt" : "Payment" },
        { label: "Method", value: payment.payment_method },
        { label: "Bank Account", value: payment.bank_account_name || "-" },
      ]}
      tabs={tabs}
      sidebar={<StandardSidebar metadata={[["Created", new Date(payment.created_at).toLocaleString()]]} />}
      permissions={{ view: true }}
      currencyFormatter={formatCurrency}
    />
  );
}