"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import { useSupplierBills, usePaySupplierBill } from "@/hooks/finance/useSupplierBills";
import { StatusBadge } from "@/components/finance/ui";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useServerSearch } from "@/hooks/useServerSearch";
import PayAmountModal from "@/components/finance/PayAmountModal";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import { usePagination } from "@/hooks/usePagination";

export default function SupplierBillsPage() {
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [billToPay, setBillToPay] = useState<any>(null);

  const pagination = usePagination();

  const filtersWithPage = useMemo(() => ({
    page: pagination.page,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.supplier ? { supplier: filters.supplier } : {}),
  }), [filters, pagination.page]);

  const fetchSuppliers = useServerSearch("/api/inventory/suppliers/", {
    transformOption: (s: any) => ({
      value: s.id,
      label: s.name,
    }),
  });

  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
    { name: "supplier", label: "Supplier", type: "select", searchable: true, fetchOptions: fetchSuppliers },
  ];

  const { data: bills, isLoading, totalCount } = useSupplierBills(filtersWithPage);
  const payBill = usePaySupplierBill();
  const permissions = useFeaturePermissions("FINANCE", "supplier_bill");

  const modulePermissions: ModulePermissions = {
    view: permissions.view,
    update: permissions.pay,
    export: permissions.export,
    create: false,
    delete: false,
  };

  const handleRowClick = (bill: any) => {
    router.push(`/finance/supplier-bills/${bill.id}`);
  };

  const handlePay = (bill: any) => {
    if (bill.payment_status !== "PAID" && bill.status !== "CANCELLED" && Number(bill.outstanding) > 0) {
      setBillToPay(bill);
      setPayModalOpen(true);
    }
  };

  const computeKPIs = (data: any[]) => {
    const totalOutstanding = data.reduce((sum, bill) => sum + Number(bill.outstanding || 0), 0);
    const totalPaid = data.reduce((sum, bill) => sum + Number(bill.paid_amount || 0), 0);
    const unpaidCount = data.filter((bill) => bill.payment_status === "UNPAID").length;
    const partialCount = data.filter((bill) => bill.payment_status === "PARTIAL").length;
    return [
      { label: "Outstanding", value: totalOutstanding, sub: `${unpaidCount + partialCount} open`, tone: "info" as const, isCurrency: true },
      { label: "Paid", value: totalPaid, sub: `${data.filter((b) => b.payment_status === "PAID").length} settled`, tone: "success" as const, isCurrency: true },
      { label: "Unpaid", value: unpaidCount, sub: "bills", tone: "destructive" as const, isCurrency: false },
      { label: "Partial", value: partialCount, sub: "in progress", tone: "warning" as const, isCurrency: false },
    ];
  };

  const columns = [
    { key: "bill_number", label: "Bill #", mono: true, sortable: true },
    { key: "supplier_name", label: "Supplier", sortable: true },
    { key: "bill_date", label: "Bill Date", sortable: true },
    { key: "due_date", label: "Due Date", sortable: true },
    { key: "amount", label: "Amount", align: "right" as const, sortable: true, render: (val: number) => formatCurrency(val) },
    { key: "paid_amount", label: "Paid", align: "right" as const, render: (val: number) => formatCurrency(val) },
    {
      key: "outstanding",
      label: "Outstanding",
      align: "right" as const,
      sortable: true,
      render: (val: number) => (val ? formatCurrency(val) : "—"),
    },
    {
      key: "payment_status",
      label: "Status",
      sortable: true,
      render: (val: string, row: any) => <StatusBadge status={row.status === "CANCELLED" ? "CANCELLED" : (val || "UNPAID")} />,
    },
  ];

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Payables", "Supplier Bills"]}
        title="Supplier Bills"
        description="View and pay supplier bills (accounts payable)"
        data={bills || []}
        isLoading={isLoading}
        totalCount={totalCount}
        currentPage={pagination.page}
        onPageChange={pagination.setPage}
        columns={columns}
        kpis={computeKPIs}
        getRowId={(bill) => bill.id}
        permissions={modulePermissions}
        actions={{
          onPost: handlePay,
          canPost: (bill) =>
            bill.payment_status !== "PAID" &&
            bill.status !== "CANCELLED" &&
            Number(bill.outstanding) > 0,
          postLabel: "Pay",
        }}
        onRowClick={handleRowClick}
        exportEnabled={permissions.export}
        filterBar={
          <FilterBar
            fields={filterFields}
            filters={filters}
            onChange={(f) => { setFilters(f); pagination.resetPage(); }}
          />
        }
      />

      {billToPay && (
        <PayAmountModal
          open={payModalOpen}
          onClose={() => {
            setPayModalOpen(false);
            setBillToPay(null);
          }}
          title="Pay Supplier Bill"
          documentLabel="Bill"
          documentNumber={billToPay.bill_number}
          subtitle={billToPay.supplier_name ? `Supplier: ${billToPay.supplier_name}` : undefined}
          totalAmount={Number(billToPay.amount)}
          paidAmount={Number(billToPay.paid_amount || 0)}
          outstanding={Number(billToPay.outstanding || 0)}
          creditAmount={Number(billToPay.supplier_credit || 0)}
          paymentStatus={billToPay.payment_status || "UNPAID"}
          isPending={payBill.isPending}
          onSubmit={async (data) => {
            try {
              await payBill.mutateAsync({
                id: billToPay.id,
                body: {
                  amount: data.amount,
                  payment_method: data.payment_method,
                  payment_date: data.payment_date,
                  reference_number: data.reference_number,
                },
              });
              setPayModalOpen(false);
              setBillToPay(null);
            } catch {
              // error handled by mutation error state
            }
          }}
        />
      )}
    </>
  );
}
