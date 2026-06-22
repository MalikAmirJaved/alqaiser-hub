"use client";

import { useState } from "react";
import {
  useSalesOrders,
  useGenerateInvoice,
  type SalesOrderResponse,
} from "@/hooks/useSalesOrder";
import { printThermalReceipt, type ThermalReceiptData } from "@/components/inventory/pos/ThermalReceiptModal";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useCompanySettingsQuery } from "@/hooks/useCompanySettings";
import { useTermsAndConditions } from "@/hooks/useTermsAndConditions";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { PrintPreviewModal, type QuoteInvoiceData, type DocCompany } from "@/components/common/QuoteInvoiceDocument";
import {
  ChevronDown,
  ChevronUp,
  Printer,
  Download,
  FileText,
  Search,
  ShoppingBag,
  Clock,
  User,
  Hash,
  Receipt,
  Loader2,
  Package,
  CreditCard,
  CalendarDays,
  Store,
  Filter,
  X,
  CheckCircle2,
  AlertCircle,
  ReceiptText,
} from "lucide-react";

// ── Types ──────────────────────────────────────────

interface OrderWithInvoice extends SalesOrderResponse {
  invoice_id?: string | null;
}

// ── Helpers ────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  COMPLETE: {
    label: "Complete",
    color: "text-success",
    bg: "bg-success/10 border-success/20",
    icon: CheckCircle2,
  },
  DRAFT: {
    label: "Draft",
    color: "text-warning",
    bg: "bg-warning/10 border-warning/20",
    icon: Clock,
  },
  PENDING: {
    label: "Pending",
    color: "text-muted-foreground",
    bg: "bg-muted/30 border-border/60",
    icon: AlertCircle,
  },
  CANCELLED: {
    label: "Cancelled",
    color: "text-destructive",
    bg: "bg-destructive/10 border-destructive/20",
    icon: X,
  },
};

// ── Order Card Component ───────────────────────────

function OrderCard({
  order,
  formatCurrency,
  onPrintInvoice,
  onGenerateInvoice,
  pdfLoading,
  generatingId,
}: {
  order: OrderWithInvoice;
  formatCurrency: (v: number | string) => string;
  onPrintInvoice: (order: OrderWithInvoice) => void;
  onGenerateInvoice: (order: OrderWithInvoice) => void;
  pdfLoading: string | null;
  generatingId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig[order.status] || statusConfig.PENDING;
  const StatusIcon = cfg.icon;
  const hasInvoice = !!order.invoice_id;
  const lineCount = order.lines?.length || 0;
  const orderDate = new Date(order.order_date);
  const createdAt = new Date(order.created_at);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
      {/* ── Header ── */}
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {/* Icon */}
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Receipt className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-foreground truncate">
                {order.order_number}
              </h4>
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.color}`}
              >
                <StatusIcon className="h-2.5 w-2.5" />
                {cfg.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {orderDate.toLocaleDateString("en-US", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {createdAt.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-bold text-foreground">
            {formatCurrency(order.total_amount)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {lineCount} {lineCount === 1 ? "item" : "items"}
          </div>
        </div>
      </div>

      {/* ── Customer & Warehouse ── */}
      <div className="px-5 pb-2 flex items-center gap-4 text-xs text-muted-foreground">
        {order.customer_name && (
          <span className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded-lg">
            <User className="h-3 w-3" />
            {order.customer_name}
          </span>
        )}
        {order.warehouse_name && (
          <span className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded-lg">
            <Store className="h-3 w-3" />
            {order.warehouse_name}
          </span>
        )}
        {!order.customer_name && (
          <span className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded-lg text-muted-foreground/60">
            <User className="h-3 w-3" />
            Walk-in Customer
          </span>
        )}
      </div>

      {/* ── Notes ── */}
      {order.notes && (
        <div className="px-5 pb-2">
          <p className="text-[10px] text-muted-foreground/60 italic truncate">
            {order.notes}
          </p>
        </div>
      )}

      {/* ── Line Items (expandable) ── */}
      {order.lines && order.lines.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/20 transition-colors border-t border-border/40"
          >
            <span className="flex items-center gap-1.5">
              <Package className="h-3 w-3" />
              Products Sold ({lineCount})
            </span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {expanded && (
            <div className="border-t border-border/40 bg-muted/10">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="px-5 py-2 text-left font-medium">Product</th>
                    <th className="px-2 py-2 text-center font-medium">Qty</th>
                    <th className="px-2 py-2 text-right font-medium">Price</th>
                    <th className="px-5 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => {
                    const lineTotal =
                      line.quantity_ordered * Number(line.unit_price) -
                      Number(line.discount_amount || 0);
                    return (
                      <tr
                        key={line.id}
                        className="border-b border-border/20 hover:bg-muted/20"
                      >
                        <td className="px-5 py-2">
                          <div className="font-medium text-foreground">
                            {line.variant_name || "Product"}
                          </div>
                          <div className="text-[9px] text-muted-foreground/60 font-mono">
                            SKU: {line.variant_sku || "—"}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center font-medium">
                          {line.quantity_ordered}
                        </td>
                        <td className="px-2 py-2 text-right text-muted-foreground">
                          {formatCurrency(Number(line.unit_price))}
                        </td>
                        <td className="px-5 py-2 text-right font-semibold text-foreground">
                          {formatCurrency(lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/20">
                    <td
                      colSpan={3}
                      className="px-5 py-2 text-right text-xs font-bold text-foreground"
                    >
                      Total
                    </td>
                    <td className="px-5 py-2 text-right text-sm font-bold text-primary">
                      {formatCurrency(order.total_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Actions (Print / Download PDF / Thermal Print) ── */}
      {order.status === "COMPLETE" && (
        <div className="px-5 py-3 border-t border-border/40 flex items-center gap-2 bg-muted/5">
          {hasInvoice ? (
            <>
              <button
                onClick={() => onPrintInvoice(order)}
                disabled={pdfLoading === order.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[11px] font-bold hover:opacity-90 transition-all active:scale-[0.97] disabled:opacity-50"
              >
                {pdfLoading === order.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Printer className="h-3.5 w-3.5" />
                )}
                Print Invoice
              </button>
              <button
                onClick={() => onPrintInvoice(order)}
                disabled={pdfLoading === order.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 text-foreground rounded-lg text-[11px] font-bold hover:bg-muted/80 transition-all active:scale-[0.97] disabled:opacity-50 border border-border/40"
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </button>
            </>
          ) : (
            <button
              onClick={() => onGenerateInvoice(order)}
              disabled={generatingId === order.id}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[11px] font-bold hover:bg-primary/20 transition-all active:scale-[0.97] disabled:opacity-50 border border-primary/20"
            >
              {generatingId === order.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Receipt className="h-3.5 w-3.5" />
              )}
              Generate Invoice
            </button>
          )}
          {/* Thermal Print Button */}
          <button
            onClick={() => {
              const now = new Date(order.created_at);
              const data: ThermalReceiptData = {
                orderNumber: order.order_number,
                date: now.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
                time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
                customerName: order.customer_name,
                lines: (order.lines || []).map((l) => ({
                  variant_name: l.variant_name || "Product",
                  variant_sku: l.variant_sku,
                  quantity: l.quantity_ordered,
                  unit_price: Number(l.unit_price),
                  total: l.quantity_ordered * Number(l.unit_price),
                })),
                totalAmount: Number(order.total_amount),
              };
              printThermalReceipt(data, "Store", formatCurrency);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-[11px] font-bold hover:bg-amber-100 transition-all active:scale-[0.97] border border-amber-200"
            title="Print thermal receipt"
          >
            <ReceiptText className="h-3.5 w-3.5" />
            Thermal
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────

export function SalesListPanel() {
  const formatCurrency = useFormatCurrency();
  const { data: companySettings } = useCompanySettingsQuery();
  const { terms: termsData } = useTermsAndConditions();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useSalesOrders();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [invoiceModalProps, setInvoiceModalProps] = useState<{
    open: boolean;
    data: QuoteInvoiceData | null;
  }>({ open: false, data: null });
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const { mutateAsync: generateInvoice, isPending: isGenerating } = useGenerateInvoice();

  // Handle generate invoice
  const handleGenerateInvoice = async (order: OrderWithInvoice) => {
    setGeneratingId(order.id);
    try {
      const result = await generateInvoice(order.id);
      if (result?.invoice_id) {
        // Refresh orders to get updated invoice_id
        await queryClient.invalidateQueries({
          queryKey: ["inventory_sales_order"],
        });
        // Fetch invoice and open print modal
        await handlePrintInvoice({ ...order, invoice_id: result.invoice_id });
      }
    } catch (err) {
      console.error("Failed to generate invoice:", err);
    } finally {
      setGeneratingId(null);
    }
  };

  // Filter orders
  const filteredOrders: OrderWithInvoice[] = (orders as OrderWithInvoice[]).filter(
    (o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchNumber = o.order_number.toLowerCase().includes(q);
        const matchCustomer = o.customer_name?.toLowerCase().includes(q);
        const matchProduct = o.lines?.some(
          (l) =>
            l.variant_name?.toLowerCase().includes(q) ||
            l.variant_sku?.toLowerCase().includes(q)
        );
        if (!matchNumber && !matchCustomer && !matchProduct) return false;
      }
      return true;
    }
  );

  // Handle print invoice
  const handlePrintInvoice = async (order: OrderWithInvoice) => {
    if (!order.invoice_id) return;

    setPdfLoading(order.id);
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
        logo: "",
        logoUrl: "",
      };

      const docData: QuoteInvoiceData = {
        type: "INVOICE",
        documentNumber: invoiceData?.invoice_number || order.order_number,
        date: invoiceData?.invoice_date || order.order_date,
        dueDate: invoiceData?.due_date || "",
        customerName:
          order.customer_name ||
          invoiceData?.customer_name ||
          "Walk-in Customer",
        customerEmail: invoiceData?.customer_email || "",
        customerPhone: invoiceData?.customer_phone || "",
        lines: (invoiceData?.lines || order.lines || []).map((l: any) => ({
          variant_name: l.variant_name || "Product",
          variant_sku: l.variant_sku || "",
          quantity: l.quantity || l.quantity_ordered,
          unit_price: Number(l.unit_price),
          tax_rate: Number(l.tax_rate || 0),
          discount_amount: Number(l.discount_amount || 0),
        })),
        totalAmount: Number(invoiceData?.amount || order.total_amount),
        status: invoiceData?.status || "COMPLETE",
        paymentStatus: invoiceData?.payment_status || "",
        notes: invoiceData?.notes || order.notes || "",
      };

      setInvoiceModalProps({ open: true, data: docData });
    } catch (err) {
      console.error("Failed to load invoice:", err);
    } finally {
      setPdfLoading(null);
    }
  };

  // Filter status tabs
  const statusTabs = [
    { value: "ALL", label: "All", count: orders.length },
    {
      value: "COMPLETE",
      label: "Complete",
      count: orders.filter((o) => o.status === "COMPLETE").length,
    },
    {
      value: "DRAFT",
      label: "Draft",
      count: orders.filter((o) => o.status === "DRAFT").length,
    },
    {
      value: "CANCELLED",
      label: "Cancelled",
      count: orders.filter((o) => o.status === "CANCELLED").length,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">
            Loading sales orders...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-border/60 bg-card/30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Recent Sales
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {orders.length} total orders
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by order#, customer, or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {statusTabs.map((tab) => {
            const isActive = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? "bg-primary-foreground/20"
                        : "bg-muted-foreground/10"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Orders List ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
              <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {searchQuery || statusFilter !== "ALL"
                ? "No matching orders"
                : "No sales yet"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
              {searchQuery || statusFilter !== "ALL"
                ? "Try a different search or filter"
                : "Complete a sale to see it here"}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              formatCurrency={formatCurrency}
              onPrintInvoice={handlePrintInvoice}
              onGenerateInvoice={handleGenerateInvoice}
              pdfLoading={pdfLoading}
              generatingId={generatingId}
            />
          ))
        )}
      </div>

      {/* ── Invoice Print Modal ── */}
      {invoiceModalProps.data && (
        <PrintPreviewModal
          open={invoiceModalProps.open}
          onClose={() =>
            setInvoiceModalProps({ open: false, data: null })
          }
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
              logo: "",
              logoUrl: "",
            },
            termsContent: termsData?.invoice || "",
            formatCurrency,
          }}
        />
      )}
    </div>
  );
}
