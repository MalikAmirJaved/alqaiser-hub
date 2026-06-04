"use client";

import { useState } from "react";
import { PageHeader, Card, ToolbarButton } from "@/components/finance/ui";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useTrialBalance } from "@/hooks/finance/useTrialBalance";
import { useProfitLoss } from "@/hooks/finance/useProfitLoss";
import { useBalanceSheet } from "@/hooks/finance/useBalanceSheet";
import { useJournalEntries } from "@/hooks/finance/useJournalEntries";
import { useExpenses } from "@/hooks/finance/useExpenses";
import { useBudgetVariance } from "@/hooks/finance/useBudgets";
import { useARAging, useAPAging } from "@/hooks/finance/useAgingReports";
import { useExpenseReport } from "@/hooks/finance/useExpenseReport";
import { formatCurrency } from "@/lib/currency";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import {
  Download, Printer, Calendar, FileText, BarChart3, PieChart, Scale,
  Banknote, Receipt, Building2, Percent, TrendingUp, TrendingDown
} from "lucide-react";

// Helper to convert API amounts (string or number) to number
const toNumber = (val: any): number => {
  if (val === undefined || val === null) return 0;
  return typeof val === "string" ? parseFloat(val) : val;
};

// --------------------------------------------------------------
// Report Components (same as before)
// --------------------------------------------------------------

function TrialBalanceReport({ asOfDate }: { asOfDate: string }) {
  const { data, isLoading } = useTrialBalance(asOfDate);
  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!data?.data.length) return <div className="p-8 text-center text-muted-foreground">No data</div>;

  return (
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
          {data.data.map((acc) => (
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
        <tfoot className="border-t border-border bg-muted/20">
          <tr>
            <td className="px-4 py-2 font-semibold">Totals</td>
            <td className="px-4 py-2 text-right font-semibold text-success">{formatCurrency(toNumber(data.summary.total_debits))}</td>
            <td className="px-4 py-2 text-right font-semibold text-destructive">{formatCurrency(toNumber(data.summary.total_credits))}</td>
            <td className="px-4 py-2 text-right"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ProfitLossReport({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data, isLoading } = useProfitLoss(startDate, endDate);
  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">No data</div>;

  const rows = [
    { label: "Income", type: "section", children: data.income.accounts.map(a => ({ label: a.name, amount: a.amount, indent: true })) },
    { label: "Total Income", amount: data.income.total, isBold: true },
    { label: "Expenses", type: "section", children: data.expenses.accounts.map(a => ({ label: a.name, amount: a.amount, indent: true })) },
    { label: "Total Expenses", amount: data.expenses.total, isBold: true },
    { label: "Net Profit / Loss", amount: data.net_profit, isBold: true, isNet: true },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
          <tr><th className="px-4 py-2 text-left">Account</th><th className="px-4 py-2 text-right">Amount</th></tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            if (row.type === 'section') {
              return (
                <tr key={idx} className="border-b border-border/60 bg-muted/10">
                  <td colSpan={2} className="px-4 py-2 font-semibold">{row.label}</td>
                </tr>
              );
            }
            if (row.children) {
              return row.children.map((child, ci) => (
                <tr key={`${idx}-${ci}`} className="border-b border-border/60">
                  <td className="px-4 py-2 pl-8 text-muted-foreground">{child.label}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(child.amount)}</td>
                </tr>
              ));
            }
            const netClass = row.isNet ? (data.net_profit >= 0 ? "text-success" : "text-destructive") : "";
            return (
              <tr key={idx} className={`border-b border-border/60 ${row.isBold ? "font-semibold" : ""}`}>
                <td className="px-4 py-2">{row.label}</td>
                <td className={`px-4 py-2 text-right ${netClass}`}>{formatCurrency(row.amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BalanceSheetReport({ asOfDate }: { asOfDate: string }) {
  const { data, isLoading } = useBalanceSheet(asOfDate);
  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">No data</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h3 className="font-semibold text-success mb-2">Assets</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border">
            <tbody>
              {data.assets.accounts.map(acc => (
                <tr key={acc.code} className="border-b border-border/60">
                  <td className="px-4 py-2">{acc.name} ({acc.code})</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(acc.balance)}</td>
                </tr>
              ))}
              <tr className="border-t border-border font-semibold">
                <td className="px-4 py-2">Total Assets</td>
                <td className="px-4 py-2 text-right text-success">{formatCurrency(data.assets.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold text-destructive mb-2">Liabilities</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border">
              <tbody>
                {data.liabilities.accounts.map(acc => (
                  <tr key={acc.code} className="border-b border-border/60">
                    <td className="px-4 py-2">{acc.name} ({acc.code})</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(acc.balance)}</td>
                  </tr>
                ))}
                <tr className="border-t border-border font-semibold">
                  <td className="px-4 py-2">Total Liabilities</td>
                  <td className="px-4 py-2 text-right text-destructive">{formatCurrency(data.liabilities.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Equity</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border">
              <tbody>
                {data.equity.accounts.map(acc => (
                  <tr key={acc.code} className="border-b border-border/60">
                    <td className="px-4 py-2">{acc.name} ({acc.code})</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(acc.balance)}</td>
                  </tr>
                ))}
                <tr className="border-t border-border font-semibold">
                  <td className="px-4 py-2">Total Equity</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(data.equity.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {!data.is_balanced && (
          <div className="p-3 rounded-lg text-center text-sm bg-destructive/10 text-destructive">
            ✗ Balance sheet is NOT balanced.
          </div>
        )}
      </div>
    </div>
  );
}

function CashFlowReport() {
  return <div className="p-8 text-center text-muted-foreground">Cash Flow Statement coming soon.</div>;
}

function GeneralLedgerReport() {
  const { data, isLoading } = useJournalEntries({ ordering: "-date" });
  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!data?.length) return <div className="p-8 text-center text-muted-foreground">No entries</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Entry #</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2">Account</th>
            <th className="px-4 py-2 text-right">Debit</th>
            <th className="px-4 py-2 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) =>
            entry.lines.map((line, idx) => (
              <tr key={`${entry.id}-${idx}`} className="border-b border-border/60">
                {idx === 0 && <td className="px-4 py-2" rowSpan={entry.lines.length}>{entry.date}</td>}
                {idx === 0 && <td className="px-4 py-2 font-mono" rowSpan={entry.lines.length}>{entry.entry_number}</td>}
                {idx === 0 && <td className="px-4 py-2" rowSpan={entry.lines.length}>{entry.description}</td>}
                <td className="px-4 py-2">{line.account?.code} – {line.account?.name}</td>
                <td className="px-4 py-2 text-right text-success">{line.debit ? formatCurrency(line.debit) : "—"}</td>
                <td className="px-4 py-2 text-right text-destructive">{line.credit ? formatCurrency(line.credit) : "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ARAgingReport() {
  const { data, isLoading } = useARAging();
  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">No data</div>;

  return (
    <div>
      <div className="grid grid-cols-5 gap-3 mb-4">
        {Object.entries(data.aging).map(([key, value]) => {
          const label = key === '1_30' ? '1-30 days' : key === '31_60' ? '31-60 days' : key === '61_90' ? '61-90 days' : key === '90_plus' ? '90+ days' : key;
          return (
            <div key={key} className="p-2 bg-muted/20 rounded text-center">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-lg font-semibold">{formatCurrency(value)}</div>
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
            <tr><th>Invoice #</th><th>Customer</th><th>Due Date</th><th className="text-right">Outstanding</th><th>Bucket</th></tr>
          </thead>
          <tbody>
            {data.details.map((inv) => (
              <tr key={inv.invoice_number} className="border-b border-border/60">
                <td className="px-4 py-2 font-mono">{inv.invoice_number}</td>
                <td className="px-4 py-2">{inv.customer}</td>
                <td className="px-4 py-2">{inv.due_date}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(inv.outstanding)}</td>
                <td className="px-4 py-2">{inv.bucket}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function APAgingReport() {
  const { data, isLoading } = useAPAging();
  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">No data</div>;

  return (
    <div>
      <div className="grid grid-cols-5 gap-3 mb-4">
        {Object.entries(data.aging).map(([key, value]) => {
          const label = key === '1_30' ? '1-30 days' : key === '31_60' ? '31-60 days' : key === '61_90' ? '61-90 days' : key === '90_plus' ? '90+ days' : key;
          return (
            <div key={key} className="p-2 bg-muted/20 rounded text-center">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-lg font-semibold">{formatCurrency(value)}</div>
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
            <tr><th>Bill #</th><th>Supplier</th><th>Due Date</th><th className="text-right">Outstanding</th><th>Bucket</th></tr>
          </thead>
          <tbody>
            {data.details.map((bill) => (
              <tr key={bill.bill_number} className="border-b border-border/60">
                <td className="px-4 py-2 font-mono">{bill.bill_number}</td>
                <td className="px-4 py-2">{bill.supplier}</td>
                <td className="px-4 py-2">{bill.due_date}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(bill.outstanding)}</td>
                <td className="px-4 py-2">{bill.bucket}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaxReport() {
  return <div className="p-8 text-center text-muted-foreground">Tax Reports coming soon.</div>;
}

function ExpenseReportComponent({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data: byCategory, isLoading } = useExpenseReport(startDate, endDate);
  const { data: expenses, isLoading: isLoadingExpenses } = useExpenses({ start_date: startDate, end_date: endDate });
  if (isLoading || isLoadingExpenses) return <div className="p-8 text-center">Loading...</div>;
  if (!byCategory?.length) return <div className="p-8 text-center text-muted-foreground">No expenses</div>;

  const total = expenses?.reduce((s, e) => s + e.amount, 0) || 0;

  return (
    <div>
      <div className="mb-4 p-3 rounded-lg bg-muted/20 flex justify-between items-center">
        <div><div className="text-sm text-muted-foreground">Total Expenses</div><div className="text-2xl font-semibold">{formatCurrency(total)}</div></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
            <tr><th>Category</th><th className="text-right">Amount</th><th className="text-right">% of Total</th></tr>
          </thead>
          <tbody>
            {byCategory.map((cat) => (
              <tr key={cat.category} className="border-b border-border/60">
                <td className="px-4 py-2">{cat.category}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(cat.total)}</td>
                <td className="px-4 py-2 text-right">{((cat.total / total) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BudgetReportComponent() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading } = useBudgetVariance(year, 'MONTHLY');
  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!data?.length) return <div className="p-8 text-center text-muted-foreground">No budgets for {year}</div>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="px-3 py-1.5 text-sm border border-border rounded-md bg-background w-32" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
            <tr>
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2 text-right">Budget</th>
              <th className="px-4 py-2 text-right">Actual</th>
              <th className="px-4 py-2 text-right">Variance</th>
              <th className="px-4 py-2 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item: any) => (
              <tr key={`${item.account_id}-${item.period}`} className="border-b border-border/60">
                <td className="px-4 py-2">{item.account_name} ({item.account_code})</td>
                <td className="px-4 py-2">{item.period}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(item.budget_amount)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(item.actual_amount)}</td>
                <td className={`px-4 py-2 text-right ${item.variance >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(item.variance)}</td>
                <td className={`px-4 py-2 text-right ${item.variance_percent >= 0 ? "text-success" : "text-destructive"}`}>{item.variance_percent.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// Main Page (FIXED: outer container now manages overflow correctly)
// --------------------------------------------------------------

const reportsList = [
  { id: "profit_loss", name: "Profit & Loss", icon: BarChart3, component: ({ startDate, endDate }: any) => <ProfitLossReport startDate={startDate} endDate={endDate} />, hasDateRange: true },
  { id: "balance_sheet", name: "Balance Sheet", icon: PieChart, component: ({ asOfDate }: any) => <BalanceSheetReport asOfDate={asOfDate} />, hasAsOfDate: true },
  { id: "trial_balance", name: "Trial Balance", icon: Scale, component: ({ asOfDate }: any) => <TrialBalanceReport asOfDate={asOfDate} />, hasAsOfDate: true },
  { id: "cash_flow", name: "Cash Flow Statement", icon: Banknote, component: () => <CashFlowReport /> },
  { id: "general_ledger", name: "General Ledger Report", icon: FileText, component: () => <GeneralLedgerReport /> },
  { id: "ar_aging", name: "AR Aging", icon: Receipt, component: () => <ARAgingReport /> },
  { id: "ap_aging", name: "AP Aging", icon: Building2, component: () => <APAgingReport /> },
  { id: "tax", name: "Tax Reports", icon: Percent, component: () => <TaxReport /> },
  { id: "expense", name: "Expense Reports", icon: TrendingDown, component: ({ startDate, endDate }: any) => <ExpenseReportComponent startDate={startDate} endDate={endDate} />, hasDateRange: true },
  { id: "budget", name: "Budget Reports", icon: TrendingUp, component: () => <BudgetReportComponent /> },
];

export default function FinancialReportsPage() {
  const permissions = useFeaturePermissions("FINANCE", "report");
  const { settings } = useCompanySettings();
  const [activeReport, setActiveReport] = useState("profit_loss");
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);

  const report = reportsList.find(r => r.id === activeReport);
  if (!report) return null;

  const renderContent = () => {
    if (report.hasDateRange) return <report.component startDate={startDate} endDate={endDate} />;
    if (report.hasAsOfDate) return <report.component asOfDate={asOfDate} />;
    return <report.component />;
  };

  return (
    // The outer div takes full height of the main (which has overflow-auto from layout)
    // We set this div to also be flex column with overflow-hidden to prevent double scroll.
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        breadcrumbs={["Insights", "Financial Reports"]}
        title="Financial Reports"
        description="Generate and export financial statements."
        actions={
          <>
            <ToolbarButton variant="ghost" icon={Calendar}>Schedule</ToolbarButton>
            <ToolbarButton variant="ghost" icon={Printer}>Print</ToolbarButton>
            <ToolbarButton variant="primary" icon={Download}>Export PDF</ToolbarButton>
          </>
        }
      />
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-4 overflow-hidden min-h-0 pt-6">
        {/* Left sidebar - Report Library */}
        <Card className="xl:col-span-1 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex-shrink-0">
            <h3 className="text-base font-semibold">Report Library</h3>
            <p className="text-xs text-muted-foreground">Standard reports</p>
          </div>
          <div className="divide-y divide-border flex-1 overflow-y-auto">
            {reportsList.map((r) => {
              const Icon = r.icon;
              const isActive = activeReport === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setActiveReport(r.id)}
                  className={`w-full text-left flex items-start gap-3 px-5 py-3 hover:bg-surface-2/50 ${isActive ? "bg-surface-2/60" : ""}`}
                >
                  <div className={`h-9 w-9 rounded-md flex items-center justify-center ${isActive ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>{r.name}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Right content - Scrollable report area */}
        <Card className="xl:col-span-2 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex-shrink-0">
            <h3 className="text-base font-semibold">{report.name}</h3>
            <p className="text-xs text-muted-foreground">{settings?.companyName || "Company"} · {new Date().getFullYear()}</p>
          </div>
          <div className="flex justify-between items-center px-5 py-2 border-b border-border flex-shrink-0">
            {report.hasDateRange && (
              <div className="flex gap-2">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-md bg-background" />
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-md bg-background" />
              </div>
            )}
            {report.hasAsOfDate && (
              <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-md bg-background" />
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {renderContent()}
          </div>
        </Card>
      </div>
    </div>
  );
}