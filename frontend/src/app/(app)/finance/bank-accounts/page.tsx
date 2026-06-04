"use client";

import { useState } from "react";
import { DynamicModulePage, type ModulePermissions, type Kpi } from "@/components/reuseable/final/DynamicModulePage";
import { useBankAccounts, useDeleteBankAccount } from "@/hooks/finance/useBank";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { formatCurrency } from "@/lib/currency";
import BankAccountFormModal from "@/components/finance/bank/BankAccountFormModal";

// Helper to safely convert to number
const toNumber = (value: number | string | undefined): number => {
  if (value === undefined || value === null) return 0;
  return typeof value === "string" ? parseFloat(value) : value;
};

export default function BankAccountsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const { data: accounts, isLoading } = useBankAccounts();
  const deleteAccount = useDeleteBankAccount();
  const permissions = useFeaturePermissions("FINANCE", "bankaccount");

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: true,
  };

  const computeKPIs = (data: any[]): Kpi[] => {
    const totalBalance = data.reduce((sum, acc) => sum + toNumber(acc.current_balance), 0);
    const activeCount = data.filter((a) => a.is_active).length;
    const uniqueCurrencies = new Set(data.map((a) => a.currency)).size;
    
    return [
      { label: "Total Balance", value: totalBalance, isCurrency: true, tone: "success" as const },
      { label: "Active Accounts", value: activeCount, isCurrency: false, tone: "info" as const },
      { label: "Currencies", value: uniqueCurrencies, isCurrency: false, tone: "info" as const },
      { label: "Total Accounts", value: data.length, isCurrency: false, tone: "info" as const },
    ];
  };

  const columns = [
    { key: "account_name", label: "Account Name", sortable: true },
    { key: "bank_name", label: "Bank", sortable: true },
    { key: "account_number", label: "Account Number" },
    { key: "currency", label: "Currency" },
    { key: "current_balance", label: "Balance", align: "right" as const, render: (val: number | string) => formatCurrency(toNumber(val)), sortable: true },
    { key: "is_active", label: "Status", render: (val: boolean) => (val ? "Active" : "Inactive") },
  ];

  const handleEdit = (account: any) => {
    setEditingAccount(account);
    setModalOpen(true);
  };

  const handleDelete = (account: any) => {
    deleteAccount.mutate(account.id);
  };

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Banking & Cash", "Bank Accounts"]}
        title="Bank Accounts"
        description="Manage company bank accounts"
        data={accounts || []}
        isLoading={isLoading}
        columns={columns}
        kpis={computeKPIs}
        getRowId={(a) => a.id}
        permissions={modulePermissions}
        primaryActionLabel="New Account"
        onCreate={() => {
          setEditingAccount(null);
          setModalOpen(true);
        }}
        actions={{
          onEdit: handleEdit,
          onDelete: handleDelete,
        }}
        exportEnabled
        onRowSelect={setSelectedIds}
        batchActions={
          selectedIds.length > 0 && (
            <button
              onClick={() => {
                selectedIds.forEach((id) => deleteAccount.mutate(id));
                setSelectedIds([]);
              }}
              className="text-sm text-destructive hover:text-destructive/80"
            >
              Delete Selected ({selectedIds.length})
            </button>
          )
        }
      />
      <BankAccountFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingAccount(null);
        }}
        initialData={editingAccount}
        onSuccess={() => {
          setModalOpen(false);
          setEditingAccount(null);
        }}
      />
    </>
  );
}