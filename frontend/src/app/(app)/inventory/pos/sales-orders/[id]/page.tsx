"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DetailLayout,
  StandardSidebar,
  type DetailTab,
} from "@/components/reuseable/final/DetailLayout";
import {
  useFetchSalesOrder,
  useCompleteSalesOrder,
  useCancelSalesOrder,
  useGenerateInvoice,
  type SalesOrderResponse,
} from "@/hooks/useSalesOrder";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useCompanySettingsQuery } from "@/hooks/useCompanySettings";
import { useTermsAndConditions } from "@/hooks/useTermsAndConditions";
import { apiFetch } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  PrintPreviewModal,
  type QuoteInvoiceData,
  type DocCompany,
} from "@/components/common/QuoteInvoiceDocument";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  FileText,
  Loader2,
  ArrowLeft,
  Package,
  RotateCcw,
} from "lucide-react";
import { StatusBadge } from "@/components/finance/ui";

export default function SalesOrderDetailPage() {
  const formatCurrency = useFormatCurrency();
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: companySettings } = useCompanySettingsQuery();
  const { terms: termsData } = useTermsAndConditions();
  const permissions = useFeaturePermissions("INVENTORY", "sales_order");

  const {
    data: order,
    isLoading,
    refetch,
  } = useFetchSalesOrder(id as string);

  const completeOrder = useCompleteSalesOrder();
  const cancelOrder = useCancelSalesOrder();
  const generateInvoice = useGenerateInvoice();

  const [invoiceModalProps, setInvoiceModalProps] = useState<{
    open: boolean;
    data: QuoteInvoiceData | null;
  }>({ open: false, data: null });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Package className="w-12 h-12 text-muted-foreground" />
        <p className="text-lg font-semibold">Order not found</p>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  const lines = order.lines || [];
  const subtotal = lines.reduce((sum, l) => {
    const lineSub = l.quantity_ordered * l.unit_price;
    const disc =
      l.discount_amount > 0
        ? l.discount_amount
        : lineSub * ((l.discount_pct || 0) / 100);
    return sum + Math.max(0, lineSub - disc);
  }, 0);
  const totalTax = lines.reduce((sum, l) => {
    const lineSub = l.quantity_ordered * l.unit_price;
    const disc =
      l.discount_amount > 0
        ? l.discount_amount
        : lineSub * ((l.discount_pct || 0) / 100);
    const lineNet = Math.max(0, lineSub - disc);
    return sum + lineNet * ((l.tax_rate || 0) / 100);
  }, 0);
  const totalDiscount = lines.reduce((sum, l) => {
    const lineSub = l.quantity_ordered * l.unit_price;
    const disc =
      l.discount_amount > 0
        ? l.discount_amount
        : lineSub * ((l.discount_pct || 0) / 100);
    return sum + disc;
  }, 0);

  const canComplete = order.status === "DRAFT" && permissions.update;
  const canCancel =
    (order.status === "DRAFT" || order.status === "PENDING") &&
    permissions.delete;
  const canGenerateInvoice =
    order.status === "COMPLETE" && !order.invoice_id && permissions.update;

  const handleComplete = async () => {
    try {
      await completeOrder.mutateAsync({ orderId: order.id });
      toast.success("Order completed and stock deducted");
      refetch();
    } catch {
      /* toast from apiFetch */
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Cancel this order? Stock reservations will be released."))
      return;
    try {
      await cancelOrder.mutateAsync(order.id);
      toast.success("Order cancelled");
      refetch();
    } catch {
      /* toast from apiFetch */
    }
  };

  const handleGenerateInvoice = async () => {
    try {
      const result = await generateInvoice.mutateAsync(order.id);
      toast.success("Invoice generated");
      refetch();

      if (result.invoice_id) {
        try {
          const invoiceData = await queryClient.fetchQuery<any>({
            queryKey: ["finance_customer_invoices", result.invoice_id],
            queryFn: () =>
              apiFetch(`/api/finance/customer-invoices/${result.invoice_id}/`),
            staleTime: 0,
          });

          const docCompany: DocCompany = {
            companyName: companySettings?.companyName || "",
            address: companySettings?.address || "",
            city: companySettings?.city || "",
            state: companySettings?.state || "",
            country: companySettings?.country || "",
            phone: companySettings?.phone || "",
            email: companySettings?.email || "",
            taxId: companySettings?.taxId || "",
            logo: companySettings?.logo || "",
            logoUrl: companySettings?.logo
              ? `${process.env.NEXT_PUBLIC_API_URL}${companySettings.logo}`
              : "",
          };

          const docData: QuoteInvoiceData = {
            type: "INVOICE",
            documentNumber: invoiceData?.invoice_number || "",
            date:
              invoiceData?.invoice_date ||
              new Date().toISOString().split("T")[0],
            dueDate: invoiceData?.due_date || "",
            customerName: order.customer_name || "",
            customerEmail: invoiceData?.customer_email || "",
            customerPhone: invoiceData?.customer_phone || "",
            lines: (invoiceData?.lines || []).map((l: any) => ({
              variant_name: l.variant_name || "Product",
              variant_sku: l.variant_sku || "",
              quantity: l.quantity,
              unit_price: Number(l.unit_price),
              tax_rate: Number(l.tax_rate),
              discount_amount: Number(l.discount_amount || 0),
            })),
            totalAmount: Number(invoiceData?.amount || 0),
            status: invoiceData?.status || "DRAFT",
            paymentStatus: invoiceData?.payment_status || "",
            notes: invoiceData?.notes || "",
          };

          setInvoiceModalProps({ open: true, data: docData });
        } catch (err) {
          console.error("Failed to load invoice for preview:", err);
        }
      }
    } catch {
      /* toast from apiFetch */
    }
  };

  const handleViewInvoice = async () => {
    if (!order.invoice_id) return;
    try {
      const invoiceData = await queryClient.fetchQuery<any>({
        queryKey: ["finance_customer_invoices", order.invoice_id],
        queryFn: () =>
          apiFetch(`/api/finance/customer-invoices/${order.invoice_id}/`),
        staleTime: 0,
      });

      const docCompany: DocCompany = {
        companyName: companySettings?.companyName || "",
        address: companySettings?.address || "",
        city: companySettings?.city || "",
        state: companySettings?.state || "",
        country: companySettings?.country || "",
        phone: companySettings?.phone || "",
        email: companySettings?.email || "",
        taxId: companySettings?.taxId || "",
        logo: companySettings?.logo || "",
        logoUrl: companySettings?.logo
          ? `${process.env.NEXT_PUBLIC_API_URL}${companySettings.logo}`
          : "",
      };

      const docData: QuoteInvoiceData = {
        type: "INVOICE",
        documentNumber: invoiceData?.invoice_number || "",
        date:
          invoiceData?.invoice_date || new Date().toISOString().split("T")[0],
        dueDate: invoiceData?.due_date || "",
        customerName: order.customer_name || "",
        customerEmail: invoiceData?.customer_email || "",
        customerPhone: invoiceData?.customer_phone || "",
        lines: (invoiceData?.lines || []).map((l: any) => ({
          variant_name: l.variant_name || "Product",
          variant_sku: l.variant_sku || "",
          quantity: l.quantity,
          unit_price: Number(l.unit_price),
          tax_rate: Number(l.tax_rate),
          discount_amount: Number(l.discount_amount || 0),
        })),
        totalAmount: Number(invoiceData?.amount || 0),
        status: invoiceData?.status || "DRAFT",
        paymentStatus: invoiceData?.payment_status || "",
        notes: invoiceData?.notes || "",
      };

      setInvoiceModalProps({ open: true, data: docData });
    } catch (err) {
      console.error("Failed to load invoice:", err);
    }
  };

  const statusTone: Record<string, string> = {
    PENDING: "warning",
    DRAFT: "info",
    COMPLETE: "success",
    CANCELLED: "destructive",
  };

  const tabs: DetailTab[] = [
    {
      id: "items",
      label: "Order Items",
      count: lines.length,
      render: () => (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    #
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Product
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    SKU
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Qty
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Unit Price
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Discount
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Tax
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Total
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const lineSub = line.quantity_ordered * line.unit_price;
                  const disc =
                    line.discount_amount > 0
                      ? line.discount_amount
                      : lineSub * ((line.discount_pct || 0) / 100);
                  const lineNet = Math.max(0, lineSub - disc);
                  const lineTaxAmount =
                    lineNet * ((line.tax_rate || 0) / 100);
                  const lineTotal = lineNet + lineTaxAmount;
                  const effectiveQty =
                    line.quantity_ordered - (line.quantity_returned || 0);

                  return (
                    <tr
                      key={line.id}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {line.variant_name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {line.variant_sku}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span>{line.quantity_ordered}</span>
                        {(line.quantity_returned || 0) > 0 && (
                          <span className="ml-1 text-xs text-destructive">
                            (-{line.quantity_returned})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(line.unit_price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {disc > 0 ? (
                          <span className="text-destructive">
                            -{formatCurrency(disc)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {line.tax_rate > 0 ? (
                          <span>
                            {line.tax_rate}% ({formatCurrency(lineTaxAmount)})
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(lineTotal)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={line.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2 bg-muted/30 rounded-xl p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">
                    -{formatCurrency(totalDiscount)}
                  </span>
                </div>
              )}
              {totalTax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(totalTax)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>{formatCurrency(order.total_amount || subtotal)}</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "details",
      label: "Details",
      render: () => (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            [
              "Payment Method",
              order.payment_method
                ? order.payment_method.replace("_", " ")
                : "—",
            ],
            [
              "Source",
              order.source
                ? order.source.replace("_", " ")
                : "—",
            ],
            ["Notes", order.notes || "—"],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="flex justify-between border-b border-border/60 pb-2"
            >
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium text-right max-w-[60%]">
                {value}
              </span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const getPrimaryAction = () => {
    if (canComplete) {
      return {
        label: "Complete Order",
        action: handleComplete,
        icon: CheckCircle,
      };
    }
    if (canGenerateInvoice) {
      return {
        label: "Generate Invoice",
        action: handleGenerateInvoice,
        icon: FileText,
      };
    }
    return null;
  };

  const primaryAction = getPrimaryAction();

  const lineStatusCounts = lines.reduce(
    (acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalReturned = lines.reduce(
    (sum, l) => sum + (l.quantity_returned || 0),
    0
  );

  return (
    <>
      <DetailLayout
        breadcrumbs={["Inventory", "POS", "Sales Orders", order.order_number]}
        entityId={order.order_number}
        title={order.order_number}
        status={order.status}
        subtitle={
          order.customer_name
            ? `Customer: ${order.customer_name}`
            : "Walk-in Customer"
        }
        data={order}
        meta={[
          { label: "Order Date", value: order.order_date || "—" },
          { label: "Warehouse", value: order.warehouse_name || "—" },
          {
            label: "Customer",
            value: order.customer_name || "Walk-in Customer",
          },
          { label: "Payment", value: order.payment_method?.replace("_", " ") || "—" },
          {
            label: "Invoice",
            value: order.invoice_id ? "Generated" : "Not generated",
          },
        ]}
        summary={[
          {
            label: "Total Amount",
            value: formatCurrency(order.total_amount || 0),
            tone: "success",
            isCurrency: false,
          },
          {
            label: "Items",
            value: `${lines.length} line${lines.length !== 1 ? "s" : ""}`,
            tone: "info",
            isCurrency: false,
          },
          {
            label: "Discount",
            value: totalDiscount > 0 ? formatCurrency(totalDiscount) : "—",
            tone: totalDiscount > 0 ? "warning" : undefined,
            isCurrency: false,
          },
          {
            label: "Tax",
            value: totalTax > 0 ? formatCurrency(totalTax) : "—",
            isCurrency: false,
          },
          ...(totalReturned > 0
            ? [
                {
                  label: "Returned",
                  value: `${totalReturned} unit${totalReturned !== 1 ? "s" : ""}`,
                  tone: "destructive" as const,
                  isCurrency: false,
                },
              ]
            : []),
        ]}
        primaryActionLabel={primaryAction?.label || ""}
        onPrimaryAction={primaryAction?.action}
        permissions={{
          edit: false,
          delete: canCancel,
          submit: !!primaryAction,
        }}
        tabs={tabs}
        sidebar={
          <div className="space-y-4">
            <StandardSidebar
              metadata={[
                [
                  "Created",
                  new Date(order.created_at).toLocaleString(),
                ],
                [
                  "Created by",
                  order.created_by_info?.username || "—",
                ],
                [
                  "Modified",
                  new Date(order.updated_at).toLocaleString(),
                ],
                [
                  "Modified by",
                  order.updated_by_info?.username || "—",
                ],
              ]}
            />

            {/* Actions */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              {canComplete && (
                <button
                  onClick={handleComplete}
                  disabled={completeOrder.isPending}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  {completeOrder.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Complete Order
                </button>
              )}
              {canGenerateInvoice && (
                <button
                  onClick={handleGenerateInvoice}
                  disabled={generateInvoice.isPending}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  {generateInvoice.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  Generate Invoice
                </button>
              )}
              {order.invoice_id && (
                <button
                  onClick={handleViewInvoice}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-border text-sm hover:bg-muted transition"
                >
                  <FileText className="w-4 h-4" /> View Invoice
                </button>
              )}
              {canCancel && (
                <button
                  onClick={handleCancel}
                  disabled={cancelOrder.isPending}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-border text-sm text-destructive hover:bg-destructive/5 transition disabled:opacity-50"
                >
                  {cancelOrder.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Cancel Order
                </button>
              )}
            </div>

            {/* Line Status Summary */}
            {lines.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Line Status
                </h4>
                {Object.entries(lineStatusCounts).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between text-sm"
                  >
                    <StatusBadge status={status} />
                    <span className="text-muted-foreground">
                      {count} item{count !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        }
        currencyFormatter={formatCurrency}
      />

      {/* Invoice Print Modal */}
      {invoiceModalProps.data && (
        <PrintPreviewModal
          open={invoiceModalProps.open}
          onClose={() => setInvoiceModalProps({ open: false, data: null })}
          documentProps={{
            data: invoiceModalProps.data,
            company: {
              companyName: companySettings?.companyName || "",
              address: companySettings?.address || "",
              city: companySettings?.city || "",
              state: companySettings?.state || "",
              country: companySettings?.country || "",
              phone: companySettings?.phone || "",
              email: companySettings?.email || "",
              taxId: companySettings?.taxId || "",
              logo: companySettings?.logo || "",
              logoUrl: companySettings?.logo
                ? `${process.env.NEXT_PUBLIC_API_URL}${companySettings.logo}`
                : "",
            },
            termsContent: termsData?.invoice || "",
            formatCurrency,
          }}
        />
      )}
    </>
  );
}
