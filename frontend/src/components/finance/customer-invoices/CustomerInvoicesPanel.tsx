"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import { useCustomerInvoices, usePayCustomerInvoice, useSendInvoice } from "@/hooks/finance/useCustomerInvoices";
import { useSalesInvoices } from "@/hooks/sales/useSalesInvoices";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useCompanySettingsQuery } from "@/hooks/useCompanySettings";
import { useTermsAndConditions } from "@/hooks/useTermsAndConditions";
import { useServerSearch } from "@/hooks/useServerSearch";
import CustomerInvoiceFormModal from "@/components/finance/customer-invoices/CustomerInvoiceFormModal";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { PrintPreviewModal } from "@/components/common/QuoteInvoiceDocument";
import { StatusBadge } from "@/components/finance/ui";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import { Send } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import PayAmountModal from "@/components/finance/PayAmountModal";
import { toast } from "sonner";

interface CustomerInvoicesPanelProps {
  moduleCode: "FINANCE" | "SALES";
}

export default function CustomerInvoicesPanel({ moduleCode }: CustomerInvoicesPanelProps) {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [invoiceToPay, setInvoiceToPay] = useState<any>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printInvoice, setPrintInvoice] = useState<any>(null);
  const pagination = usePagination();

  const fetchCustomers = useServerSearch("/api/finance/customers/", {
    transformOption: (c: any) => ({
      value: c.id,
      label: c.name,
    }),
  });

  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
    { name: "status", label: "Status", type: "status", options: [
      { value: "PENDING", label: "Pending" },
      { value: "SENT", label: "Sent" },
      { value: "DRAFT", label: "Draft" },
      { value: "CANCELLED", label: "Cancelled" },
    ]},
  ];

  // Use the correct API based on module code
  // Both hooks are always called (React rules of hooks) but only the relevant one returns data
  const isSales = moduleCode === "SALES";

  const filterParams = useMemo(() => ({
    page: pagination.page,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.customer ? { customer: filters.customer } : {}),
  }), [filters, pagination.page]);

  const { data: financeInvoices, isLoading: financeLoading, totalCount: financeTotalCount } = useCustomerInvoices(filterParams);
  const { data: salesInvoices, isLoading: salesLoading, totalCount: salesTotalCount } = useSalesInvoices(filterParams);

  const totalCount = isSales ? salesTotalCount : financeTotalCount;
  
  const invoices = isSales ? salesInvoices : financeInvoices;
  const isLoading = isSales ? salesLoading : financeLoading;
  
  const payInvoice = usePayCustomerInvoice();
  const sendInvoice = useSendInvoice();

  const resourceName = moduleCode === "SALES" ? "sales_customers_invoice" : "customer_invoice";
  const permissions = useFeaturePermissions(moduleCode, resourceName);
  const { data: companySettings } = useCompanySettingsQuery();
  const { terms: termsData } = useTermsAndConditions();

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
    if (invoice.status === "SENT" && invoice.payment_status !== "PAID" && Number(invoice.outstanding) > 0) {
      setInvoiceToPay(invoice);
      setPayModalOpen(true);
    }
  };

  const handleSend = async (invoice: any) => {
    try {
      await sendInvoice.mutateAsync(invoice.id);
      toast.success("Invoice sent successfully");
    } catch {
      /* toast from apiFetch */
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
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (val: string) => <StatusBadge status={val || "DRAFT"} />,
    },
    {
      key: "payment_status",
      label: "Payment",
      sortable: true,
      render: (val: string, row: any) => {
        const hasRefund = row.payments?.some((p: any) => p.payment_type === "PAYMENT" && p.status === "CONFIRMED");
        return <StatusBadge status={hasRefund ? "REFUNDED" : val || "UNPAID"} />;
      },
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
        totalCount={totalCount}
        currentPage={pagination.page}
        onPageChange={pagination.setPage}
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
          canEdit: (invoice) => (invoice.status === "DRAFT" || invoice.status === "PENDING") && invoice.payment_status !== "PAID",
          onSend: handleSend,
          canSend: (invoice) => invoice.status === "PENDING",
          sendLabel: "Send",
          onPost: handlePay,
          canPost: (invoice) =>
            invoice.status === "SENT" &&
            invoice.payment_status !== "PAID" &&
            invoice.status !== "CANCELLED" &&
            Number(invoice.outstanding) > 0,
          postLabel: "Pay",
          onPrint: (invoice) => {
            setPrintInvoice(invoice);
            setShowPrintPreview(true);
          },
        }}
        onRowClick={handleRowClick}
        exportEnabled={permissions.export}
        onRowSelect={setSelectedIds}
        filterBar={
          <FilterBar
            fields={filterFields}
            filters={filters}
            onChange={(f) => { setFilters(f); pagination.resetPage(); }}
          />
        }
        batchActions={
          <>
            <button
              onClick={async () => {
                try {
                  await Promise.all(selectedIds.map((id) => payInvoice.mutateAsync({ id })));
                } catch {
                  // errors shown via mutation error state
                }
                setSelectedIds([]);
              }}
              disabled={payInvoice.isPending}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80"
            >
              <Send className="w-4 h-4" />
              {payInvoice.isPending ? "Paying..." : "Pay Selected"}
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

      {invoiceToPay && (
        <PayAmountModal
          open={payModalOpen}
          onClose={() => {
            setPayModalOpen(false);
            setInvoiceToPay(null);
          }}
          title={moduleCode === "FINANCE" ? "Receive Payment" : "Receive Payment"}
          documentLabel="Invoice"
          documentNumber={invoiceToPay.invoice_number}
          subtitle={invoiceToPay.customer_name ? `Customer: ${invoiceToPay.customer_name}` : undefined}
          totalAmount={Number(invoiceToPay.amount)}
          paidAmount={Number(invoiceToPay.paid_amount || 0)}
          outstanding={Number(invoiceToPay.outstanding || 0)}
          paymentStatus={invoiceToPay.payment_status || "UNPAID"}
          isPending={payInvoice.isPending}
          onSubmit={async (data) => {
            await payInvoice.mutateAsync({
              id: invoiceToPay.id,
              body: {
                amount: data.amount,
                payment_method: data.payment_method,
                payment_date: data.payment_date,
                reference_number: data.reference_number,
              },
            });
            setPayModalOpen(false);
            setInvoiceToPay(null);
          }}
        />
      )}
      {printInvoice && companySettings && (
        <PrintPreviewModal
          open={showPrintPreview}
          onClose={() => { setShowPrintPreview(false); setPrintInvoice(null); }}
          documentProps={{
            data: {
              type: "INVOICE",
              documentNumber: printInvoice.invoice_number,
              date: printInvoice.invoice_date,
              dueDate: printInvoice.due_date,
              customerName: printInvoice.customer_name || "—",
              customerEmail: (printInvoice as any).customer_email || "",
              customerPhone: (printInvoice as any).customer_phone || "",
              lines: (printInvoice.lines || []).map((l: any) => ({
                variant_name: l.variant_name,
                variant_sku: l.variant_sku,
                quantity: l.quantity,
                unit_price: l.unit_price,
                tax_rate: l.tax_rate,
                discount_amount: l.discount_amount,
              })),
              totalAmount: Number(printInvoice.amount),
              overallDiscountPercent: Number((printInvoice as any).overall_discount_percent || 0),
              overallTaxPercent: Number((printInvoice as any).overall_tax_percent || 0),
              status: printInvoice.status,
              paymentStatus: printInvoice.payment_status,
              notes: printInvoice.notes,
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
            termsContent: termsData?.invoice || "",
            formatCurrency,
          }}
        />
      )}
    </>
  );
}
