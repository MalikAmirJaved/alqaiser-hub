"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DocumentForm from "@/components/documents/DocumentForm";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useQuote, useMarkConvertedQuote } from "@/hooks/sales/useQuotes";
import { toast } from "sonner";

function SalesCustomerInvoiceCreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("quoteId");
  const { data: quote, isLoading: quoteLoading } = useQuote(quoteId);
  const permissions = useFeaturePermissions("SALES", "sales_customers_invoice");
  const markConverted = useMarkConvertedQuote();

  if (quoteId && quoteLoading) return <div className="p-8 text-center">Loading quote...</div>;
  if (quoteId && !quote) return <div className="p-8 text-center">Quote not found.</div>;
  if (!permissions.create) {
    return <div className="p-8 text-center">You do not have permission to create invoices.</div>;
  }

  const defaultValues = quote ? {
    customer: quote.customer || "",
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: quote.expiration_date || "",
    amount: Number(quote.total_amount),
    overall_discount_percent: Number(quote.overall_discount_percent || 0),
    overall_tax_percent: Number(quote.overall_tax_percent || 0),
    template_slug: quote.template_slug || "modern",
    accent_color: quote.accent_color || "",
    typography: quote.typography,
    notes: quote.notes || "",
    lines: (quote.lines || []).map((line) => ({
      variant: line.variant,
      quantity: line.quantity,
      unit_price: line.unit_price,
      discount_amount: line.discount_amount || 0,
      tax_rate: line.tax_rate || 0,
      variant_name: line.variant_name,
      variant_sku: line.variant_sku,
      is_manual_entry: line.is_manual_entry || false,
      manual_variant_name: line.manual_variant_name || "",
      manual_variant_sku: line.manual_variant_sku || "",
      description: line.description || "",
      vendor: line.vendor || "",
      vendor_name: line.vendor_name || "",
    })),
  } : null;

  return (
    <DocumentForm
      documentType="invoice"
      moduleCode="SALES"
      defaultValues={defaultValues}
      onClose={() => router.push("/sales/customer-invoices")}
      onSuccess={async (invoice: any) => {
        const invoiceId = invoice?.id || invoice?.data?.id;
        if (quoteId && invoiceId) {
          try {
            await markConverted.mutateAsync({ quoteId, invoiceId });
          } catch {
            toast.error("Invoice was created, but the quote could not be marked as converted.");
          }
        }
        if (invoiceId) router.replace(`/sales/customer-invoices/${invoiceId}`);
        else router.push("/sales/customer-invoices");
      }}
    />
  );
}

export default function SalesCustomerInvoiceCreatePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <SalesCustomerInvoiceCreatePageContent />
    </Suspense>
  );
}
