// @ts-nocheck
"use client";

// ============================================
// FILE: src/routes/_app.hr.payroll.jsx (UPDATED - with Advanced Payroll)
// ============================================
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { schemas } from "@/config/schemas";
import { ls } from "@/services/localStorageService";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Play, FileText, Users } from "lucide-react";

// Dynamically import CrudPage to reduce initial JS bundle size and improve LCP
const CrudPage = dynamic(() => import("@/components/CrudPage"), { ssr: false });

export default PayrollPage;

function PayrollPage() {
  const [activeTab, setActiveTab] = useState("records");
  const [processing, setProcessing] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [processResult, setProcessResult] = useState(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = () => {
    const allEmployees = ls.get("employees", []);
    setEmployees(allEmployees.filter(e => e.employment_status === "ACTIVE"));
  };

  const processMonthlyPayroll = async () => {
    if (!confirm(`Process payroll for ${selectedMonth}/${selectedYear}? This will calculate salaries for all active employees.`)) {
      return;
    }

    setProcessing(true);

    try {
      // Dynamically load the engine only when needed
      const { PayrollEngine } = await import("@/services/payrollEngine");
      const payrollEngine = new PayrollEngine();

      const result = payrollEngine.processPayroll({
        month: selectedMonth,
        year: selectedYear,
        options: {
          includeBonuses: true,
          includeDeductions: true,
        },
      });

      setProcessResult(result);
      alert(`Payroll processed successfully!\nTotal Net Salary: PKR ${result.total_net.toLocaleString()}\nEmployees: ${result.employee_count}`);
    } catch (error) {
      console.error("Payroll processing error:", error);
      alert("Error processing payroll. Please check logs.");
    } finally {
      setProcessing(false);
    }
  };

  const exportPayrollReport = () => {
    if (!processResult) return;

    const csvRows = [
      ["Employee Name", "Gross Salary", "Tax Deduction", "Loan Deduction", "Benefit Deduction", "Net Salary"],
      ...processResult.payroll_records.map(r => [
        r.employee_name,
        r.gross_salary,
        r.deductions_summary.tax,
        r.deductions_summary.loan,
        r.deductions_summary.benefit,
        r.net_salary,
      ]),
    ];

    const csv = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_${selectedYear}_${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Payroll Management"
        subtitle="Advanced payroll processing with tax calculations"
        actions={
          <div className="flex gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-muted/40 border border-border rounded-md h-9 px-2 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-muted/40 border border-border rounded-md h-9 px-2 text-sm"
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <Button
              onClick={processMonthlyPayroll}
              disabled={processing}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              {processing ? "Processing..." : "Process Payroll"}
            </Button>
            {processResult && (
              <Button onClick={exportPayrollReport} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            )}
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Active Employees</div>
          <div className="text-xl font-semibold">{employees.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Total Monthly Salary</div>
          <div className="text-xl font-semibold">
            PKR {employees.reduce((sum, e) => sum + (e.salary || 0), 0).toLocaleString()}
          </div>
        </div>
        {processResult && (
          <>
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground">Gross Payroll</div>
              <div className="text-xl font-semibold">PKR {processResult.total_gross.toLocaleString()}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground">Total Deductions</div>
              <div className="text-xl font-semibold text-destructive">PKR {processResult.total_deductions.toLocaleString()}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground">Net Payable</div>
              <div className="text-xl font-semibold text-success">PKR {processResult.total_net.toLocaleString()}</div>
            </div>
          </>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="records">Payroll Records</TabsTrigger>
          <TabsTrigger value="loans">Employee Loans</TabsTrigger>
          <TabsTrigger value="benefits">Benefits</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
        </TabsList>

        <TabsContent value="records">
          <CrudPage {...schemas.payroll} />
        </TabsContent>

        <TabsContent value="loans">
          <CrudPage {...schemas.employeeLoans} />
        </TabsContent>

        <TabsContent value="benefits">
          <CrudPage {...schemas.employeeBenefits} />
        </TabsContent>

        <TabsContent value="batches">
          <CrudPage {...schemas.payrollBatches} />
        </TabsContent>
      </Tabs>
    </div>
  );
}