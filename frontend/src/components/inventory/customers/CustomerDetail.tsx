"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Customer, useCustomer, useDeleteCustomer, useUpdateCustomer } from "@/hooks/useCustomers";
import { useSalesOrders, type SalesOrderResponse } from "@/hooks/useSalesOrder";
import { useCustomerInvoices, type CustomerInvoice } from "@/hooks/finance/useCustomerInvoices";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { DetailLayout, StandardSidebar, type DetailTab } from "@/components/reuseable/final/DetailLayout";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import CustomerForm from "./CustomerForm";

interface PurchasedProduct {
  variantId: string;
  variantSku: string;
  variantName: string;
  totalQuantity: number;
  totalValue: number;
}

interface CustomerDetailProps {
  id: string;
  moduleCode: "INVENTORY" | "SALES";
  onBack?: () => void;
}

export default function CustomerDetail({ id, moduleCode, onBack }: CustomerDetailProps) {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const deleteCustomer = useDeleteCustomer();
  const updateCustomer = useUpdateCustomer();
  const permissions = useFeaturePermissions(moduleCode, moduleCode === "SALES" ? "sales_customer" : "customer");
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();

  const [isEditing, setIsEditing] = useState(false);

  // Fetch customer data
  const { data: customer, refetch, isLoading: customerLoading } = useCustomer(id);

  // Fetch sales orders
  const { data: allOrders = [], isLoading: ordersLoading } = useSalesOrders({
    customer: id,
  });

  // Fetch invoices
  const { data: invoices = [], isLoading: invoicesLoading } = useCustomerInvoices({
    customer: id,
  });

  // Derived data
  const holdOrders = useMemo(() => {
    return allOrders.filter(order => order.status === "DRAFT" || order.status === "PENDING");
  }, [allOrders]);

  const completedOrders = useMemo(() => {
    return allOrders.filter(order => order.status === "COMPLETE");
  }, [allOrders]);

  const purchasedProducts = useMemo(() => {
    const productMap = new Map<string, PurchasedProduct>();

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

  const totalOrders = allOrders.length;
  const totalInvoices = invoices.length;
  const totalSpent = completedOrders.reduce((sum, order) => sum + Number(order.total_amount), 0);
  const outstandingBalance = invoices.reduce((sum, inv) => sum + Number(inv.outstanding || 0), 0);

  const handleDelete = () => {
    confirm({
      title: "Delete Customer",
      message: `Delete "${customer?.name}" permanently? This action cannot be undone.`,
      onConfirm: async () => {
        await deleteCustomer.mutateAsync(String(id));
        if (onBack) {
          onBack();
        } else {
          const backPath = moduleCode === "INVENTORY" ? "/inventory/customers" : "/sales/customers";
          router.push(backPath);
        }
      },
    });
  };

  const handleUpdate = async (data: any) => {
    await updateCustomer.mutateAsync({ id: String(id), data });
    setIsEditing(false);
    refetch();
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      const backPath = moduleCode === "INVENTORY" ? "/inventory/customers" : "/sales/customers";
      router.push(backPath);
    }
  };

  if (customerLoading) return <div className="p-8 text-center">Loading customer...</div>;
  if (!customer) return <div className="p-8 text-center">Customer not found</div>;

  if (isEditing) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <CustomerForm
          initialData={customer}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditing(false)}
          isLoading={updateCustomer.isPending}
        />
      </div>
    );
  }

  // Table columns with proper typing - cast to Record<string, unknown> for TableView
  const productColumns: Column<Record<string, unknown>>[] = [
    { key: "variantSku", label: "SKU", sortable: true },
    { key: "variantName", label: "Product", sortable: true },
    {
      key: "totalQuantity",
      label: "Total Qty",
      sortable: true,
      render: (val: unknown) => <div className="text-right">{String(val)}</div>,
    },
    {
      key: "totalValue",
      label: "Total Value",
      sortable: true,
      render: (val: unknown) => <div className="text-right font-mono font-semibold text-primary">{formatCurrency(Number(val))}</div>,
    },
  ];

  const holdOrderColumns: Column<Record<string, unknown>>[] = [
    { key: "order_number", label: "Order #", sortable: true, render: (val: unknown) => <span className="font-mono text-xs">{String(val)}</span> },
    { key: "order_date", label: "Date", sortable: true, render: (val: unknown) => <span>{String(val)}</span> },
    {
      key: "total_amount",
      label: "Amount",
      sortable: true,
      render: (val: unknown) => <div className="text-right font-mono">{formatCurrency(Number(val))}</div>,
    },
    {
      key: "status",
      label: "Status",
      render: (val: unknown) => {
        const status = String(val);
        return <Badge variant={status === "DRAFT" ? "secondary" : "outline"}>{status}</Badge>;
      },
    },
  ];

  const completedOrderColumns: Column<Record<string, unknown>>[] = [
    { key: "order_number", label: "Order #", sortable: true, render: (val: unknown) => <span className="font-mono text-xs">{String(val)}</span> },
    { key: "order_date", label: "Date", sortable: true, render: (val: unknown) => <span>{String(val)}</span> },
    {
      key: "total_amount",
      label: "Amount",
      sortable: true,
      render: (val: unknown) => <div className="text-right font-mono">{formatCurrency(Number(val))}</div>,
    },
    {
      key: "status",
      label: "Status",
      render: () => <Badge className="bg-success/20 text-success border-success/30">COMPLETE</Badge>,
    },
  ];

  const invoiceColumns: Column<Record<string, unknown>>[] = [
    { key: "invoice_number", label: "Invoice #", sortable: true, render: (val: unknown) => <span className="font-mono text-xs">{String(val)}</span> },
    { key: "invoice_date", label: "Date", sortable: true, render: (val: unknown) => <span>{String(val)}</span> },
    { key: "due_date", label: "Due Date", sortable: true, render: (val: unknown) => <span>{String(val)}</span> },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      render: (val: unknown) => <div className="text-right font-mono">{formatCurrency(Number(val))}</div>,
    },
    {
      key: "paid_amount",
      label: "Paid",
      sortable: true,
      render: (val: unknown) => <div className="text-right font-mono text-success">{formatCurrency(Number(val))}</div>,
    },
    {
      key: "outstanding",
      label: "Outstanding",
      sortable: true,
      render: (val: unknown) => {
        const numVal = Number(val);
        return <div className={`text-right font-mono ${numVal > 0 ? "text-destructive" : "text-success"}`}>{formatCurrency(numVal)}</div>;
      },
    },
    {
      key: "status",
      label: "Status",
      render: (val: unknown) => {
        const status = String(val);
        const statusMap: Record<string, { label: string; className: string }> = {
          DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
          UNPAID: { label: "Unpaid", className: "bg-warning/20 text-warning border-warning/30" },
          PAID: { label: "Paid", className: "bg-success/20 text-success border-success/30" },
          PARTIAL: { label: "Partial", className: "bg-warning/20 text-warning border-warning/30" },
          CANCELLED: { label: "Cancelled", className: "bg-destructive/20 text-destructive border-destructive/30" },
        };
        const s = statusMap[status] || { label: status, className: "bg-muted text-muted-foreground" };
        return <Badge className={s.className}>{s.label}</Badge>;
      },
    },
  ];

  // Cast data to Record<string, unknown>[] for TableView
  const purchasedProductsData = purchasedProducts as unknown as Record<string, unknown>[];
  const holdOrdersData = holdOrders as unknown as Record<string, unknown>[];
  const completedOrdersData = completedOrders as unknown as Record<string, unknown>[];
  const invoicesData = invoices as unknown as Record<string, unknown>[];

  const orderActions = (row: Record<string, unknown>) => (
    <Link href={`/inventory/sales-orders/${row.id as string}`}>
      <button className="text-xs text-primary hover:underline">View</button>
    </Link>
  );

  const invoiceActions = (row: Record<string, unknown>) => (
    <Link href={`/finance/customer-invoices/${row.id as string}`}>
      <button className="text-xs text-primary hover:underline">View</button>
    </Link>
  );

  const breadcrumbs = moduleCode === "INVENTORY"
    ? ["Inventory", "Customers", customer.name]
    : ["Sales", "Customers", customer.name];

  const orderHistoryCount = completedOrders.length + holdOrders.length;

  // Tabs for the detail layout
  const tabs: DetailTab[] = [
    {
      id: "info",
      label: "Information",
      render: () => (
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Customer Code", customer.customer_code || "—"],
            ["Contact Person", customer.contact_person || "—"],
            ["Email", customer.email || "—"],
            ["Phone", customer.phone || "—"],
            ["Address", customer.address_line || "—"],
            ["City", customer.city || "—"],
            ["State", customer.state || "—"],
            ["Postal Code", customer.postal_code || "—"],
            ["Country", customer.country || "—"],
            ["Status", customer.is_active ? "Active" : "Inactive"],
            ["Created", new Date(customer.created_at || "").toLocaleDateString()],
            ["Last Updated", new Date(customer.updated_at || "").toLocaleDateString()],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "products",
      label: "Products Purchased",
      count: purchasedProducts.length,
      render: () => (
        <TableView
          columns={productColumns}
          data={purchasedProductsData}
          loading={ordersLoading}
          emptyMessage="No products purchased yet."
        />
      ),
    },
    {
      id: "orders",
      label: "Order History",
      count: orderHistoryCount,
      render: () => (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">Active / Hold Orders</h4>
            <TableView
              columns={holdOrderColumns}
              data={holdOrdersData}
              loading={ordersLoading}
              emptyMessage="No active orders."
              actions={orderActions}
            />
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">Completed Orders</h4>
            <TableView
              columns={completedOrderColumns}
              data={completedOrdersData}
              loading={ordersLoading}
              emptyMessage="No completed orders."
              actions={orderActions}
            />
          </div>
        </div>
      ),
    },
    {
      id: "invoices",
      label: "Invoices",
      count: invoices.length,
      render: () => (
        <TableView
          columns={invoiceColumns}
          data={invoicesData}
          loading={invoicesLoading}
          emptyMessage="No invoices found."
          actions={invoiceActions}
        />
      ),
    },
  ];

  return (
    <>
      <DetailLayout
        breadcrumbs={breadcrumbs}
        entityId={customer.customer_code || customer.id.slice(0, 8)}
        title={customer.name}
        status={customer.is_active ? "Active" : "Inactive"}
        subtitle={`${customer.contact_person || "No contact"} · ${customer.email || "No email"}`}
        data={customer}
        meta={[
          { label: "Customer Code", value: customer.customer_code || "—" },
          { label: "Phone", value: customer.phone || "—" },
          { label: "City", value: customer.city || "—" },
        ]}
        summary={[
          { label: "Total Orders", value: totalOrders, isCurrency: false, tone: "info" },
          { label: "Total Spent", value: formatCurrency(totalSpent), isCurrency: true, tone: "success" },
          { label: "Outstanding", value: formatCurrency(outstandingBalance), isCurrency: true, tone: outstandingBalance > 0 ? "warning" : "success" },
          { label: "Total Invoices", value: totalInvoices, isCurrency: false, tone: "info" },
        ]}
        tabs={tabs}
        onEdit={permissions.update ? () => setIsEditing(true) : undefined}
        permissions={{ edit: permissions.update }}
        sidebar={
          <StandardSidebar
            riskIndicators={[
              { label: "Outstanding Balance", value: outstandingBalance > 0 ? formatCurrency(outstandingBalance) : "None", tone: outstandingBalance > 0 ? "warning" : "success" },
              { label: "Order Frequency", value: `${totalOrders} orders`, tone: totalOrders > 0 ? "success" : "info" },
              { label: "Active Status", value: customer.is_active ? "Active" : "Inactive", tone: customer.is_active ? "success" : "destructive" },
            ]}
            metadata={[
              ["Created", new Date(customer.created_at || "").toLocaleString()],
              ["Last Updated", new Date(customer.updated_at || "").toLocaleString()],
            ]}
          />
        }
        currencyFormatter={formatCurrency}
      />
      <ConfirmModal />
    </>
  );
}