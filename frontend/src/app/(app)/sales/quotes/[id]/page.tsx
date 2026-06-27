"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DetailLayout, StandardSidebar, RelatedRecords, type DetailTab } from "@/components/reuseable/final/DetailLayout";
import { useQuote, useUpdateQuote, useSendQuote, useMarkViewedQuote, useApproveQuote, useRejectQuote, useMarkConvertedQuote } from "@/hooks/sales/useQuotes";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useCompanySettingsQuery } from "@/hooks/useCompanySettings";
import { useTermsAndConditions } from "@/hooks/useTermsAndConditions";
import { PrintPreviewModal } from "@/components/common/QuoteInvoiceDocument";
import QuoteFormModal from "@/components/sales/QuoteFormModal";
import { Printer, Download, FileText, HelpCircle, Settings, Info } from "lucide-react";

export default function QuoteDetailPage() {
    const formatCurrency = useFormatCurrency();
  const { id } = useParams();
  const router = useRouter();
  const { data: quote, isLoading, refetch } = useQuote(id as string);
  const updateQuote = useUpdateQuote();
  const sendQuote = useSendQuote();
  const markViewed = useMarkViewedQuote();
  const approveQuote = useApproveQuote();
  const rejectQuote = useRejectQuote();
  const permissions = useFeaturePermissions("SALES", "quote");
  const { data: companySettings } = useCompanySettingsQuery();
  const { terms: termsData } = useTermsAndConditions();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<any>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

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

  const handleSend = async () => {
    try {
      await sendQuote.mutateAsync(quote.id);
      refetch();
    } catch { /* toast from apiFetch */ }
  };

  const handleMarkViewed = async () => {
    try {
      await markViewed.mutateAsync(quote.id);
      refetch();
    } catch { /* toast from apiFetch */ }
  };

  const handleApprove = async () => {
    try {
      await approveQuote.mutateAsync(quote.id);
      refetch();
    } catch { /* toast from apiFetch */ }
  };

  const handleReject = async () => {
    try {
      await rejectQuote.mutateAsync(quote.id);
      refetch();
    } catch { /* toast from apiFetch */ }
  };

  const handlePrint = () => {
    setShowPrintPreview(true);
  };

  const handleExportPdf = () => {
    setShowPrintPreview(true);
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
              {(quote as any).lines?.length > 0 && (
                <>
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right text-sm text-muted-foreground">Subtotal</td>
                    <td className="px-4 py-2 text-right text-sm">
                      {formatCurrency(
                        (quote.lines || []).reduce((s: number, l: any) => s + l.quantity * l.unit_price, 0)
                      )}
                    </td>
                  </tr>
                  {(quote as any).overall_discount_percent > 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right text-sm text-muted-foreground">
                        Discount ({(quote as any).overall_discount_percent}%)
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-destructive">
                        -{formatCurrency(
                          ((quote.lines || []).reduce((s: number, l: any) => s + l.quantity * l.unit_price, 0)) *
                          (Number((quote as any).overall_discount_percent) / 100)
                        )}
                      </td>
                    </tr>
                  )}
                  {(quote as any).overall_tax_percent > 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right text-sm text-muted-foreground">
                        Tax ({(quote as any).overall_tax_percent}%)
                      </td>
                      <td className="px-4 py-2 text-right text-sm">
                        {formatCurrency(
                          ((quote.lines || []).reduce((s: number, l: any) => s + l.quantity * l.unit_price, 0) -
                            ((quote.lines || []).reduce((s: number, l: any) => s + l.quantity * l.unit_price, 0)) *
                            (Number((quote as any).overall_discount_percent) / 100)) *
                          (Number((quote as any).overall_tax_percent) / 100)
                        )}
                      </td>
                    </tr>
                  )}
                </>
              )}
              <tr className="border-t-2 border-border">
                <td colSpan={4} className="px-4 py-3 text-right font-semibold">Total</td>
                <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(quote.total_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ),
    },
    {
      id: "terms",
      label: "Terms & Conditions",
      render: () => (
        <div className="text-sm">
          {termsData?.quote ? (
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: termsData.quote }} />
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">No terms & conditions configured for quotes.</p>
              <button
                onClick={() => router.push("/settings/terms")}
                className="mt-2 inline-flex items-center gap-1.5 text-primary hover:underline text-sm"
              >
                <Settings className="w-3.5 h-3.5" />
                Configure in Settings
              </button>
            </div>
          )}
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
            ["Discount %", (quote as any).overall_discount_percent ? `${(quote as any).overall_discount_percent}%` : "—"],
            ["Tax %", (quote as any).overall_tax_percent ? `${(quote as any).overall_tax_percent}%` : "—"],
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

  const relatedItems: { id: string; type: string; title: string; amount?: string; status?: string }[] = [];
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

  const isDraft = quote.status === "DRAFT";
  const isSent = quote.status === "SENT";
  const isViewed = quote.status === "VIEWED";
  const isApproved = quote.status === "APPROVED";
  const isConverted = quote.status === "CONVERTED";

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
          { label: "Status", value: quote.status, tone: isApproved || isConverted ? "success" : quote.status === "REJECTED" ? "destructive" : "warning" },
          { label: "Valid Until", value: quote.expiration_date || "—", isCurrency: false },
        ]}
        primaryActionLabel={isDraft ? "Send to Customer" : isSent ? "Mark as Viewed" : isViewed ? "Approve Quote" : undefined}
        onPrimaryAction={isDraft ? handleSend : isSent ? handleMarkViewed : isViewed ? handleApprove : undefined}
        onEdit={(permissions.update && isDraft) ? handleEdit : undefined}
        onPrint={handlePrint}
        onExport={handleExportPdf}
        permissions={{ edit: permissions.update, submit: !!(isDraft || isSent || isViewed) }}
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

      {/* Print/Download Context Help Banner */}
      <div className="mt-4 flex flex-wrap items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10 text-xs text-muted-foreground">
        <HelpCircle className="w-4 h-4 text-primary shrink-0" />
        <span>
          <strong className="text-foreground">Print & Export:</strong> Click the{" "}
          <Printer className="w-3.5 h-3.5 inline-block mx-0.5" />{" "}
          <strong>Print</strong> button in the toolbar to print this quote or click the{" "}
          <Download className="w-3.5 h-3.5 inline-block mx-0.5" />{" "}
          <strong>PDF</strong> button to download as a PDF document.
          The Terms & Conditions from <strong>Settings → Terms & Conditions</strong> are automatically included.
        </span>
        <span className="hidden sm:inline text-muted-foreground/60">|</span>
        <button
          onClick={() => router.push("/settings/terms")}
          className="inline-flex items-center gap-1 text-primary hover:underline shrink-0"
          title="Configure Terms & Conditions"
        >
          <Settings className="w-3.5 h-3.5" />
          Manage Terms & Conditions
        </button>
      </div>

      {isViewed && (
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
      {quote && companySettings && (
        <PrintPreviewModal
          open={showPrintPreview}
          onClose={() => setShowPrintPreview(false)}
          documentProps={{
            data: {
              type: "QUOTE",
              documentNumber: quote.quote_number,
              date: quote.date,
              expirationDate: quote.expiration_date || undefined,
              customerName: quote.customer_name || "—",
              customerEmail: (quote as any).customer_email || "",
              customerPhone: (quote as any).customer_phone || "",
              lines: (quote.lines || []).map((l) => ({
                variant_name: l.variant_name,
                variant_sku: l.variant_sku,
                quantity: l.quantity,
                unit_price: l.unit_price,
                tax_rate: l.tax_rate,
                discount_amount: l.discount_amount,
              })),
              totalAmount:
                typeof quote.total_amount === "string"
                  ? parseFloat(quote.total_amount)
                  : quote.total_amount,
              overallDiscountPercent: Number((quote as any).overall_discount_percent || 0),
              overallTaxPercent: Number((quote as any).overall_tax_percent || 0),
              status: quote.status,
              notes: quote.notes,
            },
            company: {
              companyName: companySettings.companyName,
              address: companySettings.address,
              city: companySettings.city,
              state: companySettings.state,
              country: companySettings.country,
              phone: companySettings.phone,
              email: companySettings.email,
              taxId: companySettings.taxId,
              logo: (companySettings as any).logo || "",
              logoUrl: (companySettings as any).logo
                ? `${process.env.NEXT_PUBLIC_API_URL}${(companySettings as any).logo}`
                : "",
            },
            termsContent: termsData?.quote || "",
            formatCurrency,
          }}
        />
      )}
    </>
  );
}