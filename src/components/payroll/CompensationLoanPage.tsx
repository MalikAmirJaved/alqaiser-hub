// src/components/payroll/CompensationLoanPage.tsx
"use client";

import { useState, useEffect } from "react";
import { ls } from "@/services/localStorageService";
import { companyContext } from "@/services/companyContextService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HandCoins, Receipt, FileText, TrendingUp, Shield, Plus, Pencil, Trash2, Search, Download } from "lucide-react";

interface CompensationLoanPageProps {
  onRefresh?: () => void;
  formatCurrency: (amount: number) => string;
}

type Loan = {
  id: string;
  employee_id: string;
  employee_name?: string;
  loan_type: string;
  principal_amount: number;
  monthly_deduction: number;
  total_months: number;
  paid_months: number;
  remaining_amount: number;
  remaining_months: number;
  start_date: string;
  end_date?: string;
  interest_rate?: number;
  interest_amount?: number;
  total_payable?: number;
  purpose?: string;
  status: string;
  approved_by?: string;
  approval_date?: string;
  notes?: string;
};

type Benefit = {
  id: string;
  employee_id: string;
  employee_name?: string;
  benefit_type: string;
  provider?: string;
  policy_number?: string;
  employer_contribution: number;
  employee_contribution: number;
  monthly_amount: number;
  coverage_amount?: number;
  effective_date: string;
  expiry_date?: string;
  status: string;
  notes?: string;
};

type Compensation = {
  id: string;
  employee_id: string;
  employee_name?: string;
  grade: string;
  basic: number;
  house_rent_allowance: number;
  medical_allowance: number;
  transport_allowance: number;
  fuel_allowance: number;
  phone_allowance: number;
  other_allowances: number;
  total_allowances: number;
  employer_pf: number;
  employer_eobi: number;
  total_ctc: number;
  effective_date: string;
  review_date?: string;
  notes?: string;
};

export default function CompensationLoanPage({ onRefresh, formatCurrency }: CompensationLoanPageProps) {
  const [activeTab, setActiveTab] = useState("compensation");
  const [employees, setEmployees] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [modalType, setModalType] = useState<"compensation" | "loan" | "benefit">("compensation");
  
  // Data states
  const [compensations, setCompensations] = useState<Compensation[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  
  // Form states
  const [formData, setFormData] = useState<any>({});
  
  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadEmployees();
    loadCompensations();
    loadLoans();
    loadBenefits();
  }, []);

  const loadEmployees = () => {
    const allEmployees = ls.get("employees", []);
    const filtered = companyContext.filterByContext(allEmployees);
    setEmployees(filtered);
  };

  const loadCompensations = () => {
    const allCompensations = ls.get("compensation", []);
    const filtered = companyContext.filterByContext(allCompensations);
    // Enrich with employee names
    const enriched = filtered.map((c: any) => {
      const emp = employees.find(e => e.id === c.employee_id);
      return { ...c, employee_name: emp ? `${emp.first_name} ${emp.last_name || ""}` : "Unknown" };
    });
    setCompensations(enriched);
  };

  const loadLoans = () => {
    const allLoans = ls.get("employeeLoans", []);
    const filtered = companyContext.filterByContext(allLoans);
    const enriched = filtered.map((l: any) => {
      const emp = employees.find(e => e.id === l.employee_id);
      const remainingAmt = l.principal_amount - (l.monthly_deduction * (l.paid_months || 0));
      const remainingMonths = l.total_months - (l.paid_months || 0);
      return { 
        ...l, 
        employee_name: emp ? `${emp.first_name} ${emp.last_name || ""}` : "Unknown",
        remaining_amount: remainingAmt,
        remaining_months: remainingMonths
      };
    });
    setLoans(enriched);
  };

  const loadBenefits = () => {
    const allBenefits = ls.get("employeeBenefits", []);
    const filtered = companyContext.filterByContext(allBenefits);
    const enriched = filtered.map((b: any) => {
      const emp = employees.find(e => e.id === b.employee_id);
      return { ...b, employee_name: emp ? `${emp.first_name} ${emp.last_name || ""}` : "Unknown" };
    });
    setBenefits(enriched);
  };

  const handleSave = () => {
    let updated = [];
    
    if (modalType === "compensation") {
      if (editingItem) {
        updated = compensations.map(c => c.id === editingItem.id ? { ...formData, id: c.id } : c);
        ls.set("compensation", updated);
      } else {
        const newItem = { ...formData, id: `cp_${Date.now()}` };
        updated = [newItem, ...compensations];
        ls.set("compensation", updated);
      }
      setCompensations(updated);
    } else if (modalType === "loan") {
      if (editingItem) {
        updated = loans.map(l => l.id === editingItem.id ? { ...formData, id: l.id } : l);
        ls.set("employeeLoans", updated);
      } else {
        const newItem = { ...formData, id: `loan_${Date.now()}`, paid_months: 0, status: "PENDING" };
        updated = [newItem, ...loans];
        ls.set("employeeLoans", updated);
      }
      setLoans(updated);
    } else if (modalType === "benefit") {
      if (editingItem) {
        updated = benefits.map(b => b.id === editingItem.id ? { ...formData, id: b.id } : b);
        ls.set("employeeBenefits", updated);
      } else {
        const newItem = { ...formData, id: `benefit_${Date.now()}` };
        updated = [newItem, ...benefits];
        ls.set("employeeBenefits", updated);
      }
      setBenefits(updated);
    }
    
    setShowModal(false);
    setEditingItem(null);
    setFormData({});
    if (onRefresh) onRefresh();
  };

  const handleDelete = (type: string, id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    
    if (type === "compensation") {
      const updated = compensations.filter(c => c.id !== id);
      ls.set("compensation", updated);
      setCompensations(updated);
    } else if (type === "loan") {
      const updated = loans.filter(l => l.id !== id);
      ls.set("employeeLoans", updated);
      setLoans(updated);
    } else if (type === "benefit") {
      const updated = benefits.filter(b => b.id !== id);
      ls.set("employeeBenefits", updated);
      setBenefits(updated);
    }
    
    if (onRefresh) onRefresh();
  };

  const openAddModal = (type: "compensation" | "loan" | "benefit") => {
    setModalType(type);
    setEditingItem(null);
    setFormData({});
    setShowModal(true);
  };

  const openEditModal = (type: "compensation" | "loan" | "benefit", item: any) => {
    setModalType(type);
    setEditingItem(item);
    setFormData(item);
    setShowModal(true);
  };

  // Form field renderer
  const renderFormFields = () => {
    const employeeOptions = employees.map(e => ({ value: e.id, label: `${e.employee_id} - ${e.first_name} ${e.last_name || ""}` }));
    
    if (modalType === "compensation") {
      return (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Employee *</span>
            <select
              value={formData.employee_id || ""}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
              required
              className="bg-muted/40 border border-border rounded-md h-9 px-2"
            >
              <option value="">Select Employee</option>
              {employeeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Grade/Band</span>
            <input type="text" value={formData.grade || ""} onChange={(e) => setFormData({ ...formData, grade: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Basic Salary *</span>
            <input type="number" value={formData.basic || ""} onChange={(e) => setFormData({ ...formData, basic: Number(e.target.value) })} required className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">House Rent Allowance</span>
            <input type="number" value={formData.house_rent_allowance || ""} onChange={(e) => setFormData({ ...formData, house_rent_allowance: Number(e.target.value) })} className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Medical Allowance</span>
            <input type="number" value={formData.medical_allowance || ""} onChange={(e) => setFormData({ ...formData, medical_allowance: Number(e.target.value) })} className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Transport Allowance</span>
            <input type="number" value={formData.transport_allowance || ""} onChange={(e) => setFormData({ ...formData, transport_allowance: Number(e.target.value) })} className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Fuel Allowance</span>
            <input type="number" value={formData.fuel_allowance || ""} onChange={(e) => setFormData({ ...formData, fuel_allowance: Number(e.target.value) })} className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Phone Allowance</span>
            <input type="number" value={formData.phone_allowance || ""} onChange={(e) => setFormData({ ...formData, phone_allowance: Number(e.target.value) })} className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Effective Date *</span>
            <input type="date" value={formData.effective_date || ""} onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })} required className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Notes</span>
            <textarea rows={2} value={formData.notes || ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="bg-muted/40 border border-border rounded-md p-2" />
          </label>
        </div>
      );
    }
    
    if (modalType === "loan") {
      return (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Employee *</span>
            <select
              value={formData.employee_id || ""}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
              required
              className="bg-muted/40 border border-border rounded-md h-9 px-2"
            >
              <option value="">Select Employee</option>
              {employeeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Loan Type *</span>
            <select
              value={formData.loan_type || ""}
              onChange={(e) => setFormData({ ...formData, loan_type: e.target.value })}
              required
              className="bg-muted/40 border border-border rounded-md h-9 px-2"
            >
              <option value="">Select Type</option>
              <option value="Salary Advance">Salary Advance</option>
              <option value="Personal Loan">Personal Loan</option>
              <option value="Car Loan">Car Loan</option>
              <option value="House Loan">House Loan</option>
              <option value="Education Loan">Education Loan</option>
              <option value="Emergency Loan">Emergency Loan</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Principal Amount *</span>
            <input type="number" value={formData.principal_amount || ""} onChange={(e) => setFormData({ ...formData, principal_amount: Number(e.target.value) })} required className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Monthly Deduction *</span>
            <input type="number" value={formData.monthly_deduction || ""} onChange={(e) => setFormData({ ...formData, monthly_deduction: Number(e.target.value) })} required className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Total Months *</span>
            <input type="number" value={formData.total_months || ""} onChange={(e) => setFormData({ ...formData, total_months: Number(e.target.value) })} required className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Start Date *</span>
            <input type="date" value={formData.start_date || ""} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Interest Rate (%)</span>
            <input type="number" value={formData.interest_rate || ""} onChange={(e) => setFormData({ ...formData, interest_rate: Number(e.target.value) })} className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Status</span>
            <select
              value={formData.status || "PENDING"}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="bg-muted/40 border border-border rounded-md h-9 px-2"
            >
              <option value="PENDING">Pending</option>
              <option value="ACTIVE">Active</option>
              <option value="PAID">Paid</option>
              <option value="DEFAULTED">Defaulted</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
          <label className="text-sm flex flex-col gap-1 sm:col-span-2">
            <span className="text-muted-foreground text-xs">Purpose</span>
            <textarea rows={2} value={formData.purpose || ""} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} className="bg-muted/40 border border-border rounded-md p-2" />
          </label>
        </div>
      );
    }
    
    // Benefit form
    return (
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Employee *</span>
          <select
            value={formData.employee_id || ""}
            onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
            required
            className="bg-muted/40 border border-border rounded-md h-9 px-2"
          >
            <option value="">Select Employee</option>
            {employeeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Benefit Type *</span>
          <select
            value={formData.benefit_type || ""}
            onChange={(e) => setFormData({ ...formData, benefit_type: e.target.value })}
            required
            className="bg-muted/40 border border-border rounded-md h-9 px-2"
          >
            <option value="">Select Type</option>
            <option value="Health Insurance">Health Insurance</option>
            <option value="Life Insurance">Life Insurance</option>
            <option value="Retirement Fund">Retirement Fund</option>
            <option value="Children Education">Children Education</option>
            <option value="Transport">Transport</option>
            <option value="Meal Vouchers">Meal Vouchers</option>
            <option value="Gym Membership">Gym Membership</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Employer Contribution *</span>
          <input type="number" value={formData.employer_contribution || ""} onChange={(e) => setFormData({ ...formData, employer_contribution: Number(e.target.value) })} required className="bg-muted/40 border border-border rounded-md h-9 px-2" />
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Employee Contribution *</span>
          <input type="number" value={formData.employee_contribution || ""} onChange={(e) => setFormData({ ...formData, employee_contribution: Number(e.target.value) })} required className="bg-muted/40 border border-border rounded-md h-9 px-2" />
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Provider</span>
          <input type="text" value={formData.provider || ""} onChange={(e) => setFormData({ ...formData, provider: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-2" />
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Effective Date *</span>
          <input type="date" value={formData.effective_date || ""} onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })} required className="bg-muted/40 border border-border rounded-md h-9 px-2" />
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Status</span>
          <select
            value={formData.status || "ACTIVE"}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="bg-muted/40 border border-border rounded-md h-9 px-2"
          >
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </label>
        <label className="text-sm flex flex-col gap-1 sm:col-span-2">
          <span className="text-muted-foreground text-xs">Notes</span>
          <textarea rows={2} value={formData.notes || ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="bg-muted/40 border border-border rounded-md p-2" />
        </label>
      </div>
    );
  };

  // Filter functions
  const filteredCompensations = compensations.filter(c => 
    c.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.grade?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredLoans = loans.filter(l => 
    l.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.loan_type?.toLowerCase().includes(searchQuery.toLowerCase())
  ).filter(l => statusFilter === "all" || l.status === statusFilter);
  
  const filteredBenefits = benefits.filter(b => 
    b.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.benefit_type?.toLowerCase().includes(searchQuery.toLowerCase())
  ).filter(b => statusFilter === "all" || b.status === statusFilter);

  return (
    <div className="mt-5">
      {/* Tabs Menu for Salary vs Compensation/Loan */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-3">
          <TabsList className="bg-muted/40">
            <TabsTrigger value="compensation" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Salary Structure
            </TabsTrigger>
            <TabsTrigger value="loans" className="flex items-center gap-2">
              <HandCoins className="w-4 h-4" />
              Loans & Advances
            </TabsTrigger>
            <TabsTrigger value="benefits" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Benefits
            </TabsTrigger>
          </TabsList>
          
          <button
            onClick={() => openAddModal(activeTab === "compensation" ? "compensation" : activeTab === "loans" ? "loan" : "benefit")}
            className="inline-flex items-center gap-2 px-3 h-8 rounded-md bg-primary text-primary-foreground text-sm"
          >
            <Plus className="w-4 h-4" />
            Add {activeTab === "compensation" ? "Compensation" : activeTab === "loans" ? "Loan" : "Benefit"}
          </button>
        </div>

        {/* Search Bar */}
        <div className="bg-card border border-border rounded-2xl shadow-sm">
          <div className="p-3 border-b border-border">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by employee name..."
                  className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="relative w-40">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full pl-3 pr-8 h-9 rounded-md border border-border bg-muted/40 text-sm outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Compensation Tab */}
          <TabsContent value="compensation" className="m-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Employee</th>
                    <th className="text-left px-4 py-3">Grade</th>
                    <th className="text-left px-4 py-3">Basic Salary</th>
                    <th className="text-left px-4 py-3">Total Allowances</th>
                    <th className="text-left px-4 py-3">Total CTC</th>
                    <th className="text-left px-4 py-3">Effective Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompensations.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        No compensation records found.
                      </td>
                    </tr>
                  )}
                  {filteredCompensations.map((item) => (
                    <tr key={item.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{item.employee_name}</td>
                      <td className="px-4 py-3">{item.grade || "—"}</td>
                      <td className="px-4 py-3">{formatCurrency(item.basic || 0)}</td>
                      <td className="px-4 py-3">{formatCurrency(item.total_allowances || 0)}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(item.total_ctc || 0)}</td>
                      <td className="px-4 py-3">{item.effective_date || "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEditModal("compensation", item)} className="p-1.5 rounded-md hover:bg-muted">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete("compensation", item.id)} className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Loans Tab */}
          <TabsContent value="loans" className="m-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Employee</th>
                    <th className="text-left px-4 py-3">Loan Type</th>
                    <th className="text-left px-4 py-3">Principal</th>
                    <th className="text-left px-4 py-3">Monthly Deduction</th>
                    <th className="text-left px-4 py-3">Remaining</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoans.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        No loan records found.
                      </td>
                    </tr>
                  )}
                  {filteredLoans.map((item) => (
                    <tr key={item.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{item.employee_name}</td>
                      <td className="px-4 py-3">{item.loan_type}</td>
                      <td className="px-4 py-3">{formatCurrency(item.principal_amount)}</td>
                      <td className="px-4 py-3">{formatCurrency(item.monthly_deduction)}</td>
                      <td className="px-4 py-3">{formatCurrency(item.remaining_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
                          item.status === "ACTIVE" ? "bg-success/15 text-success border-success/30" :
                          item.status === "PAID" ? "bg-info/15 text-info border-info/30" :
                          item.status === "PENDING" ? "bg-warning/15 text-warning border-warning/30" :
                          "bg-destructive/15 text-destructive border-destructive/30"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEditModal("loan", item)} className="p-1.5 rounded-md hover:bg-muted">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete("loan", item.id)} className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Benefits Tab */}
          <TabsContent value="benefits" className="m-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Employee</th>
                    <th className="text-left px-4 py-3">Benefit Type</th>
                    <th className="text-left px-4 py-3">Employer</th>
                    <th className="text-left px-4 py-3">Employee</th>
                    <th className="text-left px-4 py-3">Monthly</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBenefits.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        No benefit records found.
                      </td>
                    </tr>
                  )}
                  {filteredBenefits.map((item) => (
                    <tr key={item.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{item.employee_name}</td>
                      <td className="px-4 py-3">{item.benefit_type}</td>
                      <td className="px-4 py-3">{formatCurrency(item.employer_contribution)}</td>
                      <td className="px-4 py-3">{formatCurrency(item.employee_contribution)}</td>
                      <td className="px-4 py-3">{formatCurrency(item.monthly_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
                          item.status === "ACTIVE" ? "bg-success/15 text-success border-success/30" :
                          item.status === "PENDING" ? "bg-warning/15 text-warning border-warning/30" :
                          "bg-destructive/15 text-destructive border-destructive/30"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEditModal("benefit", item)} className="p-1.5 rounded-md hover:bg-muted">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete("benefit", item.id)} className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <div className="p-3 border-t border-border flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {activeTab === "compensation" && `${filteredCompensations.length} compensation records`}
              {activeTab === "loans" && `${filteredLoans.length} loan records`}
              {activeTab === "benefits" && `${filteredBenefits.length} benefit records`}
            </div>
          </div>
        </div>
      </Tabs>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
              <h2 className="font-semibold">
                {editingItem ? "Edit" : "Add"} {modalType === "compensation" ? "Compensation" : modalType === "loan" ? "Loan" : "Benefit"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-md hover:bg-muted">
                ✕
              </button>
            </div>
            <div className="p-4">
              {renderFormFields()}
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
                Cancel
              </button>
              <button onClick={handleSave} className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}