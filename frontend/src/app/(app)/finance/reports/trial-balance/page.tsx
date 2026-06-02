"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useTrialBalance, type TrialBalanceAccount } from "@/hooks/finance/useTrialBalance";
import { formatCurrency } from "@/lib/currency";

const accountTypeLabels: Record<string, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENSE: "Expense",
};

export default function TrialBalancePage() {
  const permissions = useFeaturePermissions("FINANCE", "report");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);
  const { data, isLoading, error } = useTrialBalance(asOfDate);
  
  const accounts = data?.data || [];
  const summary = data?.summary;

  // Group accounts by type
  const groupedAccounts = accounts.reduce((acc, account) => {
    const type = account.account_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(account);
    return acc;
  }, {} as Record<string, TrialBalanceAccount[]>);

  const accountTypeOrder = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Trial Balance"
        subtitle="Verify that total debits equal total credits"
      />

      {/* Date filter */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">As of Date</label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
          />
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      )}

      {error && (
        <div className="text-center py-12 text-destructive">Failed to load trial balance</div>
      )}

      {data && (
        <>
          {/* Summary card */}
          <div className="mb-6 p-4 rounded-xl border border-border bg-card">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Total Debits</div>
                <div className="text-2xl font-bold text-success">
                  {formatCurrency(Number(summary?.total_debits || 0))}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Credits</div>
                <div className="text-2xl font-bold text-destructive">
                  {formatCurrency(Number(summary?.total_credits || 0))}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {summary?.is_balanced ? "✓ Books are balanced" : "✗ Books are NOT balanced"}
                </span>
                {!summary?.is_balanced && (
                  <span className="text-xs text-destructive">
                    Difference: {formatCurrency(Math.abs(Number(summary?.total_debits || 0) - Number(summary?.total_credits || 0)))}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Accounts table by type */}
          <div className="space-y-6">
            {accountTypeOrder.map((type) => {
              const typeAccounts = groupedAccounts[type];
              if (!typeAccounts || typeAccounts.length === 0) return null;
              
              const typeTotalDebit = typeAccounts.reduce((sum, a) => sum + Number(a.debit), 0);
              const typeTotalCredit = typeAccounts.reduce((sum, a) => sum + Number(a.credit), 0);
              const typeBalance = typeAccounts.reduce((sum, a) => sum + Number(a.balance), 0);
              
              return (
                <div key={type} className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2 border-b border-border">
                    <h3 className="font-semibold">{accountTypeLabels[type] || type}</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-muted/20">
                      <tr>
                        <th className="px-4 py-2 text-left">Account Code</th>
                        <th className="px-4 py-2 text-left">Account Name</th>
                        <th className="px-4 py-2 text-right">Debit</th>
                        <th className="px-4 py-2 text-right">Credit</th>
                        <th className="px-4 py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {typeAccounts.map((account) => (
                        <tr key={account.account_id} className="hover:bg-muted/10">
                          <td className="px-4 py-2 font-mono text-xs">{account.code}</td>
                          <td className="px-4 py-2">{account.name}</td>
                          <td className="px-4 py-2 text-right text-success">
                            {Number(account.debit) > 0 ? formatCurrency(Number(account.debit)) : "—"}
                          </td>
                          <td className="px-4 py-2 text-right text-destructive">
                            {Number(account.credit) > 0 ? formatCurrency(Number(account.credit)) : "—"}
                          </td>
                          <td className="px-4 py-2 text-right font-medium">
                            {formatCurrency(Number(account.balance))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30 border-t border-border">
                      <tr>
                        <td colSpan={2} className="px-4 py-2 font-semibold">Total for {accountTypeLabels[type]}</td>
                        <td className="px-4 py-2 text-right font-semibold text-success">
                          {formatCurrency(typeTotalDebit)}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-destructive">
                          {formatCurrency(typeTotalCredit)}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {formatCurrency(typeBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}