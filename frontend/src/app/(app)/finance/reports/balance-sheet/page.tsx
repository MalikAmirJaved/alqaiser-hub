"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useBalanceSheet } from "@/hooks/finance/useBalanceSheet";
import { formatCurrency } from "@/lib/currency";

export default function BalanceSheetPage() {
  const permissions = useFeaturePermissions("FINANCE", "report");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const { data, isLoading, error, refetch } = useBalanceSheet(asOfDate);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Balance Sheet"
        subtitle="Assets = Liabilities + Equity"
        actions={
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 h-9 rounded-md border border-border text-sm hover:bg-muted"
          >
            Refresh
          </button>
        }
      />

      {/* Date picker */}
      <div className="flex flex-wrap gap-3 mb-6 items-end">
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

      {isLoading && <div className="text-center py-12 text-muted-foreground">Loading...</div>}
      {error && <div className="text-center py-12 text-destructive">Failed to load balance sheet</div>}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assets */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="bg-muted/30 px-4 py-3 border-b border-border">
              <h2 className="font-semibold text-success">Assets</h2>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <tbody>
                  {data.assets.accounts.map((acc) => (
                    <tr key={acc.code}>
                      <td className="py-1">{acc.name} ({acc.code})</td>
                      <td className="py-1 text-right">{formatCurrency(acc.balance)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border mt-1">
                    <td className="pt-2 font-semibold">Total Assets</td>
                    <td className="pt-2 text-right font-semibold text-success">
                      {formatCurrency(data.assets.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Liabilities + Equity */}
          <div className="space-y-6">
            {/* Liabilities */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="bg-muted/30 px-4 py-3 border-b border-border">
                <h2 className="font-semibold text-destructive">Liabilities</h2>
              </div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <tbody>
                    {data.liabilities.accounts.map((acc) => (
                      <tr key={acc.code}>
                        <td className="py-1">{acc.name} ({acc.code})</td>
                        <td className="py-1 text-right">{formatCurrency(acc.balance)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border mt-1">
                      <td className="pt-2 font-semibold">Total Liabilities</td>
                      <td className="pt-2 text-right font-semibold text-destructive">
                        {formatCurrency(data.liabilities.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Equity */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="bg-muted/30 px-4 py-3 border-b border-border">
                <h2 className="font-semibold">Equity</h2>
              </div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <tbody>
                    {data.equity.accounts.map((acc) => (
                      <tr key={acc.code}>
                        <td className="py-1">{acc.name} ({acc.code})</td>
                        <td className="py-1 text-right">{formatCurrency(acc.balance)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border mt-1">
                      <td className="pt-2 font-semibold">Total Equity</td>
                      <td className="pt-2 text-right font-semibold">
                        {formatCurrency(data.equity.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Check: Assets = Liabilities + Equity */}
            <div className={`p-3 rounded-lg text-center text-sm ${data.is_balanced ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
              {data.is_balanced 
                ? "✓ Balance sheet is balanced: Assets = Liabilities + Equity"
                : "✗ Balance sheet is NOT balanced. Check journal entries."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}