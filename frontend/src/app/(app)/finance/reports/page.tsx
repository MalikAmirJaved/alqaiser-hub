"use client";

import { useState } from "react";
import { PageHeader, Card, CardHeader, ToolbarButton } from "@/components/finance/ui";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useTrialBalance } from "@/hooks/finance/useTrialBalance";
import { useProfitLoss } from "@/hooks/finance/useProfitLoss";
import { useBalanceSheet } from "@/hooks/finance/useBalanceSheet";
import { formatCurrency } from "@/lib/currency";
import { Download, Printer, Calendar, FileText, BarChart3, PieChart, Scale, Building2, Receipt, Percent, Clock } from "lucide-react";
import { useCompanySettings } from "@/hooks/useCompanySettings";

// Report list configuration
const reports = [
  { id: "trial_balance", name: "Trial Balance", icon: Scale, desc: "All accounts with debit/credit totals" },
  { id: "profit_loss", name: "Profit & Loss", icon: BarChart3, desc: "Income statement by period" },
  { id: "balance_sheet", name: "Balance Sheet", icon: PieChart, desc: "Assets, liabilities and equity snapshot" },
];

// Helper to convert API amounts (string or number) to number
const toNumber = (val: any): number => {
  if (val === undefined || val === null) return 0;
  return typeof val === "string" ? parseFloat(val) : val;
};

// Trial Balance Component
function TrialBalanceReport({ asOfDate }: { asOfDate: string }) {
  const { data, isLoading } = useTrialBalance(asOfDate);
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!data?.data.length) return <div className="p-8 text-center text-muted-foreground">No data for selected date</div>;

  const accounts = data.data;
  const summary = data.summary;

  return (
    <div>
      <div className="mb-4 p-3 rounded-lg bg-muted/20 flex justify-between items-center">
        <div>
          <div className="text-sm text-muted-foreground">Total Debits</div>
          <div className="text-xl font-semibold text-success">{formatCurrency(toNumber(summary?.total_debits))}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Total Credits</div>
          <div className="text-xl font-semibold text-destructive">{formatCurrency(toNumber(summary?.total_credits))}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Status</div>
          <div className={`text-sm font-semibold ${summary?.is_balanced ? "text-success" : "text-destructive"}`}>
            {summary?.is_balanced ? "Balanced ✓" : "Not Balanced ✗"}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
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
                  <div className="font-mono text-xs text-primary mr-2">{acc.code}</div>
                  <div>{acc.name}</div>
                </td>
                <td className="px-4 py-2 text-right">{formatCurrency(toNumber(acc.debit))}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(toNumber(acc.credit))}</td>
                <td className="px-4 py-2 text-right font-medium">{formatCurrency(toNumber(acc.balance))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Profit & Loss Component
function ProfitLossReport({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data, isLoading } = useProfitLoss(startDate, endDate);
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">No data for selected period</div>;

  return (
    <div>
      <div className="mb-4 p-3 rounded-lg bg-muted/20">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-muted-foreground">Net Profit / Loss</div>
            <div className={`text-2xl font-bold ${data.is_profit ? "text-success" : "text-destructive"}`}>
              {formatCurrency(Math.abs(data.net_profit))}
            </div>
            <div className="text-xs text-muted-foreground">{data.is_profit ? "Profit" : "Loss"}</div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Income section */}
        <div>
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
                <td className="pt-2 text-right font-semibold text-success">{formatCurrency(data.income.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Expenses section */}
        <div>
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
                <td className="pt-2 text-right font-semibold text-destructive">{formatCurrency(data.expenses.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Balance Sheet Component
function BalanceSheetReport({ asOfDate }: { asOfDate: string }) {
  const { data, isLoading } = useBalanceSheet(asOfDate);
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">No data for selected date</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Assets */}
      <div className="rounded-lg border border-border">
        <div className="bg-muted/30 px-4 py-2 border-b border-border">
          <h3 className="font-semibold text-success">Assets</h3>
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
                <td className="pt-2 text-right font-semibold text-success">{formatCurrency(data.assets.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Liabilities + Equity */}
      <div className="space-y-6">
        <div className="rounded-lg border border-border">
          <div className="bg-muted/30 px-4 py-2 border-b border-border">
            <h3 className="font-semibold text-destructive">Liabilities</h3>
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
                  <td className="pt-2 text-right font-semibold text-destructive">{formatCurrency(data.liabilities.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-lg border border-border">
          <div className="bg-muted/30 px-4 py-2 border-b border-border">
            <h3 className="font-semibold">Equity</h3>
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
                  <td className="pt-2 text-right font-semibold">{formatCurrency(data.equity.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {!data.is_balanced && (
        <div className="col-span-2 p-3 rounded-lg text-center text-sm bg-destructive/10 text-destructive">
          ✗ Balance sheet is NOT balanced. Check journal entries.
        </div>
      )}
    </div>
  );
}

export default function FinancialReportsPage() {
  const permissions = useFeaturePermissions("FINANCE", "report");
  const { settings } = useCompanySettings();
  const [activeReport, setActiveReport] = useState("trial_balance");

  // Date states
  const [trialBalanceDate, setTrialBalanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [profitLossStart, setProfitLossStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [profitLossEnd, setProfitLossEnd] = useState(new Date().toISOString().split("T")[0]);
  const [balanceSheetDate, setBalanceSheetDate] = useState(new Date().toISOString().split("T")[0]);

  const renderReport = () => {
    switch (activeReport) {
      case "trial_balance":
        return (
          <div>
            <div className="flex justify-end mb-4">
              <input
                type="date"
                value={trialBalanceDate}
                onChange={(e) => setTrialBalanceDate(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
              />
            </div>
            <TrialBalanceReport asOfDate={trialBalanceDate} />
          </div>
        );
      case "profit_loss":
        return (
          <div>
            <div className="flex gap-3 mb-4 justify-end">
              <input
                type="date"
                value={profitLossStart}
                onChange={(e) => setProfitLossStart(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
              />
              <input
                type="date"
                value={profitLossEnd}
                onChange={(e) => setProfitLossEnd(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
              />
            </div>
            <ProfitLossReport startDate={profitLossStart} endDate={profitLossEnd} />
          </div>
        );
      case "balance_sheet":
        return (
          <div>
            <div className="flex justify-end mb-4">
              <input
                type="date"
                value={balanceSheetDate}
                onChange={(e) => setBalanceSheetDate(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
              />
            </div>
            <BalanceSheetReport asOfDate={balanceSheetDate} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <PageHeader
        breadcrumbs={["Insights", "Financial Reports"]}
        title="Financial Reports"
        description="Generate, schedule, and export statutory and management financial reports."
        actions={
          <>
            <ToolbarButton variant="ghost" icon={Calendar}>Schedule</ToolbarButton>
            <ToolbarButton variant="ghost" icon={Printer}>Print</ToolbarButton>
            <ToolbarButton variant="primary" icon={Download}>Export PDF</ToolbarButton>
          </>
        }
      />
      <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left sidebar - Report Library */}
        <Card className="xl:col-span-1">
          <CardHeader title="Report Library" subtitle="Standard reports" />
          <div className="divide-y divide-border max-h-[640px] overflow-y-auto">
            {reports.map((report, idx) => {
              const Icon = report.icon;
              const isActive = activeReport === report.id;
              return (
                <button
                  key={report.id}
                  onClick={() => setActiveReport(report.id)}
                  className={`w-full text-left flex items-start gap-3 px-5 py-3 hover:bg-surface-2/50 ${isActive ? "bg-surface-2/60" : ""}`}
                >
                  <div className={`h-9 w-9 rounded-md flex items-center justify-center ${isActive ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>{report.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{report.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Main content - Selected report */}
        <Card className="xl:col-span-2">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-base font-semibold">{reports.find(r => r.id === activeReport)?.name}</h3>
            <p className="text-xs text-muted-foreground">{settings?.companyName || "Company"} · {new Date().getFullYear()}</p>
          </div>
          <div className="p-5">
            {renderReport()}
          </div>
        </Card>
      </div>
    </>
  );
}