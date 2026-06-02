"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useProfitLoss } from "@/hooks/finance/useProfitLoss";
import { formatCurrency } from "@/lib/currency";

export default function ProfitLossPage() {
  const permissions = useFeaturePermissions("FINANCE", "report");
  
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(lastDayOfMonth.toISOString().split('T')[0]);
  
  const { data, isLoading, error, refetch } = useProfitLoss(startDate, endDate);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Profit & Loss Statement"
        subtitle="Income minus expenses for the selected period"
        actions={
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 h-9 rounded-md border border-border text-sm hover:bg-muted"
          >
            Refresh
          </button>
        }
      />

      {/* Date range picker */}
      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
          />
        </div>
      </div>

      {isLoading && <div className="text-center py-12 text-muted-foreground">Loading...</div>}
      {error && <div className="text-center py-12 text-destructive">Failed to load report</div>}

      {data && (
        <div className="max-w-3xl mx-auto">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Header */}
            <div className="bg-muted/30 px-6 py-3 border-b border-border text-center">
              <h2 className="text-lg font-semibold">Profit & Loss Statement</h2>
              <p className="text-sm text-muted-foreground">
                For period: {data.period.start_date} to {data.period.end_date}
              </p>
            </div>

            {/* Income section */}
            <div className="p-4">
              <h3 className="font-semibold text-success mb-2">Income (Revenue)</h3>
              <table className="w-full text-sm">
                <tbody>
                  {data.income.accounts.map((acc) => (
                    <tr key={acc.code}>
                      <td className="py-1">{acc.name} ({acc.code})</td>
                      <td className="py-1 text-right">{formatCurrency(acc.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border mt-1">
                    <td className="pt-2 font-semibold">Total Income</td>
                    <td className="pt-2 text-right font-semibold text-success">
                      {formatCurrency(data.income.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Expenses section */}
            <div className="p-4 pt-0">
              <h3 className="font-semibold text-destructive mb-2">Expenses</h3>
              <table className="w-full text-sm">
                <tbody>
                  {data.expenses.accounts.map((acc) => (
                    <tr key={acc.code}>
                      <td className="py-1">{acc.name} ({acc.code})</td>
                      <td className="py-1 text-right">{formatCurrency(acc.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border mt-1">
                    <td className="pt-2 font-semibold">Total Expenses</td>
                    <td className="pt-2 text-right font-semibold text-destructive">
                      {formatCurrency(data.expenses.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Net Profit/Loss */}
            <div className="p-4 bg-muted/20 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Net {data.is_profit ? 'Profit' : 'Loss'}</span>
                <span className={`text-xl font-bold ${data.is_profit ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(Math.abs(data.net_profit))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}