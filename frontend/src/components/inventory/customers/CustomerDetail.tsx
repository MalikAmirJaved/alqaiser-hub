"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Customer, useCustomer, useDeleteCustomer, useUpdateCustomer,
  useCustomerDetailSummary, type CustomerDetailSummary,
} from "@/hooks/useCustomers";
import { useSalesOrders, type SalesOrderResponse } from "@/hooks/useSalesOrder";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { DetailLayout, StandardSidebar, type DetailTab, type DetailSummary } from "@/components/reuseable/final/DetailLayout";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface CustomerDetailProps {
  id: string;
  moduleCode: "INVENTORY" | "SALES";
  onBack?: () => void;
}

function activityIcon(type: string) {
  if (type === "customer_created") return "🟢";
  if (type === "customer_updated") return "🔄";
  if (type === "lead_converted") return "⭐";
  if (type === "quote_created") return "📄";
  if (type === "order_created") return "📦";
  if (type === "invoice_created") return "🧾";
  return "•";
}

export default function CustomerDetail({ id, moduleCode, onBack }: CustomerDetailProps) {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const deleteCustomer = useDeleteCustomer();
  const updateCustomer = useUpdateCustomer();
  const permissions = useFeaturePermissions(moduleCode, moduleCode === "SALES" ? "sales_customer" : "customer");
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();


  const { data: summary, isLoading, refetch } = useCustomerDetailSummary(id);
  const { data: customer } = useCustomer(id);

  const { data: salesOrdersRes, isLoading: ordersLoading } = useSalesOrders({
    customer: id,
    page_size: 10000,
  });
  const allOrders = salesOrdersRes?.data ?? [];

  const activeSummary = summary;

  const financial = activeSummary?.financial_summary;
  const related = activeSummary?.related;
  const sourceInfo = activeSummary?.source;
  const activityData = activeSummary?.activity;

  const completedOrders = useMemo(() => {
    return allOrders.filter(order => order.status === "COMPLETE");
  }, [allOrders]);

  const purchasedProducts = useMemo(() => {
    const productMap = new Map<string, {
      variantId: string;
      variantSku: string;
      variantName: string;
      totalQuantity: number;
      totalValue: number;
    }>();

    completedOrders.forEach(order => {
      order.lines?.forEach(line => {
        const key = line.variant;
        const existing = productMap.get(key);
        const quantity = line.quantity_ordered;
        const lineTotal = (line.unit_price * quantity) - (line.discount_amount || 0);

        if (existing) {
          existing.totalQuantity += quantity;
          existing.totalValue += lineTotal;
        } else {
          productMap.set(key, {
            variantId: line.variant,
            variantSku: line.variant_sku,
            variantName: line.variant_name,
            totalQuantity: quantity,
            totalValue: lineTotal,
          });
        }
      });
    });

    return Array.from(productMap.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [completedOrders]);

  const customerInfo = activeSummary?.customer ?? customer;


  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      const backPath = moduleCode === "INVENTORY" ? "/inventory/customers" : "/sales/customers";
      router.push(backPath);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading customer details...</div>;
  if (!customerInfo) return <div className="p-8 text-center">Customer not found</div>;

  const breadcrumbs = moduleCode === "INVENTORY"
    ? ["Inventory", "Customers", customerInfo.name]
    : ["Sales", "Customers", customerInfo.name];

  const summaryCards: DetailSummary[] = [
    { label: "Total Invoice Amount", value: parseFloat(financial?.total_invoice_amount || "0"), isCurrency: true, tone: "info" },
    { label: "Total Paid", value: parseFloat(financial?.total_paid || "0"), isCurrency: true, tone: "success" },
    {
      label: "Total Outstanding",
      value: parseFloat(financial?.total_outstanding || "0"),
      isCurrency: true,
      tone: parseFloat(financial?.total_outstanding || "0") > 0 ? "warning" : "success",
    },
    {
      label: "Total Discount",
      value: parseFloat(financial?.total_discount || "0"),
      isCurrency: true,
      tone: parseFloat(financial?.total_discount || "0") > 0 ? "info" : "success",
    },
    {
      label: "Total Tax",
      value: parseFloat(financial?.total_tax || "0"),
      isCurrency: true,
      tone: "info",
    },
    { label: "Orders", value: financial?.total_orders ?? 0, isCurrency: false, tone: "info" },
    { label: "Quotes", value: financial?.total_quotes ?? 0, isCurrency: false, tone: "info" },
    { label: "Invoices", value: financial?.total_invoices ?? 0, isCurrency: false, tone: "info" },
  ];

  const statusBadge = (status: string, map: Record<string, string> = {}) => {
    const cls = map[status] || "bg-muted text-muted-foreground";
    return <Badge className={cls}>{status}</Badge>;
  };

  // ── Column defs ──

  const leadCols: Column<Record<string, unknown>>[] = [
    { key: "first_name", label: "Name", sortable: true, render: (_, row) => `${row.first_name || ""} ${row.last_name || ""}`.trim() || "—" },
    { key: "company_name", label: "Company", sortable: true },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "source", label: "Source", sortable: true },
    {
      key: "status", label: "Status", sortable: true,
      render: (val) => {
        const s = String(val);
        const colors: Record<string, string> = {
          NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
          CONTACTED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
          QUALIFIED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
          FOLLOW_UP: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
          CONVERTED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
          LOST: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        };
        return <Badge className={colors[s] || ""}>{s}</Badge>;
      },
    },
    { key: "created_at", label: "Date", render: (val) => val ? new Date(String(val)).toLocaleDateString() : "—" },
  ];

  const quoteCols: Column<Record<string, unknown>>[] = [
    { key: "quote_number", label: "Quote #", sortable: true, render: (val) => <span className="font-mono text-xs">{String(val)}</span> },
    { key: "date", label: "Date", render: (val) => val ? new Date(String(val)).toLocaleDateString() : "—" },
    { key: "total_amount", label: "Amount", sortable: true, render: (val) => <span className="font-mono text-right block">{formatCurrency(parseFloat(String(val)))}</span> },
    {
      key: "status", label: "Status",
      render: (val) => {
        const s = String(val);
        const colors: Record<string, string> = {
          DRAFT: "bg-muted text-muted-foreground",
          SENT: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
          VIEWED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
          APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
          REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
          CONVERTED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
        };
        return <Badge className={colors[s] || ""}>{s}</Badge>;
      },
    },
    { key: "source", label: "Source" },
    { key: "created_at", label: "Created", render: (val) => val ? new Date(String(val)).toLocaleDateString() : "—" },
  ];

  const salesOrderCols: Column<Record<string, unknown>>[] = [
    { key: "order_number", label: "Order #", sortable: true, render: (val) => <span className="font-mono text-xs">{String(val)}</span> },
    { key: "order_date", label: "Date", render: (val) => val ? new Date(String(val)).toLocaleDateString() : "—" },
    { key: "total_amount", label: "Amount", sortable: true, render: (val) => <span className="font-mono text-right block">{formatCurrency(parseFloat(String(val)))}</span> },
    {
      key: "status", label: "Status",
      render: (val) => {
        const s = String(val);
        const colors: Record<string, string> = {
          DRAFT: "bg-muted text-muted-foreground",
          PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
          COMPLETE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
          CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        };
        return <Badge className={colors[s] || ""}>{s}</Badge>;
      },
    },
    { key: "source", label: "Source" },
    { key: "payment_method", label: "Payment" },
  ];

  const invoiceCols: Column<Record<string, unknown>>[] = [
    { key: "invoice_number", label: "Invoice #", sortable: true, render: (val) => <span className="font-mono text-xs">{String(val)}</span> },
    { key: "invoice_date", label: "Date", render: (val) => val ? new Date(String(val)).toLocaleDateString() : "—" },
    { key: "due_date", label: "Due", render: (val) => val ? new Date(String(val)).toLocaleDateString() : "—" },
    { key: "amount", label: "Amount", sortable: true, render: (val) => <span className="font-mono text-right block">{formatCurrency(parseFloat(String(val)))}</span> },
    { key: "paid_amount", label: "Paid", render: (val) => <span className="font-mono text-right block text-success">{formatCurrency(parseFloat(String(val)))}</span> },
    {
      key: "outstanding", label: "Outstanding", sortable: true,
      render: (val) => {
        const n = parseFloat(String(val));
        return <span className={`font-mono text-right block ${n > 0 ? "text-destructive" : "text-success"}`}>{formatCurrency(n)}</span>;
      },
    },
    {
      key: "payment_status", label: "Status",
      render: (val) => {
        const s = String(val);
        const colors: Record<string, string> = {
          UNPAID: "bg-destructive/20 text-destructive border-destructive/30",
          PARTIAL: "bg-warning/20 text-warning border-warning/30",
          PAID: "bg-success/20 text-success border-success/30",
        };
        return <Badge className={colors[s] || "bg-muted text-muted-foreground"}>{s}</Badge>;
      },
    },
    { key: "source", label: "Source" },
  ];

  // ── Row actions ──
  const quoteActions = (row: Record<string, unknown>) => (
    <Link href={`/sales/quotes/${row.id as string}`}>
      <button className="text-xs text-primary hover:underline">View</button>
    </Link>
  );
  const orderActions = (row: Record<string, unknown>) => (
    <Link href={`/inventory/pos/sales-orders/${row.id as string}`}>
      <button className="text-xs text-primary hover:underline">View</button>
    </Link>
  );
  const invoiceActions = (row: Record<string, unknown>) => (
    <Link href={`/finance/customer-invoices/${row.id as string}`}>
      <button className="text-xs text-primary hover:underline">View</button>
    </Link>
  );

  // ── Cast data for TableView ──
  const leadsData = (related?.leads ?? []) as unknown as Record<string, unknown>[];
  const quotesData = (related?.quotes ?? []) as unknown as Record<string, unknown>[];
  const salesOrdersData = (related?.sales_orders ?? []) as unknown as Record<string, unknown>[];
  const invoicesData = (related?.invoices ?? []) as unknown as Record<string, unknown>[];

  // ── Tabs ──
  const tabs: DetailTab[] = [
    {
      id: "info",
      label: "Information",
      render: () => (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Contact Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ["Customer Code", customerInfo.customer_code || "—"],
                ["Contact Person", customerInfo.contact_person || "—"],
                ["Email", customerInfo.email || "—"],
                ["Phone", customerInfo.phone || "—"],
                ["Address", customerInfo.address_line || "—"],
                ["City", customerInfo.city || "—"],
                ["State", customerInfo.state || "—"],
                ["Postal Code", customerInfo.postal_code || "—"],
                ["Country", customerInfo.country || "—"],
                ["Status", customerInfo.is_active ? "Active" : "Inactive"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Source & Origin</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Source</span>
                <span className="font-medium">{sourceInfo?.label || "Manual"}</span>
              </div>
              {sourceInfo?.detail && (
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Source Detail</span>
                  <span className="font-medium">{sourceInfo.detail}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Created By</span>
                <span className="font-medium">{sourceInfo?.created_by || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Created At</span>
                <span className="font-medium">{sourceInfo?.created_at ? new Date(sourceInfo.created_at).toLocaleString() : "—"}</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Last Updated By</span>
                <span className="font-medium">{sourceInfo?.updated_by || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Last Updated At</span>
                <span className="font-medium">{sourceInfo?.updated_at ? new Date(sourceInfo.updated_at).toLocaleString() : "—"}</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "leads",
      label: "Leads",
      count: related?.leads?.length ?? 0,
      render: () => (
        <TableView
          columns={leadCols}
          data={leadsData}
          loading={isLoading}
          emptyMessage="No leads converted from this customer."
        />
      ),
    },
    {
      id: "quotes",
      label: "Quotes",
      count: related?.quotes?.length ?? 0,
      render: () => (
        <TableView
          columns={quoteCols}
          data={quotesData}
          loading={isLoading}
          emptyMessage="No quotes for this customer."
          actions={quoteActions}
        />
      ),
    },
    {
      id: "orders",
      label: "Sales Orders",
      count: related?.sales_orders?.length ?? 0,
      render: () => (
        <TableView
          columns={salesOrderCols}
          data={salesOrdersData}
          loading={isLoading}
          emptyMessage="No sales orders for this customer."
          actions={orderActions}
        />
      ),
    },
    {
      id: "invoices",
      label: "Invoices",
      count: related?.invoices?.length ?? 0,
      render: () => (
        <TableView
          columns={invoiceCols}
          data={invoicesData}
          loading={isLoading}
          emptyMessage="No invoices for this customer."
          actions={invoiceActions}
        />
      ),
    },
    {
      id: "products",
      label: "Products Purchased",
      count: purchasedProducts.length,
      render: () => {
        const productCols: Column<Record<string, unknown>>[] = [
          { key: "variantSku", label: "SKU", sortable: true },
          { key: "variantName", label: "Product", sortable: true },
          {
            key: "totalQuantity", label: "Total Qty", sortable: true,
            render: (val) => <div className="text-right">{String(val)}</div>,
          },
          {
            key: "totalValue", label: "Total Value", sortable: true,
            render: (val) => <div className="text-right font-mono font-semibold text-primary">{formatCurrency(Number(val))}</div>,
          },
        ];
        return (
          <TableView
            columns={productCols}
            data={purchasedProducts as unknown as Record<string, unknown>[]}
            loading={ordersLoading}
            emptyMessage="No products purchased yet."
          />
        );
      },
    },
    {
      id: "activity",
      label: "Activity",
      count: activityData?.length ?? 0,
      render: () => (
        <div className="space-y-1">
          {activityData && activityData.length > 0 ? (
            activityData.map((a, idx) => (
              <div key={idx} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                <span className="text-sm mt-0.5">{activityIcon(a.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{a.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.date ? new Date(a.date).toLocaleString() : "—"}
                    {a.user ? ` by ${a.user}` : ""}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No activity recorded.</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <DetailLayout
        breadcrumbs={breadcrumbs}
        entityId={customerInfo.customer_code || customerInfo.id?.slice(0, 8) || "—"}
        title={customerInfo.name}
        status={customerInfo.is_active ? "Active" : "Inactive"}
        subtitle={`${customerInfo.contact_person || "No contact"} · ${customerInfo.email || "No email"}`}
        data={customerInfo}
        meta={[
          { label: "Customer Code", value: customerInfo.customer_code || "—" },
          { label: "Phone", value: customerInfo.phone || "—" },
          { label: "City", value: customerInfo.city || "—" },
          { label: "Source", value: sourceInfo?.label || "Manual" },
          { label: "Created", value: sourceInfo?.created_at ? new Date(sourceInfo.created_at).toLocaleDateString() : "—" },
          { label: "Orders", value: String(financial?.total_orders ?? 0) },
          { label: "Quotes", value: String(financial?.total_quotes ?? 0) },
          { label: "Invoices", value: String(financial?.total_invoices ?? 0) },
        ]}
        summary={summaryCards}
        tabs={tabs}
        permissions={{ edit: permissions.update }}
        sidebar={
          <StandardSidebar
            riskIndicators={[
              {
                label: "Outstanding Balance",
                value: parseFloat(financial?.total_outstanding || "0") > 0 ? formatCurrency(parseFloat(financial?.total_outstanding || "0")) : "None",
                tone: parseFloat(financial?.total_outstanding || "0") > 0 ? "warning" : "success",
              },
              {
                label: "Total Paid",
                value: formatCurrency(parseFloat(financial?.total_paid || "0")),
                tone: parseFloat(financial?.total_paid || "0") > 0 ? "success" : "info",
              },
              {
                label: "Discount Given",
                value: parseFloat(financial?.total_discount || "0") > 0 ? formatCurrency(parseFloat(financial?.total_discount || "0")) : "None",
                tone: parseFloat(financial?.total_discount || "0") > 0 ? "info" : "success",
              },
              {
                label: "Active Status",
                value: customerInfo.is_active ? "Active" : "Inactive",
                tone: customerInfo.is_active ? "success" : "destructive",
              },
              {
                label: "Source",
                value: sourceInfo?.label || "Manual",
                tone: "info",
              },
            ]}
            metadata={[
              ["Created", sourceInfo?.created_at ? new Date(sourceInfo.created_at).toLocaleString() : "—"],
              ["Created By", sourceInfo?.created_by || "—"],
              ["Last Updated", sourceInfo?.updated_at ? new Date(sourceInfo.updated_at).toLocaleString() : "—"],
              ["Updated By", sourceInfo?.updated_by || "—"],
              ["Customer Code", customerInfo.customer_code || "—"],
              ["Contact", customerInfo.phone || customerInfo.email || "—"],
            ]}
          />
        }
        currencyFormatter={formatCurrency}
      />
      <ConfirmModal />
    </>
  );
}
