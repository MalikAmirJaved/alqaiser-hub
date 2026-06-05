"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { Customer } from "@/hooks/useCustomers";
import PageHeader from "@/components/PageHeader";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useDeleteCustomer } from "@/hooks/useCustomers";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { useState, useMemo } from "react";
import CustomerForm from "@/components/inventory/customers/CustomerForm";
import { useUpdateCustomer } from "@/hooks/useCustomers";
import { useSalesOrders, type SalesOrderResponse } from "@/hooks/useSalesOrder";
import { useCustomerInvoices, type CustomerInvoice } from "@/hooks/finance/useCustomerInvoices";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { formatCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface PurchasedProduct {
  variantId: string;
  variantSku: string;
  variantName: string;
  totalQuantity: number;
  totalValue: number;
  [key: string]: unknown;
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const api = useApi();
  const deleteCustomer = useDeleteCustomer();
  const updateCustomer = useUpdateCustomer();
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("products");

  const { data: customer, refetch, isLoading: customerLoading } = useQuery<Customer>({
    queryKey: ["customer", id],
    queryFn: () => api(`/api/inventory/customers/${id}/`),
  });

  const { data: allOrders = [], isLoading: ordersLoading } = useSalesOrders({
    customer: id as string,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useCustomerInvoices({
    customer: id as string,
  });

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

  const handleDelete = () => {
    confirm({
      title: "Delete Customer",
      message: `Delete "${customer?.name}" permanently?`,
      onConfirm: async () => {
        await deleteCustomer.mutateAsync(String(id));
        router.back();
      },
    });
  };

  const handleUpdate = async (data: any) => {
    await updateCustomer.mutateAsync({ id: String(id), data });
    setIsEditing(false);
    refetch();
  };

  if (customerLoading) return <div className="p-8 text-center">Loading customer...</div>;
  if (!customer) return <div className="p-8 text-center">Customer not found</div>;

  if (isEditing) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <PageHeader title="Edit Customer" />
        <CustomerForm
          initialData={customer}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditing(false)}
          isLoading={updateCustomer.isPending}
        />
      </div>
    );
  }

  const productColumns: Column<PurchasedProduct>[] = [
    { key: "variantSku", label: "SKU", sortable: true },
    { key: "variantName", label: "Product", sortable: true },
    { 
      key: "totalQuantity", 
      label: "Total Qty", 
      sortable: true,
      render: (val) => <div className="text-right">{val as number}</div>
    },
    { 
      key: "totalValue", 
      label: "Total Value", 
      sortable: true,
      render: (val) => <div className="text-right font-mono">{formatCurrency(val as number)}</div>
    },
  ];

  const holdOrderColumns: Column<SalesOrderResponse>[] = [
    { key: "order_number", label: "Order #", sortable: true },
    { key: "order_date", label: "Date", sortable: true },
    { 
      key: "total_amount", 
      label: "Amount", 
      sortable: true,
      render: (val) => <div className="text-right font-mono">{formatCurrency(val as number)}</div>
    },
    {
      key: "status",
      label: "Status",
      render: (val) => <Badge variant={val === "DRAFT" ? "secondary" : "outline"}>{val as string}</Badge>,
    },
  ];

  const completedOrderColumns: Column<SalesOrderResponse>[] = [
    { key: "order_number", label: "Order #", sortable: true },
    { key: "order_date", label: "Date", sortable: true },
    { 
      key: "total_amount", 
      label: "Amount", 
      sortable: true,
      render: (val) => <div className="text-right font-mono">{formatCurrency(val as number)}</div>
    },
    {
      key: "status",
      label: "Status",
      render: () => <Badge className="bg-success/20 text-success border-success/30">COMPLETE</Badge>,
    },
  ];

  const invoiceColumns: Column<CustomerInvoice>[] = [
    { key: "invoice_number", label: "Invoice #", sortable: true },
    { key: "invoice_date", label: "Date", sortable: true },
    { key: "due_date", label: "Due Date", sortable: true },
    { 
      key: "amount", 
      label: "Amount", 
      sortable: true,
      render: (val) => <div className="text-right font-mono">{formatCurrency(val as number)}</div>
    },
    { 
      key: "paid_amount", 
      label: "Paid", 
      sortable: true,
      render: (val) => <div className="text-right font-mono">{formatCurrency(val as number)}</div>
    },
    { 
      key: "outstanding", 
      label: "Outstanding", 
      sortable: true,
      render: (val) => <div className="text-right font-mono">{formatCurrency(val as number)}</div>
    },
    {
      key: "status",
      label: "Status",
      render: (val) => {
        const statusMap: Record<string, { label: string; className: string }> = {
          DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
          POSTED: { label: "Posted", className: "bg-warning/20 text-warning border-warning/30" },
          PAID: { label: "Paid", className: "bg-success/20 text-success border-success/30" },
          PARTIAL: { label: "Partial", className: "bg-warning/20 text-warning border-warning/30" },
          CANCELLED: { label: "Cancelled", className: "bg-destructive/20 text-destructive border-destructive/30" },
        };
        const s = statusMap[val as string] || { label: val as string, className: "bg-muted text-muted-foreground" };
        return <Badge className={s.className}>{s.label}</Badge>;
      },
    },
  ];

  const orderActions = (row: SalesOrderResponse) => (
    <Link href={`/inventory/sales-orders/${row.id}`}>
      <button className="text-xs text-primary hover:underline">View</button>
    </Link>
  );

  const invoiceActions = (row: CustomerInvoice) => (
    <Link href={`/finance/customer-invoices/${row.id}`}>
      <button className="text-xs text-primary hover:underline">View</button>
    </Link>
  );

  const purchasedData = purchasedProducts as any[];
  const holdData = holdOrders as any[];
  const completedData = completedOrders as any[];
  const invoiceData = invoices as any[];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <PageHeader title={customer.name} subtitle={`Code: ${customer.customer_code || "—"}`} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsEditing(true)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border">
            <Edit className="w-4 h-4" /> Edit
          </button>
          <button onClick={handleDelete} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-lg font-semibold">Contact Information</h3>
          <div><span className="text-muted-foreground">Email:</span> {customer.email || "—"}</div>
          <div><span className="text-muted-foreground">Phone:</span> {customer.phone || "—"}</div>
          <div><span className="text-muted-foreground">Contact Person:</span> {customer.contact_person || "—"}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-lg font-semibold">Address</h3>
          <div>{customer.address_line || "—"}</div>
          <div>{customer.city}, {customer.state} {customer.postal_code}</div>
          <div>{customer.country}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-lg font-semibold">Status</h3>
          <span className={`px-2 py-1 rounded-full text-sm ${customer.is_active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
            {customer.is_active ? "Active" : "Inactive"}
          </span>
          <div className="pt-2 text-sm">
            <span className="text-muted-foreground">Total Orders:</span> {allOrders.length}
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Total Invoices:</span> {invoices.length}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/40 grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="products">Products Purchased</TabsTrigger>
          <TabsTrigger value="hold">Hold Orders</TabsTrigger>
          <TabsTrigger value="completed">Completed Orders</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <TableView
            columns={productColumns as unknown as Column<Record<string, unknown>>[]}
            data={purchasedData}
            loading={ordersLoading}
            emptyMessage="No products purchased yet."
          />
        </TabsContent>

        <TabsContent value="hold" className="mt-4">
          <TableView
            columns={holdOrderColumns as unknown as Column<Record<string, unknown>>[]}
            data={holdData}
            loading={ordersLoading}
            emptyMessage="No hold orders."
            actions={orderActions as any}
          />
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <TableView
            columns={completedOrderColumns as unknown as Column<Record<string, unknown>>[]}
            data={completedData}
            loading={ordersLoading}
            emptyMessage="No completed orders."
            actions={orderActions as any}
          />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <TableView
            columns={invoiceColumns as unknown as Column<Record<string, unknown>>[]}
            data={invoiceData}
            loading={invoicesLoading}
            emptyMessage="No invoices found."
            actions={invoiceActions as any}
          />
        </TabsContent>
      </Tabs>

      <ConfirmModal />
    </div>
  );
}