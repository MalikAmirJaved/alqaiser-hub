"use client";

import { useState, useEffect } from "react";
import { ls } from "@/services/localStorageService";
import { companyContext } from "@/services/companyContextService";
import {  Search,  Eye, Wallet, HandCoins, Receipt} from "lucide-react";
import CompensationModal from "@/components/payroll/CompensationModal";
import LoanModal from "@/components/payroll/LoanModal";
import CompensationListModal from "@/components/payroll/CompensationListModal";
import LoanListModal from "@/components/payroll/LoanListModal";

// ============================================
// COMPENSATION & LOAN MANAGEMENT PAGE
// ============================================
export default function CompensationLoanPage({ onRefresh,formatCurrency }: { onRefresh: () => void }) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [compModalOpen, setCompModalOpen] = useState(false);
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [compListModalOpen, setCompListModalOpen] = useState(false);
  const [loanListModalOpen, setLoanListModalOpen] = useState(false);
  const [compensations, setCompensations] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allEmployees = ls.get("employees", []);
    const filtered = companyContext.filterByContext(allEmployees);
    setEmployees(filtered);

    const allCompensations = ls.get("compensation", []);
    setCompensations(allCompensations);

    const allLoans = ls.get("employeeLoans", []);
    setLoans(allLoans);
  };

  const getActiveCompensation = (employeeId: string) => {
    return compensations.find(c => c.employee_id === employeeId && c.status === "ACTIVE");
  };

  const getActiveLoans = (employeeId: string) => {
    return loans.filter(l => l.employee_id === employeeId && l.status === "ACTIVE");
  };

  const filteredEmployees = employees.filter(emp =>
    emp.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.employee_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm mt-5">
      <div className="p-4 border-b border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Compensation & Loan Management
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Manage employee compensation structures and loan agreements
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employees..."
              className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Employee</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Current Compensation</th>
              <th className="text-left px-4 py-3">Active Loans</th>
              <th className="text-left px-4 py-3">Total Loan Balance</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-muted-foreground">
                  No employees found.
                </td>
              </tr>
            )}
            {filteredEmployees.map((employee) => {
              const activeComp = getActiveCompensation(employee.id);
              const activeLoans = getActiveLoans(employee.id);
              const totalLoanBalance = activeLoans.reduce((sum, l) => sum + (l.remaining_amount || 0), 0);

              return (
                <tr key={employee.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{employee.first_name} {employee.last_name || ""}</div>
                    <div className="text-xs text-muted-foreground">{employee.employee_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    {employee.department}<br />
                    <span className="text-xs text-muted-foreground">{employee.designation || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {activeComp ? (
                      <div>
                        <div className="font-medium text-primary">{formatCurrency(activeComp.total_compensation)}</div>
                        <div className="text-xs text-muted-foreground">Basic: {formatCurrency(activeComp.basic_salary)}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {activeLoans.length > 0 ? (
                      <div className="space-y-1">
                        {activeLoans.slice(0, 2).map((loan) => (
                          <div key={loan.id} className="text-xs">
                            <span className="text-warning">{loan.loan_type?.replace(/_/g, " ")}</span>
                            <span className="text-muted-foreground ml-1">{formatCurrency(loan.monthly_deduction)}/mo</span>
                          </div>
                        ))}
                        {activeLoans.length > 2 && (
                          <div className="text-xs text-muted-foreground">+{activeLoans.length - 2} more</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">No active loans</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {totalLoanBalance > 0 ? (
                      <span className="font-medium text-warning">{formatCurrency(totalLoanBalance)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setCompModalOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-muted"
                        title="Set Compensation"
                      >
                        <Wallet className="w-4 h-4 text-primary" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setLoanModalOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-muted"
                        title="Create Loan"
                      >
                        <HandCoins className="w-4 h-4 text-warning" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setCompListModalOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-muted"
                        title="View Compensation History"
                      >
                        <Eye className="w-4 h-4 text-info" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setLoanListModalOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-muted"
                        title="View Loan History"
                      >
                        <Receipt className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {compModalOpen && selectedEmployee && (
        <CompensationModal
          employee={selectedEmployee}
          formatCurrency={formatCurrency}
          isOpen={compModalOpen}
          onClose={() => {
            setCompModalOpen(false);
            setSelectedEmployee(null);
          }}
          onSuccess={() => {
            loadData();
            onRefresh();
          }}
        />
      )}

      {loanModalOpen && selectedEmployee && (
        <LoanModal
        formatCurrency={formatCurrency}
          employee={selectedEmployee}
          isOpen={loanModalOpen}
          onClose={() => {
            setLoanModalOpen(false);
            setSelectedEmployee(null);
          }}
          onSuccess={() => {
            loadData();
            onRefresh();
          }}
        />
      )}

      {compListModalOpen && selectedEmployee && (
        <CompensationListModal
        formatCurrency={formatCurrency}
          employee={selectedEmployee}
          isOpen={compListModalOpen}
          onClose={() => {
            setCompListModalOpen(false);
            setSelectedEmployee(null);
          }}
        />
      )}

      {loanListModalOpen && selectedEmployee && (
        <LoanListModal
        formatCurrency={formatCurrency}
          employee={selectedEmployee}
          isOpen={loanListModalOpen}
          onClose={() => {
            setLoanListModalOpen(false);
            setSelectedEmployee(null);
          }}
          onRefresh={() => loadData()}
        />
      )}
    </div>
  );
}