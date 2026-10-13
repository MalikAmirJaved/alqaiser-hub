"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DetailLayout, StandardSidebar, RelatedRecords, type DetailTab } from "@/components/reuseable/final/DetailLayout";
import { useQuote, useUpdateQuote, useSendQuote, useMarkViewedQuote, useApproveQuote, useRejectQuote, useQuoteStatusHistory } from "@/hooks/sales/useQuotes";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useCompanySettingsQuery } from "@/hooks/useCompanySettings";
import { useTermsAndConditions } from "@/hooks/useTermsAndConditions";
import StatusHistoryTimeline from "@/components/sales/StatusHistoryTimeline";
import { DocumentPrintPreviewModal } from "@/components/invoice-generator/DocumentPrintPreviewModal";
import { buildCrmDocumentPreview } from "@/components/invoice-generator/crmPreview";
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
  const invoicePermissions = useFeaturePermissions("SALES", "sales_customers_invoice");
  const { data: companySettings } = useCompanySettingsQuery();
  const { terms: termsData } = useTermsAndConditions();

  const { data: statusHistory, isLoading: historyLoading } = useQuoteStatusHistory(id as string);

  const [showPrintPreview, setShowPrintPreview] = useState(false);

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!quote) return <div className="p-8 text-center">Quote not found</div>;

  const handleEdit = () => {
    router.push(`/sales/quotes/${quote.id}/edit`);
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

  const handleConvertToInvoice = () => {
    router.push(`/sales/customer-invoices/create?quoteId=${encodeURIComponent(quote.id)}`);
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
                <th className="px-4 py-2 text-left">Supplier</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Unit Price</th>
                <th className="px-4 py-2 text-right">Discount</th>
                <th className="px-4 py-2 text-right">Tax</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.lines?.map((line, idx) => {
                const quantity = Number(line.quantity) || 0;
                const unitPrice = Number(line.unit_price) || 0;
                const discount = Number(line.discount_amount) || 0;
                const taxRate = Number(line.tax_rate) || 0;
                const lineNet = quantity * unitPrice - discount;
                const lineTax = lineNet * (taxRate / 100);
                const lineTotal = lineNet + lineTax;
                return (
                  <tr key={idx} className="border-b border-border/60">
                    <td className="px-4 py-2">
                      <div className="font-medium">{line.variant_name || line.variant_sku}</div>
                      <div className="text-xs text-muted-foreground">SKU: {line.variant_sku}</div>
                      {(line as any).description && (
                        <div className="text-xs text-muted-foreground/70 italic mt-0.5">{(line as any).description}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {line.vendor_name ? (
                        <span className="text-muted-foreground">{line.vendor_name}</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{quantity}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(unitPrice)}</td>
                    <td className="px-4 py-2 text-right text-destructive">{formatCurrency(discount)}</td>
                    <td className="px-4 py-2 text-right">
                      {taxRate > 0 ? (
                        <span className="text-muted-foreground">
                          {taxRate}% ({formatCurrency(lineTax)})
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(lineTotal)}</td>
                  </tr>
                );
              })}
              {(!quote.lines || quote.lines.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No items in this quote
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t-2 border-border">
              <>
                  <tr>
                    <td colSpan={6} className="px-4 py-2 text-right text-sm text-muted-foreground">Subtotal</td>
                    <td className="px-4 py-2 text-right text-sm">
                      {formatCurrency(
                        (quote.lines || []).reduce(
                          (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0),
                          0,
                        ),
                      )}
                    </td>
                  </tr>
                  {(() => {
                    const lines = (quote.lines || []) as any[];
                    const sub = lines.reduce(
                      (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0),
                      0,
                    );
                    const lineDiscounts = lines.reduce(
                      (sum, line) => sum + (Number(line.discount_amount) || 0),
                      0,
                    );
                    const lineTax = lines.reduce(
                      (sum, line) => {
                        const lineSubtotal = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
                        const lineDiscount = Number(line.discount_amount) || 0;
                        const taxRate = Number(line.tax_rate) || 0;
                        return sum + (lineSubtotal - lineDiscount) * (taxRate / 100);
                      },
                      0,
                    );
                    const overallDiscountPercent = Number(quote.overall_discount_percent || 0);
                    const overallTaxPercent = Number(quote.overall_tax_percent || 0);
                    const overallDisc = sub * (overallDiscountPercent / 100);
                    return (
                      <>
                        {lineDiscounts > 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-2 text-right text-sm text-muted-foreground">
                              Discount (line)
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-destructive">
                              -{formatCurrency(lineDiscounts)}
                            </td>
                          </tr>
                        )}
                        {overallDiscountPercent > 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-2 text-right text-sm text-muted-foreground">
                              Discount ({overallDiscountPercent}%)
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-destructive">
                              -{formatCurrency(overallDisc)}
                            </td>
                          </tr>
                        )}
                        {lineTax > 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-2 text-right text-sm text-muted-foreground">
                              Tax (line)
                            </td>
                            <td className="px-4 py-2 text-right text-sm">{formatCurrency(lineTax)}</td>
                          </tr>
                        )}
                        {overallTaxPercent > 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-2 text-right text-sm text-muted-foreground">
                              Tax ({overallTaxPercent}%)
                            </td>
                            <td className="px-4 py-2 text-right text-sm">
                              {formatCurrency((sub - lineDiscounts - overallDisc) * (overallTaxPercent / 100))}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })()}
              </>
              <tr className="border-t-2 border-border">
                <td colSpan={6} className="px-4 py-3 text-right font-semibold">Total</td>
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
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Quote Information</h4>
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
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Source & Origin</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ["Source", (quote as any).source_label || (quote.lead ? "From Lead" : "New")],
                ["Created By", (quote as any).created_by_label || quote.created_by_name || "—"],
                ["Created At", quote.created_at ? new Date(String(quote.created_at)).toLocaleString() : "—"],
                ["Modified By", quote.updated_by_name || "—"],
                ["Modified At", quote.updated_at ? new Date(String(quote.updated_at)).toLocaleString() : "—"],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "history",
      label: "Status History",
      count: statusHistory?.length || 0,
      render: () => (
        <StatusHistoryTimeline history={statusHistory || []} isLoading={historyLoading} />
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
  const canSend = isDraft && permissions.update;
  const canMarkViewed = isSent && permissions.update;
  const canApprove = isViewed && permissions.approve;
  const canReject = isViewed && permissions.reject;
  const canConvertToInvoice = isApproved && !quote.converted_invoice && invoicePermissions.create;
  const canViewConvertedInvoice = isConverted && !!quote.converted_invoice && invoicePermissions.view;
  const primaryActionLabel = canSend
    ? "Send to Customer"
    : canMarkViewed
      ? "Mark as Viewed"
      : canApprove
        ? "Approve Quote"
        : canConvertToInvoice
          ? "Convert to Invoice"
          : canViewConvertedInvoice
            ? "View Invoice"
            : undefined;
  const handlePrimaryAction = canSend
    ? handleSend
    : canMarkViewed
      ? handleMarkViewed
      : canApprove
        ? handleApprove
        : canConvertToInvoice
          ? handleConvertToInvoice
          : canViewConvertedInvoice
            ? () => router.push(`/sales/customer-invoices/${quote.converted_invoice}`)
            : undefined;

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
        primaryActionLabel={primaryActionLabel}
        primaryActionIcon={canConvertToInvoice || canViewConvertedInvoice ? FileText : undefined}
        onPrimaryAction={handlePrimaryAction}
        onEdit={(permissions.update && isDraft) ? handleEdit : undefined}
        onPrint={handlePrint}
        onExport={handleExportPdf}
        permissions={{
          edit: permissions.update && isDraft,
          submit: !!(canSend || canMarkViewed || canApprove || canConvertToInvoice || canViewConvertedInvoice),
        }}
        tabs={tabs}
        sidebar={
          <StandardSidebar
            riskIndicators={[
              { label: "Source", value: (quote as any).source_label || "New", tone: "info" },
              { label: "Status", value: quote.status, tone: quote.status === "APPROVED" || quote.status === "CONVERTED" ? "success" : quote.status === "REJECTED" ? "destructive" : "warning" },
              { label: "Amount", value: formatCurrency(quote.total_amount), tone: "info" },
            ]}
            metadata={[
              ["Quote #", quote.quote_number],
              ["Created", new Date(String(quote.created_at)).toLocaleString()],
              ["Created By", (quote as any).created_by_label || quote.created_by_name || "—"],
              ["Modified", new Date(String(quote.updated_at)).toLocaleString()],
              ["Modified By", quote.updated_by_name || "—"],
              ["Source", (quote as any).source_label || "New"],
              ["Customer", quote.customer_name || "—"],
              ["Lead Linked", quote.lead ? "Yes" : "No"],
              ["Status", quote.status],
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
      {quote && companySettings && (
        <DocumentPrintPreviewModal
          open={showPrintPreview}
          onClose={() => setShowPrintPreview(false)}
          documentTitle="Quote"
          data={buildCrmDocumentPreview({
            appearance: quote,
            documentType: "Quote",
            documentNumber: quote.quote_number,
            customerName: quote.customer_name,
            customerEmail: (quote as any).customer_email,
            customerPhone: (quote as any).customer_phone,
            issueDate: quote.date,
            dueDate: quote.expiration_date,
            lines: quote.lines || [],
            currency: companySettings.currency,
            businessName: companySettings.companyName,
            businessAddress: companySettings.address,
            businessEmail: companySettings.email,
            businessLogo: companySettings.logo,
            overallDiscountPercent: Number(quote.overall_discount_percent || 0),
            overallTaxPercent: Number(quote.overall_tax_percent || 0),
            notes: quote.notes,
            terms: termsData?.quote || "",
          })}
        />
      )}
    </>
  );
}