"use client";

import { useState } from "react";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import { useBudgets, useDeleteBudget } from "@/hooks/finance/useBudgets";
import { useAccounts, accountTypeOptions } from "@/hooks/finance/useAccounts";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import BudgetFormModal from "@/components/finance/budgets/BudgetFormModal";

export default function BudgetsPage() {
    const formatCurrency = useFormatCurrency();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data: accounts } = useAccounts();
  const accountOptions = (accounts || []).map(a => ({ value: a.id, label: `${a.code} - ${a.name}` }));
  const { data: budgets, isLoading } = useBudgets({
    year,
    account_id: filters.account_id || undefined,
    period_type: filters.period_type || undefined,
  });
  const deleteBudget = useDeleteBudget();
  const permissions = useFeaturePermissions("FINANCE", "budget");

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: permissions.export,
  };

  const computeKPIs = (data: any[]) => {
    const totalBudget = data.reduce((sum, b) => sum + Number(b.amount), 0);
    return [
      { label: "Total Budget", value: totalBudget, isCurrency: true },
      { label: "Accounts", value: new Set(data.map((b) => b.account)).size, isCurrency: false },
      { label: "Year", value: year, isCurrency: false },
    ];
  };

  const filterFields: FilterField[] = [
    { name: "account_id", label: "Account", type: "select", searchable: true, options: accountOptions },
    { name: "period_type", label: "Period", type: "select", options: [
      { value: "MONTHLY", label: "Monthly" },
      { value: "QUARTERLY", label: "Quarterly" },
      { value: "YEARLY", label: "Yearly" },
    ]},
  ];

  const columns = [
    { key: "account_name", label: "Account", sortable: true },
    { key: "period_type", label: "Period Type" },
    { key: "year", label: "Year", sortable: true },
    { key: "period", label: "Period", render: (val: any, row: any) => row.month || row.quarter || "Yearly" },
    { key: "amount", label: "Amount", align: "right" as const, render: (val: number) => formatCurrency(val), sortable: true },
  ];

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Operations", "Budgets"]}
        title="Budgets"
        description="Set and track budget amounts per account"
        data={budgets || []}
        isLoading={isLoading}
        columns={columns}
        kpis={computeKPIs}
        getRowId={(b) => b.id}
        permissions={modulePermissions}
        primaryActionLabel="New Budget"
        onCreate={() => {
          setEditingBudget(null);
          setModalOpen(true);
        }}
        actions={{
          onEdit: setEditingBudget,
          onDelete: (budget) => deleteBudget.mutate(budget.id),
        }}
        exportEnabled={permissions.export}
        filterBar={
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <FilterBar
                fields={filterFields}
                filters={filters}
                onChange={setFilters}
              />
            </div>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-24 px-3 py-1.5 text-sm border border-border rounded-md"
            />
          </div>
        }
      />
      <BudgetFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editingBudget}
        selectedYear={year}
        onSuccess={() => setModalOpen(false)}
      />
    </>
  );
}