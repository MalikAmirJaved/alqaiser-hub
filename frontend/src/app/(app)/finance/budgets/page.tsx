"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useBudgets, useDeleteBudget } from "@/hooks/finance/useBudgets";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { Plus, Pencil, Trash2 } from "lucide-react";
import BudgetFormModal from "@/components/finance/budgets/BudgetFormModal";
import { formatCurrency } from "@/lib/currency";

const periodTypeLabels: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

const columns: Column[] = [
  { key: "account_code", label: "Account Code", sortable: true },
  { key: "account_name", label: "Account Name", sortable: true },

  {
    key: "period_type",
    label: "Period",
    render: (val): React.ReactNode =>
      periodTypeLabels[String(val)] ?? String(val),
  },

  { key: "year", label: "Year", sortable: true },

  {
    key: "month",
    label: "Month",
    render: (val): React.ReactNode => (val ? String(val) : "—"),
  },

  {
    key: "quarter",
    label: "Quarter",
    render: (val): React.ReactNode => (val ? String(val) : "—"),
  },

  {
    key: "amount",
    label: "Budget Amount",
    sortable: true,
    render: (val): React.ReactNode => formatCurrency(Number(val ?? 0)),
  },
];

export default function BudgetsPage() {
  const permissions = useFeaturePermissions("FINANCE", "budget");
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(currentYear.toString());
  const [periodTypeFilter, setPeriodTypeFilter] = useState("");
  const { data: budgets, isLoading } = useBudgets({ 
    year: yearFilter ? parseInt(yearFilter) : undefined, 
    period_type: periodTypeFilter || undefined 
  });
  const deleteBudget = useDeleteBudget();
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);

  const handleDelete = (budget: any) => {
    confirm({ 
      title: "Delete Budget", 
      message: `Delete budget for ${budget.account_name} for ${budget.year}?`, 
      onConfirm: () => deleteBudget.mutate(budget.id) 
    });
  };

  const tableData = (budgets || []).map(b => ({ ...b })) as Record<string, unknown>[];

  return (
    <div className="p-4 md:p-6">
      <PageHeader 
        title="Budgets" 
        subtitle="Set budget targets for expense and income accounts" 
        actions={
          permissions.create && (
            <button 
              onClick={() => { setEditingBudget(null); setModalOpen(true); }} 
              className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm"
            >
              <Plus className="w-4 h-4" /> New Budget
            </button>
          )
        } 
      />
      
      <div className="flex flex-wrap gap-3 mb-4">
        <input 
          type="number" 
          value={yearFilter} 
          onChange={(e) => setYearFilter(e.target.value)} 
          placeholder="Year" 
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background w-32"
        />
        <select 
          value={periodTypeFilter} 
          onChange={(e) => setPeriodTypeFilter(e.target.value)} 
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        >
          <option value="">All Periods</option>
          <option value="MONTHLY">Monthly</option>
          <option value="QUARTERLY">Quarterly</option>
          <option value="YEARLY">Yearly</option>
        </select>
      </div>

      <TableView 
        columns={columns} 
        data={tableData} 
        loading={isLoading} 
        actions={(row) => (
          <div className="flex gap-1">
            {permissions.update && (
              <button 
                onClick={() => { 
                  const budget = budgets?.find(b => b.id === row.id);
                  setEditingBudget(budget); 
                  setModalOpen(true); 
                }} 
                className="p-1.5 hover:bg-muted rounded-md"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {permissions.delete && (
              <button 
                onClick={() => handleDelete(row)} 
                className="p-1.5 hover:bg-destructive/10 text-destructive rounded-md"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )} 
      />
      
      <BudgetFormModal 
        open={modalOpen} 
        onClose={() => { setModalOpen(false); setEditingBudget(null); }} 
        initialData={editingBudget} 
      />
      <ConfirmModal />
    </div>
  );
}