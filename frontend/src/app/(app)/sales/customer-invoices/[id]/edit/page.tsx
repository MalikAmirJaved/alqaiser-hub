"use client";

import { useParams, useRouter } from "next/navigation";
import DocumentForm from "@/components/documents/DocumentForm";
import { useSalesInvoice } from "@/hooks/sales/useSalesInvoices";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

export default function SalesCustomerInvoiceEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: invoice, isLoading } = useSalesInvoice(id);
  const permissions = useFeaturePermissions("SALES", "sales_customers_invoice");

  if (isLoading) return <div className="p-8 text-center">Loading invoice...</div>;
  if (!invoice) return <div className="p-8 text-center">Invoice not found.</div>;
  if (!permissions.update || !["DRAFT", "PENDING", "SENT"].includes(invoice.status) || invoice.payment_status === "PAID" || invoice.source === "SALES_POS") {
    return <div className="p-8 text-center">This invoice cannot be edited.</div>;
  }

  return (
    <DocumentForm
      documentType="invoice"
      moduleCode="SALES"
      initialData={invoice}
      onClose={() => router.push(`/sales/customer-invoices/${invoice.id}`)}
      onSuccess={() => router.replace(`/sales/customer-invoices/${invoice.id}`)}
    />
  );
}
