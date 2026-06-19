"use client";

import { useState, useMemo } from "react";
import { PageHeader, Card, ToolbarButton } from "@/components/finance/ui";
import { useTrialBalance } from "@/hooks/finance/useTrialBalance";
import { useProfitLoss } from "@/hooks/finance/useProfitLoss";
import { useBalanceSheet } from "@/hooks/finance/useBalanceSheet";
import { useJournalEntries } from "@/hooks/finance/useJournalEntries";
import { useExpenses } from "@/hooks/finance/useExpenses";
import { useBudgetVariance } from "@/hooks/finance/useBudgets";
import { useARAging, useAPAging } from "@/hooks/finance/useAgingReports";
import { useExpenseReport } from "@/hooks/finance/useExpenseReport";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import {
  Download, Printer, Calendar, FileText, BarChart3, PieChart, Scale,
  Banknote, Receipt, Building2, Percent, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Clock, ArrowRight, CircleDot, Wallet,
  DollarSign, Users, Landmark, Briefcase, CreditCard
} from "lucide-react";

const toNumber = (val: any): number => {
  if (val === undefined || val === null) return 0;
  return typeof val === "string" ? parseFloat(val) : val;
};

function SectionCard({ title, subtitle, children, className = "" }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border bg-card ${className}`}>
      {(title || subtitle) && (
        <div className="px-5 py-3 border-b border-border">
          <h4 className="text-sm font-semibold">{title}</h4>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = "default", sub }: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "success" | "destructive" | "warning" | "info" | "default";
  sub?: string;
}) {
  const toneStyles: Record<string, string> = {
    success: "bg-success/10 text-success border-success/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    info: "bg-info/10 text-info border-info/20",
    default: "bg-muted/50 text-foreground border-border",
  };
  const iconBg: Record<string, string> = {
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/15 text-destructive",
    warning: "bg-warning/15 text-warning",
    info: "bg-info/15 text-info",
    default: "bg-muted text-muted-foreground",
  };
  return (
    <div className={`rounded-lg border p-4 ${toneStyles[tone]}`}>
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-md flex items-center justify-center ${iconBg[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold truncate">{value}</div>
          {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color = "bg-primary" }: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground">Loading report data...</span>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">This report is under development</p>
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// Profit & Loss Report
// --------------------------------------------------------------

function ProfitLossReport({ startDate, endDate }: { startDate: string; endDate: string }) {
  const formatCurrency = useFormatCurrency();
  const { data, isLoading } = useProfitLoss(startDate, endDate);

  if (isLoading) return <LoadingState />;
  if (!data) return <EmptyState message="No profit & loss data available" />;

  const totalIncome = toNumber(data.income.total);
  const totalExpenses = toNumber(data.expenses.total);
  const netProfit = toNumber(data.net_profit);
  const isProfit = data.is_profit;
  const incomeAccounts = data.income.accounts || [];
  const expenseAccounts = data.expenses.accounts || [];
  const largestExpense = expenseAccounts.length > 0
    ? expenseAccounts.reduce((max, a) => toNumber(a.amount) > toNumber(max.amount) ? a : max, expenseAccounts[0])
    : null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Revenue" value={formatCurrency(totalIncome)} icon={TrendingUp} tone="success" sub={`${incomeAccounts.length} income accounts`} />
        <StatCard label="Total Expenses" value={formatCurrency(totalExpenses)} icon={TrendingDown} tone="destructive" sub={`${expenseAccounts.length} expense accounts`} />
        <StatCard
          label="Net Profit / Loss"
          value={formatCurrency(Math.abs(netProfit))}
          icon={isProfit ? CheckCircle2 : AlertTriangle}
          tone={isProfit ? "success" : "destructive"}
          sub={isProfit ? "Profitable" : "Loss"}
        />
        <StatCard
          label="Profit Margin"
          value={totalIncome > 0 ? `${((netProfit / totalIncome) * 100).toFixed(1)}%` : "N/A"}
          icon={Percent}
          tone={isProfit ? "success" : "destructive"}
          sub={isProfit ? "Positive margin" : "Negative margin"}
        />
      </div>

      {/* Visual Bar */}
      <SectionCard title="Revenue vs Expenses" subtitle="Visual comparison">
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Revenue</span>
              <span className="font-medium text-success">{formatCurrency(totalIncome)}</span>
            </div>
            <ProgressBar value={totalIncome} max={Math.max(totalIncome, totalExpenses)} color="bg-success" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Expenses</span>
              <span className="font-medium text-destructive">{formatCurrency(totalExpenses)}</span>
            </div>
            <ProgressBar value={totalExpenses} max={Math.max(totalIncome, totalExpenses)} color="bg-destructive" />
          </div>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-muted/30 text-center">
          <span className="text-xs text-muted-foreground">Net Result: </span>
          <span className={`text-sm font-semibold ${isProfit ? "text-success" : "text-destructive"}`}>
            {isProfit ? "+" : "-"}{formatCurrency(Math.abs(netProfit))}
          </span>
        </div>
      </SectionCard>

      {/* Income Breakdown */}
      {incomeAccounts.length > 0 && (
        <SectionCard title="Income Breakdown" subtitle={`${incomeAccounts.length} accounts`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-2 text-left">Account</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-right">% of Revenue</th>
                  <th className="px-4 py-2 w-32">Share</th>
                </tr>
              </thead>
              <tbody>
                {incomeAccounts.map((acc) => {
                  const amt = toNumber(acc.amount);
                  const pct = totalIncome > 0 ? (amt / totalIncome) * 100 : 0;
                  return (
                    <tr key={acc.code} className="border-b border-border/60">
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{acc.code}</span>
                        <span>{acc.name}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-success">{formatCurrency(amt)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{pct.toFixed(1)}%</td>
                      <td className="px-4 py-2"><ProgressBar value={amt} max={totalIncome} color="bg-success" /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-border bg-success/5">
                <tr>
                  <td className="px-4 py-2 font-semibold">Total Revenue</td>
                  <td className="px-4 py-2 text-right font-semibold text-success">{formatCurrency(totalIncome)}</td>
                  <td className="px-4 py-2 text-right font-semibold">100%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Expense Breakdown */}
      {expenseAccounts.length > 0 && (
        <SectionCard title="Expense Breakdown" subtitle={`${expenseAccounts.length} accounts`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-2 text-left">Account</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-right">% of Expenses</th>
                  <th className="px-4 py-2 w-32">Share</th>
                </tr>
              </thead>
              <tbody>
                {expenseAccounts.map((acc) => {
                  const amt = toNumber(acc.amount);
                  const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;
                  return (
                    <tr key={acc.code} className="border-b border-border/60">
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{acc.code}</span>
                        <span>{acc.name}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-destructive">{formatCurrency(amt)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{pct.toFixed(1)}%</td>
                      <td className="px-4 py-2"><ProgressBar value={amt} max={totalExpenses} color="bg-destructive" /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-border bg-destructive/5">
                <tr>
                  <td className="px-4 py-2 font-semibold">Total Expenses</td>
                  <td className="px-4 py-2 text-right font-semibold text-destructive">{formatCurrency(totalExpenses)}</td>
                  <td className="px-4 py-2 text-right font-semibold">100%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Key Insights */}
      {(largestExpense || incomeAccounts.length > 0) && (
        <SectionCard title="Key Insights">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {largestExpense && (
              <div className="flex items-center gap-2 p-2 rounded bg-destructive/5">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <span>Largest expense: <strong>{largestExpense.name}</strong> ({formatCurrency(toNumber(largestExpense.amount))})</span>
              </div>
            )}
            {totalIncome > 0 && (
              <div className="flex items-center gap-2 p-2 rounded bg-success/5">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                <span>Revenue coverage: expenses are {((totalExpenses / totalIncome) * 100).toFixed(0)}% of revenue</span>
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// --------------------------------------------------------------
// Balance Sheet Report
// --------------------------------------------------------------

function BalanceSheetReport({ asOfDate }: { asOfDate: string }) {
  const formatCurrency = useFormatCurrency();
  const { data, isLoading } = useBalanceSheet(asOfDate);

  if (isLoading) return <LoadingState />;
  if (!data) return <EmptyState message="No balance sheet data available" />;

  const totalAssets = toNumber(data.assets.total);
  const totalLiabilities = toNumber(data.liabilities.total);
  const totalEquity = toNumber(data.equity.total);
  const netWorth = totalAssets - totalLiabilities;
  const debtToEquity = totalEquity > 0 ? (totalLiabilities / totalEquity).toFixed(2) : "N/A";

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Assets" value={formatCurrency(totalAssets)} icon={Landmark} tone="success" sub={`${data.assets.accounts.length} accounts`} />
        <StatCard label="Total Liabilities" value={formatCurrency(totalLiabilities)} icon={CreditCard} tone="destructive" sub={`${data.liabilities.accounts.length} accounts`} />
        <StatCard label="Total Equity" value={formatCurrency(totalEquity)} icon={Briefcase} tone="info" sub={`${data.equity.accounts.length} accounts`} />
        <StatCard label="Net Worth" value={formatCurrency(netWorth)} icon={Wallet} tone={netWorth >= 0 ? "success" : "destructive"} sub={`D/E: ${debtToEquity}`} />
      </div>

      {/* Balance Check */}
      {!data.is_balanced && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><strong>Warning:</strong> Balance sheet is NOT balanced. Assets do not equal Liabilities + Equity.</span>
        </div>
      )}
      {data.is_balanced && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/20 flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Balance sheet is balanced. Assets = Liabilities + Equity</span>
        </div>
      )}

      {/* Visual Composition */}
      <SectionCard title="Financial Composition" subtitle="Asset, Liability & Equity breakdown">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Assets</span>
              <span className="font-medium text-success">{formatCurrency(totalAssets)}</span>
            </div>
            <ProgressBar value={totalAssets} max={totalAssets} color="bg-success" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Liabilities</span>
              <span className="font-medium text-destructive">{formatCurrency(totalLiabilities)}</span>
            </div>
            <ProgressBar value={totalLiabilities} max={totalAssets} color="bg-destructive" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Equity</span>
              <span className="font-medium text-info">{formatCurrency(totalEquity)}</span>
            </div>
            <ProgressBar value={totalEquity} max={totalAssets} color="bg-info" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded bg-success/5">
            <div className="text-muted-foreground">Assets %</div>
            <div className="font-semibold text-success">100%</div>
          </div>
          <div className="p-2 rounded bg-destructive/5">
            <div className="text-muted-foreground">Liabilities %</div>
            <div className="font-semibold text-destructive">{totalAssets > 0 ? ((totalLiabilities / totalAssets) * 100).toFixed(1) : 0}%</div>
          </div>
          <div className="p-2 rounded bg-info/5">
            <div className="text-muted-foreground">Equity %</div>
            <div className="font-semibold text-info">{totalAssets > 0 ? ((totalEquity / totalAssets) * 100).toFixed(1) : 0}%</div>
          </div>
        </div>
      </SectionCard>

      {/* Assets Table */}
      {data.assets.accounts.length > 0 && (
        <SectionCard title="Assets" subtitle="What the company owns">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-2 text-left">Account</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                  <th className="px-4 py-2 text-right">% of Total</th>
                  <th className="px-4 py-2 w-32">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.assets.accounts.map((acc) => {
                  const bal = toNumber(acc.balance);
                  const pct = totalAssets > 0 ? (bal / totalAssets) * 100 : 0;
                  return (
                    <tr key={acc.code} className="border-b border-border/60">
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{acc.code}</span>
                        <span>{acc.name}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(bal)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{pct.toFixed(1)}%</td>
                      <td className="px-4 py-2"><ProgressBar value={bal} max={totalAssets} color="bg-success" /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-border bg-success/5">
                <tr>
                  <td className="px-4 py-2 font-semibold">Total Assets</td>
                  <td className="px-4 py-2 text-right font-semibold text-success">{formatCurrency(totalAssets)}</td>
                  <td className="px-4 py-2 text-right font-semibold">100%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Liabilities & Equity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.liabilities.accounts.length > 0 && (
          <SectionCard title="Liabilities" subtitle="What the company owes">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left">Account</th>
                    <th className="px-4 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.liabilities.accounts.map((acc) => (
                    <tr key={acc.code} className="border-b border-border/60">
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{acc.code}</span>
                        <span>{acc.name}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-destructive">{formatCurrency(toNumber(acc.balance))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-destructive/5">
                  <tr>
                    <td className="px-4 py-2 font-semibold">Total Liabilities</td>
                    <td className="px-4 py-2 text-right font-semibold text-destructive">{formatCurrency(totalLiabilities)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </SectionCard>
        )}

        {data.equity.accounts.length > 0 && (
          <SectionCard title="Equity" subtitle="Owner's claim on assets">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left">Account</th>
                    <th className="px-4 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.equity.accounts.map((acc) => (
                    <tr key={acc.code} className="border-b border-border/60">
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{acc.code}</span>
                        <span>{acc.name}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-info">{formatCurrency(toNumber(acc.balance))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-info/5">
                  <tr>
                    <td className="px-4 py-2 font-semibold">Total Equity</td>
                    <td className="px-4 py-2 text-right font-semibold text-info">{formatCurrency(totalEquity)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// Trial Balance Report
// --------------------------------------------------------------

function TrialBalanceReport({ asOfDate }: { asOfDate: string }) {
  const formatCurrency = useFormatCurrency();
  const { data, isLoading } = useTrialBalance(asOfDate);

  const accountsByType = useMemo(() => {
    if (!data?.data?.length) return {};
    const groups: Record<string, typeof data.data> = {};
    data.data.forEach((acc) => {
      const type = acc.account_type || "OTHER";
      if (!groups[type]) groups[type] = [];
      groups[type].push(acc);
    });
    return groups;
  }, [data]);

  if (isLoading) return <LoadingState />;
  if (!data?.data.length) return <EmptyState message="No trial balance data available" />;

  const totalDebits = toNumber(data.summary.total_debits);
  const totalCredits = toNumber(data.summary.total_credits);
  const isBalanced = data.summary.is_balanced;

  const typeLabels: Record<string, string> = {
    ASSET: "Assets",
    LIABILITY: "Liabilities",
    EQUITY: "Equity",
    REVENUE: "Revenue",
    EXPENSE: "Expenses",
    OTHER: "Other",
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Total Debits" value={formatCurrency(totalDebits)} icon={TrendingDown} tone="destructive" sub={`${data.data.length} accounts`} />
        <StatCard label="Total Credits" value={formatCurrency(totalCredits)} icon={TrendingUp} tone="success" />
        <StatCard label="Difference" value={formatCurrency(Math.abs(totalDebits - totalCredits))} icon={isBalanced ? CheckCircle2 : AlertTriangle} tone={isBalanced ? "success" : "destructive"} sub={isBalanced ? "Balanced" : "Not balanced"} />
      </div>

      {!isBalanced && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><strong>Warning:</strong> Debits ({formatCurrency(totalDebits)}) do not equal Credits ({formatCurrency(totalCredits)}). Difference: {formatCurrency(Math.abs(totalDebits - totalCredits))}</span>
        </div>
      )}

      {/* Accounts by Type */}
      {Object.entries(accountsByType).map(([type, accounts]) => (
        <SectionCard key={type} title={typeLabels[type] || type} subtitle={`${accounts.length} accounts`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-2 text-left">Account</th>
                  <th className="px-4 py-2 text-right">Debit</th>
                  <th className="px-4 py-2 text-right">Credit</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.account_id} className="border-b border-border/60">
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs text-primary mr-2">{acc.code}</span>
                      <span>{acc.name}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-destructive">{toNumber(acc.debit) > 0 ? formatCurrency(toNumber(acc.debit)) : "—"}</td>
                    <td className="px-4 py-2 text-right text-success">{toNumber(acc.credit) > 0 ? formatCurrency(toNumber(acc.credit)) : "—"}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(toNumber(acc.balance))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ))}

      {/* Totals */}
      <div className="p-4 rounded-lg border-2 border-border bg-muted/20">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Total Debits</div>
            <div className="text-lg font-semibold text-destructive">{formatCurrency(totalDebits)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Total Credits</div>
            <div className="text-lg font-semibold text-success">{formatCurrency(totalCredits)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Difference</div>
            <div className={`text-lg font-semibold ${isBalanced ? "text-success" : "text-destructive"}`}>
              {formatCurrency(Math.abs(totalDebits - totalCredits))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// General Ledger Report
// --------------------------------------------------------------

function GeneralLedgerReport() {
  const formatCurrency = useFormatCurrency();
  const { data, isLoading } = useJournalEntries({ ordering: "-date" });

  if (isLoading) return <LoadingState />;
  if (!data?.length) return <EmptyState message="No journal entries found" />;

  const totalDebits = data.reduce((sum, entry) => sum + entry.lines.reduce((s, l) => s + toNumber(l.debit), 0), 0);
  const totalCredits = data.reduce((sum, entry) => sum + entry.lines.reduce((s, l) => s + toNumber(l.credit), 0), 0);
  const postedCount = data.filter((e) => e.is_posted).length;
  const draftCount = data.length - postedCount;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Entries" value={String(data.length)} icon={FileText} tone="info" sub={`${postedCount} posted`} />
        <StatCard label="Total Debits" value={formatCurrency(totalDebits)} icon={TrendingDown} tone="destructive" />
        <StatCard label="Total Credits" value={formatCurrency(totalCredits)} icon={TrendingUp} tone="success" />
        <StatCard label="Draft Entries" value={String(draftCount)} icon={Clock} tone={draftCount > 0 ? "warning" : "success"} sub={draftCount > 0 ? "Unposted" : "All posted"} />
      </div>

      {/* Entries */}
      <div className="space-y-3">
        {data.map((entry) => {
          const entryDebits = entry.lines.reduce((s, l) => s + toNumber(l.debit), 0);
          const entryCredits = entry.lines.reduce((s, l) => s + toNumber(l.credit), 0);
          return (
            <div key={entry.id} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-primary font-medium">{entry.entry_number}</span>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                  {entry.is_posted ? (
                    <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium bg-success/15 text-success border-success/30">
                      <span className="h-1 w-1 rounded-full bg-current" /> Posted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium bg-warning/15 text-warning border-warning/30">
                      <span className="h-1 w-1 rounded-full bg-current" /> Draft
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{entry.description}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground bg-surface/20">
                    <tr>
                      <th className="px-4 py-1.5 text-left">Account</th>
                      <th className="px-4 py-1.5 text-right w-32">Debit</th>
                      <th className="px-4 py-1.5 text-right w-32">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.lines.map((line) => (
                      <tr key={line.id} className="border-t border-border/40">
                        <td className="px-4 py-1.5">
                          <span className="font-mono text-xs text-muted-foreground mr-1">{line.account?.code}</span>
                          <span>{line.account?.name}</span>
                        </td>
                        <td className="px-4 py-1.5 text-right text-destructive">{line.debit ? formatCurrency(toNumber(line.debit)) : "—"}</td>
                        <td className="px-4 py-1.5 text-right text-success">{line.credit ? formatCurrency(toNumber(line.credit)) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-border bg-surface/20">
                    <tr>
                      <td className="px-4 py-1.5 font-medium text-xs">Entry Total</td>
                      <td className="px-4 py-1.5 text-right font-medium text-xs text-destructive">{formatCurrency(entryDebits)}</td>
                      <td className="px-4 py-1.5 text-right font-medium text-xs text-success">{formatCurrency(entryCredits)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// AR Aging Report
// --------------------------------------------------------------

function ARAgingReport() {
  const formatCurrency = useFormatCurrency();
  const { data, isLoading } = useARAging();

  if (isLoading) return <LoadingState />;
  if (!data) return <EmptyState message="No accounts receivable aging data" />;

  const totalAR = Object.values(data.aging).reduce((sum, val) => sum + toNumber(val), 0);
  const bucketConfig = [
    { key: "current", label: "Current", color: "text-success", bg: "bg-success/10 border-success/20", desc: "Not yet due" },
    { key: "1_30", label: "1-30 Days", color: "text-warning", bg: "bg-warning/10 border-warning/20", desc: "Slightly overdue" },
    { key: "31_60", label: "31-60 Days", color: "text-warning", bg: "bg-warning/10 border-warning/20", desc: "Overdue" },
    { key: "61_90", label: "61-90 Days", color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", desc: "Seriously overdue" },
    { key: "90_plus", label: "90+ Days", color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", desc: "Critical" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <StatCard label="Total Receivables" value={formatCurrency(totalAR)} icon={Users} tone="info" sub={`${data.details.length} outstanding invoices`} />

      {/* Aging Buckets */}
      <SectionCard title="Aging Buckets" subtitle="Amount overdue by time period">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {bucketConfig.map((bucket) => {
            const val = toNumber(data.aging[bucket.key as keyof typeof data.aging]);
            const pct = totalAR > 0 ? ((val / totalAR) * 100).toFixed(0) : "0";
            return (
              <div key={bucket.key} className={`p-3 rounded-lg border text-center ${bucket.bg}`}>
                <div className="text-xs text-muted-foreground mb-1">{bucket.label}</div>
                <div className={`text-base font-semibold ${bucket.color}`}>{formatCurrency(val)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{pct}% · {bucket.desc}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <div className="flex gap-1 h-3 rounded-full overflow-hidden">
            {bucketConfig.map((bucket) => {
              const val = toNumber(data.aging[bucket.key as keyof typeof data.aging]);
              const pct = totalAR > 0 ? (val / totalAR) * 100 : 0;
              const barColors: Record<string, string> = {
                current: "bg-success",
                "1_30": "bg-warning/70",
                "31_60": "bg-warning",
                "61_90": "bg-destructive/70",
                "90_plus": "bg-destructive",
              };
              return pct > 0 ? <div key={bucket.key} className={`${barColors[bucket.key]}`} style={{ width: `${pct}%` }} /> : null;
            })}
          </div>
        </div>
      </SectionCard>

      {/* Outstanding Invoices */}
      {data.details.length > 0 && (
        <SectionCard title="Outstanding Invoices" subtitle="Individual invoices by aging bucket">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-2 text-left">Invoice #</th>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Due Date</th>
                  <th className="px-4 py-2 text-right">Outstanding</th>
                  <th className="px-4 py-2 text-center">Bucket</th>
                </tr>
              </thead>
              <tbody>
                {data.details.map((inv) => {
                  const bucketStyle: Record<string, string> = {
                    current: "bg-success/15 text-success border-success/30",
                    "1_30": "bg-warning/15 text-warning border-warning/30",
                    "31_60": "bg-warning/15 text-warning border-warning/30",
                    "61_90": "bg-destructive/15 text-destructive border-destructive/30",
                    "90_plus": "bg-destructive/15 text-destructive border-destructive/30",
                  };
                  return (
                    <tr key={inv.invoice_number} className="border-b border-border/60">
                      <td className="px-4 py-2 font-mono">{inv.invoice_number}</td>
                      <td className="px-4 py-2">{inv.customer}</td>
                      <td className="px-4 py-2 text-muted-foreground">{inv.due_date}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(toNumber(inv.outstanding))}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${bucketStyle[inv.bucket] || "bg-muted text-muted-foreground border-border"}`}>
                          {inv.bucket}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// --------------------------------------------------------------
// AP Aging Report
// --------------------------------------------------------------

function APAgingReport() {
  const formatCurrency = useFormatCurrency();
  const { data, isLoading } = useAPAging();

  if (isLoading) return <LoadingState />;
  if (!data) return <EmptyState message="No accounts payable aging data" />;

  const totalAP = Object.values(data.aging).reduce((sum, val) => sum + toNumber(val), 0);
  const bucketConfig = [
    { key: "current", label: "Current", color: "text-success", bg: "bg-success/10 border-success/20", desc: "Not yet due" },
    { key: "1_30", label: "1-30 Days", color: "text-warning", bg: "bg-warning/10 border-warning/20", desc: "Slightly overdue" },
    { key: "31_60", label: "31-60 Days", color: "text-warning", bg: "bg-warning/10 border-warning/20", desc: "Overdue" },
    { key: "61_90", label: "61-90 Days", color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", desc: "Seriously overdue" },
    { key: "90_plus", label: "90+ Days", color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", desc: "Critical" },
  ];

  return (
    <div className="space-y-6">
      <StatCard label="Total Payables" value={formatCurrency(totalAP)} icon={Building2} tone="warning" sub={`${data.details.length} outstanding bills`} />

      <SectionCard title="Aging Buckets" subtitle="Amount overdue by time period">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {bucketConfig.map((bucket) => {
            const val = toNumber(data.aging[bucket.key as keyof typeof data.aging]);
            const pct = totalAP > 0 ? ((val / totalAP) * 100).toFixed(0) : "0";
            return (
              <div key={bucket.key} className={`p-3 rounded-lg border text-center ${bucket.bg}`}>
                <div className="text-xs text-muted-foreground mb-1">{bucket.label}</div>
                <div className={`text-base font-semibold ${bucket.color}`}>{formatCurrency(val)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{pct}% · {bucket.desc}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <div className="flex gap-1 h-3 rounded-full overflow-hidden">
            {bucketConfig.map((bucket) => {
              const val = toNumber(data.aging[bucket.key as keyof typeof data.aging]);
              const pct = totalAP > 0 ? (val / totalAP) * 100 : 0;
              const barColors: Record<string, string> = {
                current: "bg-success",
                "1_30": "bg-warning/70",
                "31_60": "bg-warning",
                "61_90": "bg-destructive/70",
                "90_plus": "bg-destructive",
              };
              return pct > 0 ? <div key={bucket.key} className={`${barColors[bucket.key]}`} style={{ width: `${pct}%` }} /> : null;
            })}
          </div>
        </div>
      </SectionCard>

      {data.details.length > 0 && (
        <SectionCard title="Outstanding Bills" subtitle="Individual bills by aging bucket">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-2 text-left">Bill #</th>
                  <th className="px-4 py-2 text-left">Supplier</th>
                  <th className="px-4 py-2 text-left">Due Date</th>
                  <th className="px-4 py-2 text-right">Outstanding</th>
                  <th className="px-4 py-2 text-center">Bucket</th>
                </tr>
              </thead>
              <tbody>
                {data.details.map((bill) => {
                  const bucketStyle: Record<string, string> = {
                    current: "bg-success/15 text-success border-success/30",
                    "1_30": "bg-warning/15 text-warning border-warning/30",
                    "31_60": "bg-warning/15 text-warning border-warning/30",
                    "61_90": "bg-destructive/15 text-destructive border-destructive/30",
                    "90_plus": "bg-destructive/15 text-destructive border-destructive/30",
                  };
                  return (
                    <tr key={bill.bill_number} className="border-b border-border/60">
                      <td className="px-4 py-2 font-mono">{bill.bill_number}</td>
                      <td className="px-4 py-2">{bill.supplier}</td>
                      <td className="px-4 py-2 text-muted-foreground">{bill.due_date}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(toNumber(bill.outstanding))}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${bucketStyle[bill.bucket] || "bg-muted text-muted-foreground border-border"}`}>
                          {bill.bucket}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// --------------------------------------------------------------
// Expense Report
// --------------------------------------------------------------

function ExpenseReportComponent({ startDate, endDate }: { startDate: string; endDate: string }) {
  const formatCurrency = useFormatCurrency();
  const { data: byCategory, isLoading } = useExpenseReport(startDate, endDate);
  const { data: expenses, isLoading: isLoadingExpenses } = useExpenses({ start_date: startDate, end_date: endDate });

  if (isLoading || isLoadingExpenses) return <LoadingState />;
  if (!byCategory?.length) return <EmptyState message="No expenses found for this period" />;

  const total = expenses?.reduce((s, e) => s + e.amount, 0) || 0;
  const paidCount = expenses?.filter((e) => e.paid).length || 0;
  const unpaidCount = (expenses?.length || 0) - paidCount;
  const largestCategory = byCategory.reduce((max, cat) => cat.total > max.total ? cat : max, byCategory[0]);
  const categoryColors = ["bg-info", "bg-primary", "bg-success", "bg-warning", "bg-destructive", "bg-muted"];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Expenses" value={formatCurrency(total)} icon={DollarSign} tone="destructive" sub={`${expenses?.length || 0} transactions`} />
        <StatCard label="Largest Category" value={largestCategory.category} icon={BarChart3} tone="info" sub={formatCurrency(largestCategory.total)} />
        <StatCard label="Paid" value={String(paidCount)} icon={CheckCircle2} tone="success" sub={formatCurrency(expenses?.filter((e) => e.paid).reduce((s, e) => s + e.amount, 0) || 0)} />
        <StatCard label="Unpaid" value={String(unpaidCount)} icon={Clock} tone={unpaidCount > 0 ? "warning" : "success"} sub={formatCurrency(expenses?.filter((e) => !e.paid).reduce((s, e) => s + e.amount, 0) || 0)} />
      </div>

      {/* Category Breakdown */}
      <SectionCard title="Expenses by Category" subtitle={`${byCategory.length} categories`}>
        <div className="space-y-3">
          {byCategory.map((cat, idx) => {
            const pct = total > 0 ? (cat.total / total) * 100 : 0;
            return (
              <div key={cat.category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{cat.category}</span>
                  <span className="text-muted-foreground">{formatCurrency(cat.total)} ({pct.toFixed(1)}%)</span>
                </div>
                <ProgressBar value={cat.total} max={total} color={categoryColors[idx % categoryColors.length]} />
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Detailed Table */}
      <SectionCard title="Category Details" subtitle="Breakdown by category">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-right">% of Total</th>
                <th className="px-4 py-2 w-40">Share</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((cat) => {
                const pct = total > 0 ? (cat.total / total) * 100 : 0;
                return (
                  <tr key={cat.category} className="border-b border-border/60">
                    <td className="px-4 py-2 font-medium">{cat.category}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(cat.total)}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{pct.toFixed(1)}%</td>
                    <td className="px-4 py-2"><ProgressBar value={cat.total} max={total} color="bg-destructive" /></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-border bg-destructive/5">
              <tr>
                <td className="px-4 py-2 font-semibold">Total</td>
                <td className="px-4 py-2 text-right font-semibold">{formatCurrency(total)}</td>
                <td className="px-4 py-2 text-right font-semibold">100%</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// --------------------------------------------------------------
// Budget Report
// --------------------------------------------------------------

function BudgetReportComponent() {
  const formatCurrency = useFormatCurrency();
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading } = useBudgetVariance(year, "MONTHLY");

  const accountGroups = useMemo(() => {
    if (!data?.length) return {};
    const groups: Record<string, any[]> = {};
    data.forEach((item: any) => {
      const key = item.account_name || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [data]);

  if (isLoading) return <LoadingState />;
  if (!data?.length) return <EmptyState message={`No budgets found for ${year}`} />;

  const totalBudget = data.reduce((s: number, item: any) => s + toNumber(item.budget_amount), 0);
  const totalActual = data.reduce((s: number, item: any) => s + toNumber(item.actual_amount), 0);
  const totalVariance = totalActual - totalBudget;
  const overallPct = totalBudget > 0 ? ((totalActual / totalBudget) * 100).toFixed(1) : "0";
  const onTrack = totalVariance <= 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Budget" value={formatCurrency(totalBudget)} icon={Wallet} tone="info" sub={`${data.length} line items`} />
        <StatCard label="Total Actual" value={formatCurrency(totalActual)} icon={DollarSign} tone={onTrack ? "success" : "destructive"} sub={`${overallPct}% of budget`} />
        <StatCard label="Variance" value={formatCurrency(Math.abs(totalVariance))} icon={onTrack ? CheckCircle2 : AlertTriangle} tone={onTrack ? "success" : "destructive"} sub={onTrack ? "Under budget" : "Over budget"} />
        <StatCard label="Budget Utilization" value={`${overallPct}%`} icon={Percent} tone={onTrack ? "success" : "destructive"} sub={onTrack ? "On track" : "Exceeded"} />
      </div>

      {/* Visual */}
      <SectionCard title="Budget vs Actual" subtitle="Overall comparison">
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Budget</span>
              <span className="font-medium">{formatCurrency(totalBudget)}</span>
            </div>
            <ProgressBar value={totalBudget} max={Math.max(totalBudget, totalActual)} color="bg-info" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Actual</span>
              <span className="font-medium">{formatCurrency(totalActual)}</span>
            </div>
            <ProgressBar value={totalActual} max={Math.max(totalBudget, totalActual)} color={onTrack ? "bg-success" : "bg-destructive"} />
          </div>
        </div>
      </SectionCard>

      {/* Year Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Year:</span>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background w-28"
        />
      </div>

      {/* By Account */}
      {Object.entries(accountGroups).map(([accountName, items]) => {
        const acctBudget = items.reduce((s: number, i: any) => s + toNumber(i.budget_amount), 0);
        const acctActual = items.reduce((s: number, i: any) => s + toNumber(i.actual_amount), 0);
        const acctVariance = acctActual - acctBudget;
        const acctOnTrack = acctVariance <= 0;
        return (
          <SectionCard key={accountName} title={accountName} subtitle={`${items.length} periods`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left">Period</th>
                    <th className="px-4 py-2 text-right">Budget</th>
                    <th className="px-4 py-2 text-right">Actual</th>
                    <th className="px-4 py-2 text-right">Variance</th>
                    <th className="px-4 py-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, idx: number) => {
                    const variance = toNumber(item.actual_amount) - toNumber(item.budget_amount);
                    const variancePct = toNumber(item.variance_percent);
                    const isOver = variance > 0;
                    return (
                      <tr key={idx} className="border-b border-border/60">
                        <td className="px-4 py-2">{item.period}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(toNumber(item.budget_amount))}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatCurrency(toNumber(item.actual_amount))}</td>
                        <td className={`px-4 py-2 text-right font-medium ${isOver ? "text-destructive" : "text-success"}`}>
                          {isOver ? "+" : ""}{formatCurrency(variance)}
                        </td>
                        <td className={`px-4 py-2 text-right ${isOver ? "text-destructive" : "text-success"}`}>
                          {variancePct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/20">
                  <tr>
                    <td className="px-4 py-2 font-semibold">Total</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(acctBudget)}</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(acctActual)}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${acctOnTrack ? "text-success" : "text-destructive"}`}>
                      {acctOnTrack ? "" : "+"}{formatCurrency(acctVariance)}
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold ${acctOnTrack ? "text-success" : "text-destructive"}`}>
                      {acctBudget > 0 ? ((acctActual / acctBudget) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------
// Main Page
// --------------------------------------------------------------

const reportsList = [
  { id: "profit_loss", name: "Profit & Loss", icon: BarChart3, description: "Revenue, expenses & net profit", component: ({ startDate, endDate }: any) => <ProfitLossReport startDate={startDate} endDate={endDate} />, hasDateRange: true },
  { id: "balance_sheet", name: "Balance Sheet", icon: PieChart, description: "Assets, liabilities & equity", component: ({ asOfDate }: any) => <BalanceSheetReport asOfDate={asOfDate} />, hasAsOfDate: true },
  { id: "trial_balance", name: "Trial Balance", icon: Scale, description: "Debit & credit verification", component: ({ asOfDate }: any) => <TrialBalanceReport asOfDate={asOfDate} />, hasAsOfDate: true },
  { id: "general_ledger", name: "General Ledger", icon: FileText, description: "All journal entries & lines", component: () => <GeneralLedgerReport /> },
  { id: "ar_aging", name: "AR Aging", icon: Receipt, description: "Customer payment tracking", component: () => <ARAgingReport /> },
  { id: "ap_aging", name: "AP Aging", icon: Building2, description: "Supplier payment tracking", component: () => <APAgingReport /> },
  { id: "expense", name: "Expense Reports", icon: TrendingDown, description: "Category-wise expense analysis", component: ({ startDate, endDate }: any) => <ExpenseReportComponent startDate={startDate} endDate={endDate} />, hasDateRange: true },
  { id: "budget", name: "Budget Reports", icon: TrendingUp, description: "Budget vs actual variance", component: () => <BudgetReportComponent /> },
  { id: "cash_flow", name: "Cash Flow Statement", icon: Banknote, description: "Cash inflows & outflows", component: () => <ComingSoon title="Cash Flow Statement" /> },
  // { id: "tax", name: "Tax Reports", icon: Percent, description: "Tax liability & filing", component: () => <ComingSoon title="Tax Reports" /> },
];

export default function FinancialReportsPage() {
  const { settings } = useCompanySettings();
  const [activeReport, setActiveReport] = useState("profit_loss");
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);

  const report = reportsList.find((r) => r.id === activeReport);
  if (!report) return null;

  const renderContent = () => {
    if (report.hasDateRange) return <report.component startDate={startDate} endDate={endDate} />;
    if (report.hasAsOfDate) return <report.component asOfDate={asOfDate} />;
    return <report.component />;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={["Finance", "Reports"]}
        title="Financial Reports"
        description="Detailed financial statements and analysis"
        actions={
          <>
            <ToolbarButton variant="ghost" icon={Calendar}>Schedule</ToolbarButton>
            <ToolbarButton variant="ghost" icon={Printer}>Print</ToolbarButton>
            <ToolbarButton variant="ghost" icon={Download}>Export</ToolbarButton>
          </>
        }
      />
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-4 gap-4 overflow-hidden min-h-0 pt-6">
        {/* Sidebar - Report Library */}
        <Card className="xl:col-span-1 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex-shrink-0">
            <h3 className="text-base font-semibold">Report Library</h3>
            <p className="text-xs text-muted-foreground">{reportsList.length} reports available</p>
          </div>
          <div className="divide-y divide-border flex-1 overflow-y-auto">
            {reportsList.map((r) => {
              const Icon = r.icon;
              const isActive = activeReport === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setActiveReport(r.id)}
                  className={`w-full text-left flex items-start gap-3 px-5 py-3 hover:bg-surface-2/50 transition-colors ${isActive ? "bg-surface-2/60 border-l-2 border-primary" : "border-l-2 border-transparent"}`}
                >
                  <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${isActive ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>{r.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{r.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Content Area */}
        <Card className="xl:col-span-3 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">{report.name}</h3>
                <p className="text-xs text-muted-foreground">{settings?.companyName || "Company"} · {report.description}</p>
              </div>
              {report.hasDateRange && (
                <div className="flex gap-2">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-md bg-background" />
                  <span className="text-muted-foreground self-center text-xs">to</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-md bg-background" />
                </div>
              )}
              {report.hasAsOfDate && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">As of</span>
                  <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-md bg-background" />
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{renderContent()}</div>
        </Card>
      </div>
    </div>
  );
}
