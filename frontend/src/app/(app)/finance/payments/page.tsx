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

// Helper function to safely convert amount to number
const toNumber = (amount: number | string): number => {
  return typeof amount === "string" ? parseFloat(amount) : amount;
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
    { name: "payment_type", label: "Type", type: "select", options: paymentTypeOptions },
    { name: "supplier", label: "Supplier/Customer", type: "select", searchable: true, options: supplierOptions },
    { name: "start_date", label: "From", type: "date" },
    { name: "end_date", label: "To", type: "date" },
  ];

  const { data: payments, isLoading } = usePayments(
    Object.keys(filters).length > 0
      ? {
          payment_type: (filters.payment_type as "RECEIPT" | "PAYMENT") || undefined,
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
    
    // Convert amounts to numbers safely
    const totalReceipts = data
      .filter((p) => p.payment_type === "RECEIPT")
      .reduce((sum, p) => sum + toNumber(p.amount), 0);
    
    const totalPayments = data
      .filter((p) => p.payment_type === "PAYMENT")
      .reduce((sum, p) => sum + toNumber(p.amount), 0);
    
    const netCashFlow = totalReceipts - totalPayments;
    
    return [
      { 
        label: "Receipts", 
        value: totalReceipts, 
        tone: "success" as const, 
        isCurrency: true 
      },
      { 
        label: "Payments", 
        value: totalPayments, 
        tone: "destructive" as const, 
        isCurrency: true 
      },
      { 
        label: "Net Cash Flow", 
        value: Math.abs(netCashFlow), 
        tone: netCashFlow >= 0 ? "success" as const : "destructive" as const, 
        isCurrency: true,
        sub: netCashFlow >= 0 ? "Positive" : "Negative"
      },
      { 
        label: "Transactions", 
        value: data.length, 
        isCurrency: false,
        tone: "info" as const
      },
    ];
  };

  const columns = [
    { key: "payment_date", label: "Date", sortable: true },
    { key: "payment_type", label: "Type", render: (val: string) => (val === "RECEIPT" ? "Receipt" : "Payment"), sortable: true },
    { key: "amount", label: "Amount", align: "right" as const, sortable: true, render: (val: number | string) => formatCurrency(toNumber(val)) },
    { key: "supplier_name", label: "Supplier/Customer", render: (val: any, row: Payment) => row.supplier_name || row.customer_name || "-" },
    { key: "payment_method", label: "Method" },
    { key: "reference_number", label: "Reference" },
    { key: "status", label: "Status", render: (val: any, row: Payment) => <StatusBadge status={row.journal_entry ? "Posted" : "Draft"} /> },
  ];

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Banking & Cash", "Payments"]}
        title="Payments"
        description="Record customer receipts and supplier payments"
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