"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import { useJournalEntries, type JournalEntry } from "@/hooks/finance/useJournalEntries";
import { usePagination } from "@/hooks/usePagination";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";

const toNumber = (value: number | string): number => {
  return typeof value === "string" ? parseFloat(value) : value;
};

export default function JournalEntriesPage() {
    const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const [filters, setFilters] = useState<Record<string, string>>({});

  const pagination = usePagination();

  // Build API filters from FilterBar state
  const journalFilters = useMemo(() => ({
    page: pagination.page,
    ordering: "-date" as const,
    ...(filters.date__gte ? { date__gte: filters.date__gte } : {}),
    ...(filters.date__lte ? { date__lte: filters.date__lte } : {}),
    ...(filters.reference_type ? { reference_type: filters.reference_type } : {}),
    ...(filters.is_posted ? { is_posted: filters.is_posted === "true" } : {}),
  }), [filters, pagination.page]);

  const filterFields: FilterField[] = [
    { name: "date__gte", label: "From Date", type: "date" },
    { name: "date__lte", label: "To Date", type: "date" },
    { name: "reference_type", label: "Reference", type: "select", options: [
      { value: "", label: "All References" },
      { value: "MANUAL", label: "Manual" },
      { value: "INVOICE", label: "Invoice" },
      { value: "EXPENSE", label: "Expense" },
      { value: "PAYMENT", label: "Payment" },
      { value: "BILL", label: "Bill" },
    ]},
    { name: "is_posted", label: "Status", type: "boolean" },
  ];

  const { data: entries, isLoading, totalCount } = useJournalEntries(journalFilters);

  const permissions = useFeaturePermissions("FINANCE", "journal_entrie");
  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: permissions.export,
  };

  const handleRowClick = (entry: JournalEntry) => {
    router.push(`/finance/journal-entries/${entry.id}`);
  };

  // Compute KPIs from real data
  const computeKPIs = (data: JournalEntry[]) => {
    const totalDebits = data.reduce(
      (sum, entry) => sum + entry.lines.reduce((s, line) => s + toNumber(line.debit), 0),
      0
    );
    const totalCredits = data.reduce(
      (sum, entry) => sum + entry.lines.reduce((s, line) => s + toNumber(line.credit), 0),
      0
    );
    const postedCount = data.filter((e) => e.is_posted).length;
    const draftCount = data.filter((e) => !e.is_posted).length;
    return [
      { label: "Total Debits", value: totalDebits, isCurrency: true, tone: "info" as const },
      { label: "Total Credits", value: totalCredits, isCurrency: true, tone: "info" as const },
      { label: "Posted", value: postedCount, sub: `${postedCount} entries`, isCurrency: false },
      { label: "Draft", value: draftCount, sub: `${draftCount} entries`, isCurrency: false },
    ];
  };

  const columns = [
    { key: "date", label: "Date", sortable: true },
    { key: "entry_number", label: "Entry #", mono: true, sortable: true },
    { key: "description", label: "Description" },
    { key: "reference_type", label: "Reference", render: (val: string) => val || "—" },
    {
      key: "total_debit",
      label: "Total Debit",
      align: "right" as const,
      render: (_, row) => {
        const total = row.lines.reduce((s: number, l: any) => s + toNumber(l.debit), 0);
        return formatCurrency(total);
      },
    },
    {
      key: "total_credit",
      label: "Total Credit",
      align: "right" as const,
      render: (_, row) => {
        const total = row.lines.reduce((s: number, l: any) => s + toNumber(l.credit), 0);
        return formatCurrency(total);
      },
    },
    {
      key: "is_posted",
      label: "Status",
      render: (val: boolean) => (val ? "Posted" : "Draft"),
    },
  ];



  return (
    <>
      <DynamicModulePage
        breadcrumbs={["General Ledger", "Journal Entries"]}
        title="Journal Entries"
        description="View all double‑entry accounting records"
        data={entries || []}
        isLoading={isLoading}
        totalCount={totalCount}
        currentPage={pagination.page}
        onPageChange={pagination.setPage}
        columns={columns}
        kpis={computeKPIs}
        getRowId={(entry) => entry.id}
        permissions={modulePermissions}
        primaryActionLabel="New Journal Entry"
        // No create action for now – journal entries are auto‑created
        onCreate={undefined}
        onRowClick={handleRowClick}
        exportEnabled={permissions.export}
        filterBar={
          <FilterBar
            fields={filterFields}
            filters={filters}
            onChange={(f) => { setFilters(f); pagination.resetPage(); }}
          />
        }
        // No batch actions for journal entries
      />
    </>
  );
}