"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { DetailLayout, StandardSidebar, RelatedRecords } from "@/components/reuseable/final/DetailLayout";
import { useAccount } from "@/hooks/finance/useAccounts";
import { useJournalEntries } from "@/hooks/finance/useJournalEntries";
import { useTrialBalance } from "@/hooks/finance/useTrialBalance";
import { formatCurrency } from "@/lib/currency";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import AccountFormModal from "@/components/finance/accounts/AccountFormModal";

export default function AccountDetailPage() {
  const { id } = useParams();
  const { data: account, isLoading: accountLoading } = useAccount(id as string);
  const { data: trialBalance } = useTrialBalance();
  const { data: journalEntries, isLoading: entriesLoading } = useJournalEntries({
    ordering: "-date",
  });
  const permissions = useFeaturePermissions("FINANCE", "account");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  if (accountLoading || !account) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  const balanceEntry = trialBalance?.data.find((b) => b.account_id === Number(account.id));
  const balance = balanceEntry ? Number(balanceEntry.balance) : 0;

  // Calculate monthly trend for this account from real journal entries
  const monthlyData =
    journalEntries?.reduce((acc, entry) => {
      const month = entry.date.slice(0, 7);
      const line = entry.lines.find((l) => l.account.id === account.id);
      const amount = (line?.debit || 0) - (line?.credit || 0);
      if (!acc[month]) acc[month] = 0;
      acc[month] += amount;
      return acc;
    }, {} as Record<string, number>) || {};

  const chartData = Object.entries(monthlyData)
    .map(([month, amount]) => ({ month, amount: Math.abs(amount) }))
    .slice(-6);

  // Only show chart if there is real data
  const charts =
    chartData.length > 0
      ? [
          {
            id: "monthly-trend",
            title: "Monthly Activity",
            subtitle: "Last 6 months",
            type: "area" as const,
            data: chartData,
            dataKeys: { x: "month", y: "amount" },
            height: 260,
            tooltipFormatter: (value: number) => formatCurrency(value),
          },
        ]
      : [];

  const handleEdit = () => {
    setEditingAccount(account);
    setModalOpen(true);
  };

  // Get ledger entries for this account only
  const ledgerEntries =
    journalEntries?.filter((entry) => entry.lines.some((line) => line.account.id === account.id)).slice(0, 10) || [];

  return (
    <>
      <DetailLayout
        breadcrumbs={["General Ledger", "Chart of Accounts", account.code]}
        entityId={account.code}
        title={account.name}
        status={account.is_active ? "Active" : "Inactive"}
        subtitle={`${account.account_type} · USD · System account`}
        data={account}
        charts={charts}
        meta={[
          { label: "Type", value: account.account_type },
          { label: "Parent", value: account.parent || "-" },
          { label: "Currency", value: "USD" },
          { label: "Reconcilable", value: "Yes" },
        ]}
        summary={[
          {
            label: "Closing Balance",
            value: balance,
            tone: balance >= 0 ? "success" : "destructive",
            isCurrency: true,
          },
          { label: "MTD Movement", value: 0, sub: "vs. last month +0%", isCurrency: true },
          { label: "Open Items", value: "0", sub: "Pending reconciliation" },
          {
            label: "Last Posted",
            value: ledgerEntries[0]?.date || "—",
            sub: ledgerEntries[0]?.entry_number || "",
          },
        ]}
        primaryActionLabel="New Journal"
        onEdit={handleEdit}
        permissions={{ edit: permissions.update, submit: permissions.create }}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            render: () => (
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Code", account.code],
                  ["Description", account.description || "—"],
                  ["Created", new Date(account.created_at).toLocaleDateString()],
                  ["Modified", new Date(account.updated_at).toLocaleDateString()],
                  ["Parent", account.parent || "—"],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">{l}</span>
                    <span className="num font-medium">{v}</span>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: "ledger",
            label: "Ledger",
            count: ledgerEntries.length,
            render: () => (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b border-border">
                    <tr className="text-left">
                      <th className="py-2">Date</th>
                      <th>Reference</th>
                      <th>Description</th>
                      <th className="text-right">Debit</th>
                      <th className="text-right">Credit</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entriesLoading ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center">
                          Loading...
                        </td>
                      </tr>
                    ) : ledgerEntries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-muted-foreground">
                          No transactions
                        </td>
                      </tr>
                    ) : (
                      ledgerEntries.map((entry) => {
                        const line = entry.lines.find((l) => l.account.id === account.id);
                        const debit = line?.debit || 0;
                        const credit = line?.credit || 0;
                        return (
                          <tr key={entry.id} className="border-b border-border/60">
                            <td className="py-2 num text-muted-foreground">{entry.date}</td>
                            <td className="font-mono text-xs text-primary">{entry.entry_number}</td>
                            <td>{entry.description}</td>
                            <td className="text-right num text-success">
                              {debit ? formatCurrency(debit) : "—"}
                            </td>
                            <td className="text-right num text-destructive">
                              {credit ? formatCurrency(credit) : "—"}
                            </td>
                            <td className="text-right num font-medium">{formatCurrency(balance)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ),
          },
          {
            id: "related",
            label: "Related",
            count: 0,
            render: () => <RelatedRecords items={[]} />,
          },
          {
            id: "audit",
            label: "Audit Trail",
            render: () => <div className="text-sm text-muted-foreground">Audit trail coming soon</div>,
          },
        ]}
        sidebar={<StandardSidebar />}
        currencyFormatter={formatCurrency}
      />
      <AccountFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editingAccount}
        onSuccess={() => setModalOpen(false)}
      />
    </>
  );
}