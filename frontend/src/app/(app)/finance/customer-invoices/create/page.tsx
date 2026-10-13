"use client";

import { useRouter } from "next/navigation";
import DocumentForm from "@/components/documents/DocumentForm";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

export default function FinanceCustomerInvoiceCreatePage() {
  const router = useRouter();
  const permissions = useFeaturePermissions("FINANCE", "customer_invoice");

  if (!permissions.create) {
    return <div className="p-8 text-center">You do not have permission to create invoices.</div>;
  }

  return (
    <DocumentForm
      documentType="invoice"
      moduleCode="FINANCE"
      onClose={() => router.push("/finance/customer-invoices")}
      onSuccess={(invoice: any) => {
        const invoiceId = invoice?.id || invoice?.data?.id;
        if (invoiceId) router.replace(`/finance/customer-invoices/${invoiceId}`);
        else router.push("/finance/customer-invoices");
      }}
    />
  );
}
