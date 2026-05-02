"use client";

// ============================================
// FILE: src/components/Finance/TaxReport.jsx (NEW)
// Tax Reporting Component
// ============================================

import { useState, useEffect } from "react";
import { TaxEngine } from "../../services/taxEngine";
import { Download, TrendingUp, TrendingDown, Calculator } from "lucide-react";

export default function TaxReport() {
  const [taxEngine] = useState(new TaxEngine());
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState({ startDate: "", endDate: "" });
  const [netPayable, setNetPayable] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReport();
  }, [period]);

  const loadReport = () => {
    setLoading(true);
    
    const summaryData = taxEngine.getTaxSummary({
      startDate: period.startDate || undefined,
      endDate: period.endDate || undefined,
    });
    
    const netData = taxEngine.getNetTaxPayable({
      startDate: period.startDate || undefined,
      endDate: period.endDate || undefined,
    });
    
    setSummary(summaryData);
    setNetPayable(netData);
    setLoading(false);
  };

  const exportReport = () => {
    if (!summary) return;
    
    const reportData = {
      period: period,
      summary: summary,
      net_payable: netPayable,
      generated_at: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax_report_${period.startDate || "all"}_${period.endDate || "all"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTAXReport = () => {
    // Format for TAX (Federal Board of Revenue) Pakistan
    if (!summary) return;
    
    const taxFormat = {
      report_type: "SALES_TAX_WORKSHEET",
      period: period,
      output_tax: netPayable?.output_tax || 0,
      input_tax: netPayable?.input_tax || 0,
      net_payable: netPayable?.net_payable || 0,
      tax_period: new Date().toISOString().slice(0, 7),
      filer_status: "FILER",
    };
    
    const blob = new Blob([JSON.stringify(taxFormat, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax_sales_tax_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Start Date</span>
            <input
              type="date"
              value={period.startDate}
              onChange={(e) => setPeriod({ ...period, startDate: e.target.value })}
              className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">End Date</span>
            <input
              type="date"
              value={period.endDate}
              onChange={(e) => setPeriod({ ...period, endDate: e.target.value })}
              className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              onClick={loadReport}
              className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Total Tax Collected</div>
            <Calculator className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-semibold mt-1">
            PKR {(summary?.total_tax || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {summary?.transaction_count || 0} transactions
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Output Tax (Sales)</div>
            <TrendingUp className="w-4 h-4 text-success" />
          </div>
          <div className="text-xl font-semibold mt-1">
            PKR {(netPayable?.output_tax || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {netPayable?.output_count || 0} invoices
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Input Tax (Purchases)</div>
            <TrendingDown className="w-4 h-4 text-warning" />
          </div>
          <div className="text-xl font-semibold mt-1">
            PKR {(netPayable?.input_tax || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {netPayable?.input_count || 0} purchases
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Net Tax Payable</div>
            <Calculator className="w-4 h-4 text-destructive" />
          </div>
          <div className="text-xl font-semibold mt-1">
            PKR {(netPayable?.net_payable || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Due to TAX
          </div>
        </div>
      </div>

      {/* Tax by Module */}
      {summary?.by_module && Object.keys(summary.by_module).length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3">Tax by Module</h3>
          <div className="space-y-2">
            {Object.entries(summary.by_module).map(([module, amount]) => (
              <div key={module} className="flex justify-between items-center py-2 border-b border-border">
                <span className="capitalize text-sm">{module}</span>
                <span className="font-semibold">PKR {amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tax by Type */}
      {summary?.by_tax_type && Object.keys(summary.by_tax_type).length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3">Tax by Type</h3>
          <div className="space-y-2">
            {Object.entries(summary.by_tax_type).map(([taxName, amount]) => (
              <div key={taxName} className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm">{taxName}</span>
                <span className="font-semibold">PKR {amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={exportReport}
          className="inline-flex items-center gap-2 px-4 h-9 rounded-md border border-border text-sm hover:bg-muted"
        >
          <Download className="w-4 h-4" />
          Export Report
        </button>
        <button
          onClick={downloadTAXReport}
          className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
        >
          <Download className="w-4 h-4" />
          Download TAX Report
        </button>
      </div>
    </div>
  );
}