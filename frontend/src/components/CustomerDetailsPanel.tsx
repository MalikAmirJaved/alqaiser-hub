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
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

interface CustomerDetailsPanelProps {
  moduleCode: "INVENTORY" | "SALES";
}

interface PurchasedProduct extends Record<string, unknown> {
  variantId: string;
  variantSku: string;
  variantName: string;
  totalQuantity: number;
  totalValue: number;
}

// Extend SalesOrderResponse to satisfy Record<string, unknown> constraint
interface ExtendedSalesOrderResponse extends SalesOrderResponse, Record<string, unknown> {
  id: string;
  order_number: string;
  total_amount: number;
  customer_name?: string;
  customer?: { id: string; name: string };
  warehouse?: { id: string; warehouse_name: string };
  order_date: string;
  status: string;
  notes?: string;
  lines?: Array<{
    id: string;
    variant: string;
    variant_sku: string;
    variant_name: string;
    discount_amount: number;
    discount_pct: number;
    discount_fixed: number;
    quantity_ordered: number;
    unit_price: number;
    tax_rate: number;
    status: string;
  }>;
}

// Extend CustomerInvoice to satisfy Record<string, unknown> constraint
interface ExtendedCustomerInvoice extends CustomerInvoice, Record<string, unknown> {
  id: string;
  invoice_number: string;
  customer: string;
  customer_name?: string;
  sales_order: string | null;
  invoice_date: string;
  due_date: string;
  amount: number | string;
  paid_amount: number | string;
  outstanding: number | string;
  status: "DRAFT" | "CANCELLED";
  payment_status?: "UNPAID" | "PARTIAL" | "PAID";
  journal_entry: number | string | null;
  notes: string;
  source?: string;
  payment_method?: string;
  lines?: Array<{
    id: string;
    variant: string;
    variant_sku?: string;
    variant_name?: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    discount_amount: number;
  }>;
  created_at: string;
  updated_at: string;
  created_by?: number | string | null;
  created_by_name?: string;
  updated_by?: number | string | null;
  updated_by_name?: string;
}

export default function CustomerDetailsPanel({ moduleCode }: CustomerDetailsPanelProps) {
  const { id } = useParams();
  const router = useRouter();
  const api = useApi();
  const deleteCustomer = useDeleteCustomer();
  const updateCustomer = useUpdateCustomer();
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("products");
  
  const permissions = useFeaturePermissions(moduleCode, "customer");

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

  // Convert orders to extended type for table compatibility
  const extendedOrders = useMemo(() => {
    return allOrders.map(order => ({
      ...order,
      // Ensure all required fields are present
      id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      order_date: order.order_date,
      status: order.status,
      notes: order.notes,
      lines: order.lines,
    } as ExtendedSalesOrderResponse));
  }, [allOrders]);

  // Convert invoices to extended type for table compatibility
  const extendedInvoices = useMemo(() => {
    return invoices.map(invoice => ({
      ...invoice,
      // Ensure all required fields are present
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      customer: invoice.customer,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      amount: invoice.amount,
      paid_amount: invoice.paid_amount,
      outstanding: invoice.outstanding,
      status: invoice.status as "DRAFT" | "CANCELLED",
      payment_status: invoice.payment_status,
      notes: invoice.notes,
      created_at: invoice.created_at,
      updated_at: invoice.updated_at,
    } as ExtendedCustomerInvoice));
  }, [invoices]);

  const holdOrders = useMemo(() => {
    return extendedOrders.filter(order => order.status === "DRAFT" || order.status === "PENDING");
  }, [extendedOrders]);

  const completedOrders = useMemo(() => {
    return extendedOrders.filter(order => order.status === "COMPLETE");
  }, [extendedOrders]);

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

  const handleUpdate = async (data: Partial<Customer>) => {
    await updateCustomer.mutateAsync({ id: String(id), data });
    setIsEditing(false);
    refetch();
  };

  if (customerLoading) return <div className="p-8 text-center text-muted-foreground">Loading customer...</div>;
  if (!customer) return <div className="p-8 text-center text-muted-foreground">Customer not found</div>;

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
      render: (val: unknown) => {
        const numVal = typeof val === 'number' ? val : Number(val);
        return <div className="text-right">{numVal}</div>;
      }
    },
    { 
      key: "totalValue", 
      label: "Total Value", 
      sortable: true,
      render: (val: unknown) => {
        const numVal = typeof val === 'number' ? val : Number(val);
        return <div className="text-right font-mono">{formatCurrency(numVal)}</div>;
      }
    },
  ];

  const holdOrderColumns: Column<ExtendedSalesOrderResponse>[] = [
    { key: "order_number", label: "Order #", sortable: true },
    { 
      key: "order_date", 
      label: "Date", 
      sortable: true,
      render: (val: unknown) => {
        const dateVal = typeof val === 'string' ? val : String(val);
        return <div>{dateVal}</div>;
      }
    },
    { 
      key: "total_amount", 
      label: "Amount", 
      sortable: true,
      render: (val: unknown) => {
        const numVal = typeof val === 'number' ? val : Number(val);
        return <div className="text-right font-mono">{formatCurrency(numVal)}</div>;
      }
    },
    {
      key: "status",
      label: "Status",
      render: (val: unknown) => {
        const status = typeof val === 'string' ? val : String(val);
        return <Badge variant={status === "DRAFT" ? "secondary" : "outline"}>{status}</Badge>;
      },
    },
  ];

  const completedOrderColumns: Column<ExtendedSalesOrderResponse>[] = [
    { key: "order_number", label: "Order #", sortable: true },
    { 
      key: "order_date", 
      label: "Date", 
      sortable: true,
      render: (val: unknown) => {
        const dateVal = typeof val === 'string' ? val : String(val);
        return <div>{dateVal}</div>;
      }
    },
    { 
      key: "total_amount", 
      label: "Amount", 
      sortable: true,
      render: (val: unknown) => {
        const numVal = typeof val === 'number' ? val : Number(val);
        return <div className="text-right font-mono">{formatCurrency(numVal)}</div>;
      }
    },
    {
      key: "status",
      label: "Status",
      render: () => <Badge className="bg-success/20 text-success border-success/30">COMPLETE</Badge>,
    },
  ];

  const invoiceColumns: Column<ExtendedCustomerInvoice>[] = [
    { key: "invoice_number", label: "Invoice #", sortable: true },
    { 
      key: "invoice_date", 
      label: "Date", 
      sortable: true,
      render: (val: unknown) => {
        const dateVal = typeof val === 'string' ? val : String(val);
        return <div>{dateVal}</div>;
      }
    },
    { 
      key: "due_date", 
      label: "Due Date", 
      sortable: true,
      render: (val: unknown) => {
        const dateVal = typeof val === 'string' ? val : String(val);
        return <div>{dateVal}</div>;
      }
    },
    { 
      key: "amount", 
      label: "Amount", 
      sortable: true,
      render: (val: unknown) => {
        const numVal = typeof val === 'number' ? val : Number(val);
        return <div className="text-right font-mono">{formatCurrency(numVal)}</div>;
      }
    },
    { 
      key: "paid_amount", 
      label: "Paid", 
      sortable: true,
      render: (val: unknown) => {
        const numVal = typeof val === 'number' ? val : Number(val);
        return <div className="text-right font-mono">{formatCurrency(numVal)}</div>;
      }
    },
    { 
      key: "outstanding", 
      label: "Outstanding", 
      sortable: true,
      render: (val: unknown) => {
        const numVal = typeof val === 'number' ? val : Number(val);
        return <div className="text-right font-mono">{formatCurrency(numVal)}</div>;
      }
    },
    {
      key: "status",
      label: "Status",
      render: (val: unknown) => {
        const status = typeof val === 'string' ? val : String(val);
        const statusMap: Record<string, { label: string; className: string }> = {
          DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
          UNPAID: { label: "Unpaid", className: "bg-warning/20 text-warning border-warning/30" },
          PAID: { label: "Paid", className: "bg-success/20 text-success border-success/30" },
          PARTIAL: { label: "Partial", className: "bg-info/20 text-info border-info/30" },
          CANCELLED: { label: "Cancelled", className: "bg-destructive/20 text-destructive border-destructive/30" },
        };
        const current = statusMap[status] || { label: status, className: "bg-muted text-muted-foreground" };
        return <Badge className={current.className}>{current.label}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg border border-border hover:bg-muted">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="text-sm text-muted-foreground">Customer Directory</div>
          <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
        </div>
        <div className="flex gap-2">
          {permissions.update && (
            <button onClick={() => setIsEditing(true)} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md border border-border bg-card text-card-foreground text-sm hover:bg-muted">
              <Edit className="w-4 h-4" /> Edit
            </button>
          )}
          {permissions.delete && (
            <button onClick={handleDelete} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md border border-destructive/20 bg-destructive/10 text-destructive text-sm hover:bg-destructive/20">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-lg">Contact Information</h3>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Customer Code</div>
              <div className="font-semibold font-mono">{customer.customer_code}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Contact Person</div>
              <div>{customer.contact_person || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Email Address</div>
              <div>{customer.email || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Phone Number</div>
              <div>{customer.phone || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Billing Address</div>
              <div>
                {customer.address_line ? (
                  <>
                    {customer.address_line}
                    <br />
                    {customer.city}, {customer.state} {customer.postal_code}
                    <br />
                    {customer.country}
                  </>
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-card border border-border rounded-2xl p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="products">Purchased Products</TabsTrigger>
              <TabsTrigger value="active-orders">Active Orders ({holdOrders.length})</TabsTrigger>
              <TabsTrigger value="order-history">Order History ({completedOrders.length})</TabsTrigger>
              <TabsTrigger value="invoices">Invoices ({extendedInvoices.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="products">
              <TableView<PurchasedProduct>
                columns={productColumns}
                data={purchasedProducts}
                loading={ordersLoading}
              />
            </TabsContent>

            <TabsContent value="active-orders">
              <TableView<ExtendedSalesOrderResponse>
                columns={holdOrderColumns}
                data={holdOrders}
                loading={ordersLoading}
                onRowClick={(row) => router.push(`/inventory/pos/${row.id}`)}
              />
            </TabsContent>

            <TabsContent value="order-history">
              <TableView<ExtendedSalesOrderResponse>
                columns={completedOrderColumns}
                data={completedOrders}
                loading={ordersLoading}
                onRowClick={(row) => router.push(`/inventory/pos/${row.id}`)}
              />
            </TabsContent>

            <TabsContent value="invoices">
              <TableView<ExtendedCustomerInvoice>
                columns={invoiceColumns}
                data={extendedInvoices}
                loading={invoicesLoading}
                onRowClick={(row) => router.push(`/finance/customer-invoices/${row.id}`)}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ConfirmModal />
    </div>
  );
}