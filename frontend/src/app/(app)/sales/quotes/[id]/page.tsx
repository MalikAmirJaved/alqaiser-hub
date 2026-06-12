"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DetailLayout, StandardSidebar, RelatedRecords, type DetailTab } from "@/components/reuseable/final/DetailLayout";
import { useQuote, useUpdateQuote, useAcceptQuote, useRejectQuote } from "@/hooks/sales/useQuotes";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import QuoteFormModal from "@/components/sales/QuoteFormModal";

export default function QuoteDetailPage() {
    const formatCurrency = useFormatCurrency();
  const { id } = useParams();
  const router = useRouter();
  const { data: quote, isLoading, refetch } = useQuote(id as string);
  const updateQuote = useUpdateQuote();
  const acceptQuote = useAcceptQuote();
  const rejectQuote = useRejectQuote();
  const permissions = useFeaturePermissions("SALES", "quote");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<any>(null);

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!quote) return <div className="p-8 text-center">Quote not found</div>;

  const handleEdit = () => {
    setEditingQuote(quote);
    setModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    refetch();
    setModalOpen(false);
    setEditingQuote(null);
  };

  const handleAccept = async () => {
    try {
      const res = await acceptQuote.mutateAsync(quote.id);
      if (res.invoice_id) {
        router.push(`/sales/customer-invoices/${res.invoice_id}`);
      }
      refetch();
    } catch (error) {
      console.error("Accept failed", error);
    }
  };

  const handleReject = async () => {
    try {
      await rejectQuote.mutateAsync(quote.id);
      refetch();
    } catch (error) {
      console.error("Reject failed", error);
    }
  };

  const tabs: DetailTab[] = [
    {
      id: "items",
      label: "Quote Items",
      count: quote.lines?.length || 0,
      render: () => (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
              <tr>
                <th className="px-4 py-2 text-left">Product</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Unit Price</th>
                <th className="px-4 py-2 text-right">Discount</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.lines?.map((line, idx) => {
                const lineTotal = line.quantity * line.unit_price - (line.discount_amount || 0);
                return (
                  <tr key={idx} className="border-b border-border/60">
                    <td className="px-4 py-2">
                      <div className="font-medium">{line.variant_name || line.variant_sku}</div>
                      <div className="text-xs text-muted-foreground">{line.variant_sku}</div>
                    </td>
                    <td className="px-4 py-2 text-right">{line.quantity}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(line.unit_price)}</td>
                    <td className="px-4 py-2 text-right text-destructive">{formatCurrency(line.discount_amount || 0)}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(lineTotal)}</td>
                  </tr>
                );
              })}
              {(!quote.lines || quote.lines.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No items in this quote
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t-2 border-border">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right font-semibold">Total</td>
                <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(quote.total_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ),
    },
    {
      id: "overview",
      label: "Details",
      render: () => (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Quote Number", quote.quote_number],
            ["Customer", quote.customer_name || "—"],
            ["Date", quote.date],
            ["Expiration Date", quote.expiration_date || "—"],
            ["Status", quote.status],
            ["Notes", quote.notes || "—"],
            ["Created", new Date(String(quote.created_at)).toLocaleDateString()],
            ["Last Updated", new Date(String(quote.updated_at)).toLocaleDateString()],
          ].map(([label, value]) => (
            <div key={label as string} className="flex justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  // Build related records (invoice if accepted)
  const relatedItems: { id: string; type: string; title: string; amount?: string; status?: string }[] = [];
  if (quote.status === "ACCEPTED") {
    // If we had an invoice ID from the accept response, we could store it, but it's not in quote model.
    // We could add a lookup via finance API, but skip for simplicity.
  }
  if (quote.lead) {
    relatedItems.push({
      id: quote.lead,
      type: "Lead",
      title: "Original Lead",
      status: "Linked",
    });
  }
  if (quote.customer) {
    relatedItems.push({
      id: quote.customer,
      type: "Customer",
      title: "Customer",
      status: "Active",
    });
  }

  if (relatedItems.length > 0) {
    tabs.push({
      id: "related",
      label: "Related",
      count: relatedItems.length,
      render: () => <RelatedRecords items={relatedItems} />,
    });
  }

  const canAccept = quote.status === "DRAFT" || quote.status === "SENT";
  const canReject = quote.status === "DRAFT" || quote.status === "SENT";

  return (
    <>
      <DetailLayout
        breadcrumbs={["Sales", "Quotes", quote.quote_number]}
        entityId={quote.quote_number}
        title={quote.quote_number}
        status={quote.status}
        subtitle={`Issued ${quote.date} · ${quote.customer_name || "No customer"}`}
        data={quote}
        meta={[
          { label: "Customer", value: quote.customer_name || "—" },
          { label: "Expires", value: quote.expiration_date || "Never" },
          { label: "Currency", value: "USD" },
        ]}
        summary={[
          { label: "Total Amount", value: formatCurrency(quote.total_amount), isCurrency: true, tone: "info" },
          { label: "Status", value: quote.status, tone: quote.status === "ACCEPTED" ? "success" : quote.status === "DECLINED" ? "destructive" : "warning" },
          { label: "Valid Until", value: quote.expiration_date || "—", isCurrency: false },
        ]}
        primaryActionLabel={canAccept ? "Accept & Invoice" : undefined}
        onPrimaryAction={canAccept ? handleAccept : undefined}
        onEdit={permissions.update ? handleEdit : undefined}
        permissions={{ edit: permissions.update, submit: canAccept }}
        tabs={tabs}
        sidebar={
          <StandardSidebar
            metadata={[
              ["Created", new Date(String(quote.created_at)).toLocaleString()],
              ["Created by", quote.created_by_name || "—"],
              ["Modified", new Date(String(quote.updated_at)).toLocaleString()],
              ["Modified by", quote.updated_by_name || "—"],
            ]}
          />
        }
        currencyFormatter={formatCurrency}
      />
      {canReject && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleReject}
            className="px-4 py-2 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            Reject Quote
          </button>
        </div>
      )}
      <QuoteFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingQuote(null);
        }}
        initialData={editingQuote}
        onSuccess={handleUpdateSuccess}
      />
    </>
  );
}