"use client";

import { useParams, useRouter } from "next/navigation";
import DocumentForm from "@/components/documents/DocumentForm";
import { useCustomerInvoice } from "@/hooks/finance/useCustomerInvoices";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

export default function FinanceCustomerInvoiceEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: invoice, isLoading } = useCustomerInvoice(id);
  const permissions = useFeaturePermissions("FINANCE", "customer_invoice");

  if (isLoading) return <div className="p-8 text-center">Loading invoice...</div>;
  if (!invoice) return <div className="p-8 text-center">Invoice not found.</div>;
  if (!permissions.update || !["DRAFT", "PENDING", "SENT"].includes(invoice.status) || invoice.payment_status === "PAID" || invoice.source === "SALES_POS") {
    return <div className="p-8 text-center">This invoice cannot be edited.</div>;
  }

  return (
    <DocumentForm
      documentType="invoice"
      moduleCode="FINANCE"
      initialData={invoice}
      onClose={() => router.push(`/finance/customer-invoices/${invoice.id}`)}
      onSuccess={() => router.replace(`/finance/customer-invoices/${invoice.id}`)}
    />
  );
}
