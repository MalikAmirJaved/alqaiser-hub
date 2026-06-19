// frontend/src/app/(app)/finance/payments/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DynamicModulePage, type ModulePermissions, type Kpi } from "@/components/reuseable/final/DynamicModulePage";
import { usePayments, useDeletePayment, type Payment, paymentTypeOptions } from "@/hooks/finance/usePayments";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { StatusBadge } from "@/components/finance/ui";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import PaymentFormModal from "@/components/finance/payments/PaymentFormModal";

const toNumber = (amount: number | string): number => {
  return typeof amount === "string" ? parseFloat(amount) : amount;
};

const sourceLabels: Record<string, string> = {
  customer_invoice: "Invoice",
  supplier_bill: "Bill",
  expense: "Expense",
  payroll: "Payroll",
  employee_loan: "Loan",
};

const sourceColors: Record<string, string> = {
  customer_invoice: "bg-info/15 text-info border-info/30",
  supplier_bill: "bg-primary/15 text-primary border-primary/30",
  expense: "bg-warning/15 text-warning border-warning/30",
  payroll: "bg-success/15 text-success border-success/30",
  employee_loan: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function PaymentsPage() {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const { data: suppliers = [] } = useSuppliers();
  const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name }));

  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
    { name: "payment_type", label: "Direction", type: "select", options: paymentTypeOptions },
    { name: "status", label: "Status", type: "select", options: [
      { value: "CONFIRMED", label: "Paid" },
      { value: "DRAFT", label: "Unpaid" },
      { value: "CANCELLED", label: "Cancelled" },
    ]},
    { name: "supplier", label: "Supplier/Customer", type: "select", searchable: true, options: supplierOptions },
    { name: "start_date", label: "From", type: "date" },
    { name: "end_date", label: "To", type: "date" },
  ];

  const { data: payments, isLoading } = usePayments(
    Object.keys(filters).length > 0
      ? {
          search: filters.search || undefined,
          payment_type: (filters.payment_type as "RECEIPT" | "PAYMENT") || undefined,
          status: filters.status || undefined,
          supplier: filters.supplier || undefined,
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined,
        }
      : undefined
  );
  const deletePayment = useDeletePayment();
  const permissions = useFeaturePermissions("FINANCE", "payment");

  const modulePermissions: ModulePermissions = {
    view: permissions.view,
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    export: permissions.export,
  };

  const handleRowClick = (payment: Payment) => {
    router.push(`/finance/payments/${payment.id}`);
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setModalOpen(true);
  };

  const handleDelete = (payment: Payment) => {
    deletePayment.mutate(payment.id);
  };

  const computeKPIs = (data: Payment[]): Kpi[] => {
    const totalReceipts = data
      .filter((p) => p.payment_type === "RECEIPT")
      .reduce((sum, p) => sum + toNumber(p.amount), 0);

    const totalPayments = data
      .filter((p) => p.payment_type === "PAYMENT")
      .reduce((sum, p) => sum + toNumber(p.amount), 0);

    const totalPaid = data
      .filter((p) => p.status === "CONFIRMED")
      .reduce((sum, p) => sum + toNumber(p.amount), 0);

    const totalUnpaid = data
      .filter((p) => p.status === "DRAFT")
      .reduce((sum, p) => sum + toNumber(p.amount), 0);

    return [
      {
        label: "Money In",
        value: totalReceipts,
        tone: "success" as const,
        isCurrency: true,
      },
      {
        label: "Money Out",
        value: totalPayments,
        tone: "destructive" as const,
        isCurrency: true,
      },
      {
        label: "Paid",
        value: totalPaid,
        tone: "success" as const,
        isCurrency: true,
        sub: `${data.filter((p) => p.status === "CONFIRMED").length} transactions`,
      },
      {
        label: "Unpaid",
        value: totalUnpaid,
        tone: "warning" as const,
        isCurrency: true,
        sub: `${data.filter((p) => p.status === "DRAFT").length} transactions`,
      },
    ];
  };

  const columns = [
    { key: "payment_date", label: "Date", sortable: true },
    { key: "payment_type", label: "Direction", render: (val: string) => (
      <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
        val === "RECEIPT" ? "bg-success/15 text-success border-success/30" : "bg-destructive/15 text-destructive border-destructive/30"
      }`}>
        {val === "RECEIPT" ? "Money In" : "Money Out"}
      </span>
    ), sortable: true },
    { key: "amount", label: "Amount", align: "right" as const, sortable: true, render: (val: number | string) => (
      <span className="font-medium">{formatCurrency(toNumber(val))}</span>
    )},
    { key: "payable_type", label: "Source", render: (val: string | null, row: Payment) => {
      const label = val ? (sourceLabels[val] || val) : "Manual";
      const color = val ? (sourceColors[val] || "bg-muted text-muted-foreground border-border") : "bg-muted text-muted-foreground border-border";
      return (
        <div className="flex flex-col">
          <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${color}`}>
            {label}
          </span>
          {row.payable_label && (
            <span className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]">{row.payable_label}</span>
          )}
        </div>
      );
    }},
    { key: "payee", label: "To / From", render: (_val: any, row: Payment) => {
      if (row.payment_type === "RECEIPT") return row.customer_name || row.supplier_name || "-";
      return row.supplier_name || row.customer_name || "-";
    }},
    { key: "payment_method", label: "Method", render: (val: string) => (
      <span className="text-xs">{val?.replace("_", " ")}</span>
    )},
    { key: "status", label: "Status", render: (val: string) => {
      const statusMap: Record<string, string> = {
        CONFIRMED: "Paid",
        DRAFT: "Unpaid",
        CANCELLED: "Cancelled",
      };
      return <StatusBadge status={statusMap[val] || val} />;
    }},
  ];

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Finance", "Payments"]}
        title="Payments"
        description="Track all money movements — invoices, bills, payroll, expenses, and loans"
        data={payments || []}
        isLoading={isLoading}
        columns={columns}
        kpis={computeKPIs}
        getRowId={(p) => p.id}
        permissions={modulePermissions}
        primaryActionLabel="New Payment"
        onCreate={() => {
          setEditingPayment(null);
          setModalOpen(true);
        }}
        actions={{
          onEdit: handleEdit,
          onDelete: handleDelete,
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
          <button
            onClick={() => {
              selectedIds.forEach((id) => deletePayment.mutate(id));
              setSelectedIds([]);
            }}
            className="text-sm text-destructive hover:text-destructive/80"
          >
            Delete Selected
          </button>
        }
      />
      <PaymentFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingPayment(null);
        }}
        initialData={editingPayment}
      />
    </>
  );
}
