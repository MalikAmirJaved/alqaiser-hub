"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import { useCustomerInvoices, usePayCustomerInvoice } from "@/hooks/finance/useCustomerInvoices";
import { useSalesInvoices } from "@/hooks/sales/useSalesInvoices";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useCustomers } from "@/hooks/useCustomers";
import CustomerInvoiceFormModal from "@/components/finance/customer-invoices/CustomerInvoiceFormModal";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { StatusBadge } from "@/components/finance/ui";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import { Send } from "lucide-react";

interface CustomerInvoicesPanelProps {
  moduleCode: "FINANCE" | "SALES";
}

export default function CustomerInvoicesPanel({ moduleCode }: CustomerInvoicesPanelProps) {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const { data: customers = [] } = useCustomers();
  const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));

  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
    { name: "customer", label: "Customer", type: "select", searchable: true, options: customerOptions },
    { name: "status", label: "Status", type: "status", options: [
      { value: "DRAFT", label: "Draft" },
      { value: "CANCELLED", label: "Cancelled" },
    ]},
  ];

  // Use the correct API based on module code
  // Both hooks are always called (React rules of hooks) but only the relevant one returns data
  const isSales = moduleCode === "SALES";
  const filterParams = Object.keys(filters).length > 0
    ? {
        search: filters.search || undefined,
        status: filters.status || undefined,
        customer: filters.customer || undefined,
      }
    : undefined;
  
  const { data: financeInvoices, isLoading: financeLoading } = useCustomerInvoices(filterParams);
  const { data: salesInvoices, isLoading: salesLoading } = useSalesInvoices(filterParams);
  
  const invoices = isSales ? salesInvoices : financeInvoices;
  const isLoading = isSales ? salesLoading : financeLoading;
  
  const payInvoice = usePayCustomerInvoice();

  const resourceName = moduleCode === "SALES" ? "sales_customers_invoice" : "customer_invoice";
  const permissions = useFeaturePermissions(moduleCode, resourceName);

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: permissions.export,
  };

  const detailPathPrefix = moduleCode === "FINANCE" ? "/finance/customer-invoices" : "/sales/customer-invoices";

  const handleRowClick = (invoice: any) => {
    router.push(`${detailPathPrefix}/${invoice.id}`);
  };

  const handleEdit = (invoice: any) => {
    setEditingInvoice(invoice);
    setModalOpen(true);
  };

  const handlePay = (invoice: any) => {
    if (invoice.payment_status !== "PAID" && invoice.status !== "CANCELLED") {
      payInvoice.mutate({ id: invoice.id });
    }
  };

  const computeKPIs = (data: any[]) => {
    const totalOutstanding = data.reduce((sum, inv) => sum + Number(inv.outstanding || 0), 0);
    const totalPaid = data.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);
    const overdueCount = data.filter((inv) => inv.payment_status !== "PAID" && inv.due_date && new Date(inv.due_date) < new Date()).length;
    const draftCount = data.filter((inv) => inv.status === "DRAFT").length;
    return [
      {
        label: "Outstanding",
        value: totalOutstanding,
        sub: `${data.length} open invoices`,
        tone: "info" as const,
        isCurrency: true,
      },
      {
        label: "Overdue",
        value: overdueCount,
        sub: `${overdueCount} invoices past due`,
        tone: "destructive" as const,
        isCurrency: false,
      },
      {
        label: "Paid (MTD)",
        value: totalPaid,
        sub: "YTD",
        tone: "success" as const,
        isCurrency: true,
      },
      { 
        label: "Draft", 
        value: draftCount,
        sub: "Awaiting issue",
        isCurrency: false,
      },
    ];
  };

  const columns = [
    { key: "invoice_number", label: "Invoice #", mono: true, sortable: true },
    { key: "customer_name", label: "Customer", sortable: true },
    { key: "invoice_date", label: "Issued", sortable: true },
    { key: "due_date", label: "Due", sortable: true },
    {
      key: "amount",
      label: "Amount",
      align: "right" as const,
      sortable: true,
      render: (val: number) => formatCurrency(val),
    },
    {
      key: "outstanding",
      label: "Balance",
      align: "right" as const,
      sortable: true,
      render: (val: number) => (val ? formatCurrency(val) : "—"),
    },
    { key: "currency", label: "Curr", render: () => "USD" },
    {
      key: "payment_status",
      label: "Payment",
      sortable: true,
      render: (val: string) => <StatusBadge status={val || "UNPAID"} />,
    },
  ];

  return (
    <>
      <DynamicModulePage
        breadcrumbs={moduleCode === "FINANCE" ? ["Receivables", "Customer Invoices"] : ["Sales", "Invoices"]}
        title="Customer Invoices"
        description="Issue, track, and reconcile customer invoices."
        data={invoices || []}
        isLoading={isLoading}
        columns={columns}
        kpis={computeKPIs}
        getRowId={(invoice) => invoice.id}
        permissions={modulePermissions}
        primaryActionLabel="New Invoice"
        onCreate={() => {
          setEditingInvoice(null);
          setModalOpen(true);
        }}
        actions={{
          onEdit: handleEdit,
          canEdit: (invoice) => invoice.status === "DRAFT" && invoice.payment_status !== "PAID",
          onPost: handlePay,
          canPost: (invoice) => invoice.payment_status !== "PAID" && invoice.status !== "CANCELLED",
          postLabel: "Pay",
        }}
        onRowClick={handleRowClick}
        exportEnabled={permissions.export}
        onRowSelect={setSelectedIds}
        filterBar={
          <FilterBar
            fields={filterFields}
            filters={filters}
            onChange={setFilters}
          />
        }
        batchActions={
          <>
            <button
              onClick={() => {
                selectedIds.forEach((id) => payInvoice.mutate({ id }));
                setSelectedIds([]);
              }}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80"
            >
              <Send className="w-4 h-4" />
              Pay Selected
            </button>
          </>
        }
      />
      <CustomerInvoiceFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingInvoice(null);
        }}
        initialData={editingInvoice}
        moduleCode={moduleCode}
      />
    </>
  );
}
