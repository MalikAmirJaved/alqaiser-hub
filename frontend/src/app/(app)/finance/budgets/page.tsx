"use client";

import { useState } from "react";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import { useBudgets, useDeleteBudget } from "@/hooks/finance/useBudgets";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { formatCurrency } from "@/lib/currency";
import BudgetFormModal from "@/components/finance/budgets/BudgetFormModal";

export default function BudgetsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const { data: budgets, isLoading } = useBudgets({ year });
  const deleteBudget = useDeleteBudget();
  const permissions = useFeaturePermissions("FINANCE", "budget");

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: true,
  };

  const computeKPIs = (data: any[]) => {
    const totalBudget = data.reduce((sum, b) => sum + Number(b.amount), 0);
    return [
      { label: "Total Budget", value: totalBudget, isCurrency: true },
      { label: "Accounts", value: new Set(data.map((b) => b.account)).size, isCurrency: false },
      { label: "Year", value: year, isCurrency: false },
    ];
  };

  const columns = [
    { key: "account_name", label: "Account", sortable: true },
    { key: "period_type", label: "Period Type" },
    { key: "year", label: "Year", sortable: true },
    { key: "period", label: "Period", render: (val: any, row: any) => row.month || row.quarter || "Yearly" },
    { key: "amount", label: "Amount", align: "right" as const, render: (val: number) => formatCurrency(val), sortable: true },
  ];

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="px-3 py-1.5 text-sm border border-border rounded-md"
        />
      </div>
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
        exportEnabled
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