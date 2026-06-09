// src/components/payroll/CompensationLoanPage.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import {
  useCompensations, useCreateCompensation, useUpdateCompensation, useDeleteCompensation,
  useEmployeeLoans, useCreateEmployeeLoan, useUpdateEmployeeLoan, useDeleteEmployeeLoan,
  useUpdateLoanStatus
} from "@/hooks/usePayroll";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HandCoins, TrendingUp, Plus, Pencil, Trash2, Search, MoreHorizontal } from "lucide-react";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { DatePicker } from "@/components/reuseable/DatePicker";
import { toast } from "sonner";

interface CompensationLoanPageProps {
  formatCurrency: (amount: number) => string;
}

export default function CompensationLoanPage({ formatCurrency }: CompensationLoanPageProps) {
  const [activeTab, setActiveTab] = useState("compensation");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [modalType, setModalType] = useState<"compensation" | "loan">("compensation");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formData, setFormData] = useState<any>({});
  const [statusDropdownId, setStatusDropdownId] = useState<number | null>(null);
  const [selectedEmployeeSalary, setSelectedEmployeeSalary] = useState<number>(0);

  // Fetch data from backend
  const { data: employees = [] } = useEmployees();
  const { data: compensations = [], isLoading: compLoading } = useCompensations();
  const { data: loans = [], isLoading: loansLoading } = useEmployeeLoans();
  
  const createCompensation = useCreateCompensation();
  const updateCompensation = useUpdateCompensation();
  const deleteCompensation = useDeleteCompensation();
  const createLoan = useCreateEmployeeLoan();
  const updateLoan = useUpdateEmployeeLoan();
  const deleteLoan = useDeleteEmployeeLoan();
  const updateLoanStatus = useUpdateLoanStatus();

  // Get employees who already have active compensation
  const employeesWithCompensation = useMemo(() => {
    return compensations
      .filter(c => c.status === "ACTIVE")
      .map(c => c.employee_id);
  }, [compensations]);

  // Filter employee options based on whether they have compensation
  const employeeOptionsForCompensation = employees
    .filter(e => !employeesWithCompensation.includes(e.id) || (editingItem && editingItem.employee_id === e.id))
    .map((e) => ({
      value: String(e.id),
      label: `${e.employee_id} - ${e.first_name} ${e.last_name || ""}`,
    }));

  const employeeOptionsForLoan = employees.map((e) => ({
    value: String(e.id),
    label: `${e.employee_id} - ${e.first_name} ${e.last_name || ""} (${formatCurrency(parseFloat(e.salary || "0"))})`,
  }));

  // Auto-calculate loan fields
  const calculateLoanFields = (data: any) => {
    const principal = parseFloat(data.principal_amount) || 0;
    const interest = parseFloat(data.interest_rate) || 0;
    const totalPayable = interest > 0 ? principal + (principal * interest / 100) : principal;
    
    let monthlyDeduction = parseFloat(data.monthly_deduction) || 0;
    let totalMonths = parseInt(data.total_months) || 0;
    
    if (totalMonths > 0 && monthlyDeduction === 0) {
      monthlyDeduction = totalPayable / totalMonths;
    } else if (monthlyDeduction > 0 && totalMonths === 0) {
      totalMonths = Math.ceil(totalPayable / monthlyDeduction);
    }
    
    return {
      ...data,
      totalPayable,
      monthly_deduction: monthlyDeduction,
      total_months: totalMonths,
    };
  };

  // Validation errors
  const getLoanValidationErrors = () => {
    const errors: string[] = [];
    const monthlyDeduction = parseFloat(formData.monthly_deduction) || 0;
    const totalMonths = parseInt(formData.total_months) || 0;
    const principal = parseFloat(formData.principal_amount) || 0;
    const interest = parseFloat(formData.interest_rate) || 0;
    const totalPayable = interest > 0 ? principal + (principal * interest / 100) : principal;
    
    // Check monthly deduction vs salary
    if (monthlyDeduction > selectedEmployeeSalary) {
      errors.push(`Monthly deduction (${formatCurrency(monthlyDeduction)}) exceeds employee salary (${formatCurrency(selectedEmployeeSalary)})`);
    }
    
    // Check if total months * monthly deduction matches total payable
    if (monthlyDeduction > 0 && totalMonths > 0) {
      const calculated = monthlyDeduction * totalMonths;
      if (Math.abs(calculated - totalPayable) > 0.01) {
        errors.push(`Monthly deduction × months (${formatCurrency(calculated)}) doesn't match total payable (${formatCurrency(totalPayable)})`);
      }
    }
    
    return errors;
  };

  const handleSave = async () => {
    try {
      if (modalType === "compensation") {
        if (editingItem) {
          await updateCompensation.mutateAsync({ id: editingItem.id, ...formData });
          toast.success("Compensation updated");
        } else {
          await createCompensation.mutateAsync(formData);
          toast.success("Compensation created");
        }
      } else {
        // Validate loan
        const errors = getLoanValidationErrors();
        if (errors.length > 0) {
          toast.error(errors[0]);
          return;
        }
        
        const calculatedData = calculateLoanFields(formData);
        const payload = { ...calculatedData };
        // Remove status from payload
        delete payload.status;
        
        if (editingItem) {
          await updateLoan.mutateAsync({ id: editingItem.id, ...payload });
          toast.success("Loan updated");
        } else {
          await createLoan.mutateAsync(payload);
          toast.success("Loan created");
        }
      }
      setShowModal(false);
      setEditingItem(null);
      setFormData({});
      setSelectedEmployeeSalary(0);
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
    }
  };

  const handleDelete = async (type: string, id: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      if (type === "compensation") {
        await deleteCompensation.mutateAsync(id);
      } else {
        await deleteLoan.mutateAsync(id);
      }
      toast.success("Deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete");
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      console.log(" teh toggle clicked")
      await updateLoanStatus.mutateAsync({ id, status: newStatus });
      toast.success(`Loan status updated to ${newStatus}`);
      setStatusDropdownId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    }
  };

  const openAddModal = (type: "compensation" | "loan") => {
    setModalType(type);
    setEditingItem(null);
    setFormData({});
    setSelectedEmployeeSalary(0);
    setShowModal(true);
  };

  const openEditModal = (type: "compensation" | "loan", item: any) => {
    setModalType(type);
    setEditingItem(item);
    setFormData(item);
    if (type === "loan") {
      setSelectedEmployeeSalary(parseFloat(item.monthly_salary || "0"));
    }
    setShowModal(true);
  };

  // Handle employee selection change
  const handleEmployeeChange = (employeeId: string) => {
    setFormData({ ...formData, employee_id: employeeId });
    if (modalType === "loan" && employeeId) {
      const employee = employees.find(e => String(e.id) === employeeId);
      if (employee) {
        setSelectedEmployeeSalary(parseFloat(employee.salary || "0"));
      }
    }
  };

  // Filter data
  const filteredCompensations = compensations.filter(c =>
    c.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.grade?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLoans = loans.filter(l =>
    l.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.loan_type?.toLowerCase().includes(searchQuery.toLowerCase())
  ).filter(l => statusFilter === "all" || l.status === statusFilter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-success/15 text-success border-success/30";
      case "PAID": return "bg-info/15 text-info border-info/30";
      case "PENDING": return "bg-warning/15 text-warning border-warning/30";
      case "CANCELLED": return "bg-destructive/15 text-destructive border-destructive/30";
      default: return "bg-muted/40 text-muted-foreground border-border";
    }
  };

  const isFieldRed = (field: string) => {
    if (modalType !== "loan") return false;
    const errors = getLoanValidationErrors();
    if (field === "monthly_deduction" && parseFloat(formData.monthly_deduction) > selectedEmployeeSalary) return true;
    return false;
  };

  const renderFormFields = () => {
    if (modalType === "compensation") {
      return (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm flex flex-col gap-1 col-span-2">
            <span className="text-muted-foreground text-xs">Employee *</span>
            <SearchableSelect
              value={formData.employee_id || ""}
              onChange={(val) => setFormData({ ...formData, employee_id: val })}
              options={employeeOptionsForCompensation}
              placeholder="Select Employee"
              required
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Grade/Band</span>
            <input type="text" value={formData.grade || ""} onChange={(e) => setFormData({ ...formData, grade: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-2" />
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
            <span className="text-muted-foreground text-xs">Other Allowances</span>
            <input type="number" value={formData.other_allowances || ""} onChange={(e) => setFormData({ ...formData, other_allowances: Number(e.target.value) })} className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Effective Date *</span>
            <DatePicker value={formData.effective_date} onChange={(val) => setFormData({ ...formData, effective_date: val || "" })} />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Overtime Rate (per hour)</span>
            <input type="number" value={formData.overtime_rate || ""} onChange={(e) => setFormData({ ...formData, overtime_rate: Number(e.target.value) })} className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1 col-span-2">
            <span className="text-muted-foreground text-xs">Notes</span>
            <textarea rows={2} value={formData.notes || ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="bg-muted/40 border border-border rounded-md p-2" />
          </label>
        </div>
      );
    }

    // Loan Form
    const calculatedData = calculateLoanFields(formData);
    const errors = getLoanValidationErrors();

    return (
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm flex flex-col gap-1 col-span-2">
          <span className="text-muted-foreground text-xs">Employee *</span>
          <SearchableSelect
            value={formData.employee_id || ""}
            onChange={handleEmployeeChange}
            options={employeeOptionsForLoan}
            placeholder="Select Employee"
            required
          />
          {selectedEmployeeSalary > 0 && (
            <div className="text-xs text-primary mt-1">
              Monthly Salary: {formatCurrency(selectedEmployeeSalary)}
            </div>
          )}
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Loan Type *</span>
          <select value={formData.loan_type || "PERSONAL_LOAN"} onChange={(e) => setFormData({ ...formData, loan_type: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-2">
            <option value="PERSONAL_LOAN">Personal Loan</option>
            <option value="SALARY_ADVANCE">Salary Advance</option>
            <option value="CAR_LOAN">Car Loan</option>
            <option value="HOUSE_LOAN">House Loan</option>
            <option value="EDUCATION_LOAN">Education Loan</option>
            <option value="MEDICAL_LOAN">Medical Loan</option>
            <option value="EMERGENCY_LOAN">Emergency Loan</option>
          </select>
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Principal Amount *</span>
          <input 
            type="number" 
            value={formData.principal_amount || ""} 
            onChange={(e) => {
              const updated = { ...formData, principal_amount: Number(e.target.value) };
              setFormData(updated);
            }} 
            required 
            className="bg-muted/40 border border-border rounded-md h-9 px-2" 
          />
        </label>
        <label className={`text-sm flex flex-col gap-1 ${isFieldRed("monthly_deduction") ? "text-destructive" : ""}`}>
          <span className="text-muted-foreground text-xs">Monthly Deduction</span>
          <input 
            type="number" 
            value={formData.monthly_deduction || ""} 
            onChange={(e) => {
              const updated = { ...formData, monthly_deduction: Number(e.target.value), total_months: 0 };
              setFormData(updated);
            }} 
            className={`rounded-md h-9 px-2 ${
              isFieldRed("monthly_deduction") 
                ? "bg-destructive/10 border-destructive border-2" 
                : "bg-muted/40 border border-border"
            }`} 
          />
          {formData.monthly_deduction > 0 && (
            <div className="text-xs mt-1">
              Auto months: {calculatedData.total_months || "—"}
            </div>
          )}
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Total Months</span>
          <input 
            type="number" 
            value={formData.total_months || ""} 
            onChange={(e) => {
              const updated = { ...formData, total_months: Number(e.target.value), monthly_deduction: 0 };
              setFormData(updated);
            }} 
            className="bg-muted/40 border border-border rounded-md h-9 px-2" 
          />
          {formData.total_months > 0 && (
            <div className="text-xs mt-1">
              Auto deduction: {calculatedData.monthly_deduction ? formatCurrency(calculatedData.monthly_deduction) : "—"}
            </div>
          )}
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Start Date</span>
          <DatePicker value={formData.start_date} onChange={(val) => setFormData({ ...formData, start_date: val || "" })} />
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Interest Rate (%)</span>
          <input type="number" value={formData.interest_rate || ""} onChange={(e) => setFormData({ ...formData, interest_rate: Number(e.target.value) })} className="bg-muted/40 border border-border rounded-md h-9 px-2" />
        </label>
        <label className="text-sm flex flex-col gap-1 col-span-2">
          <span className="text-muted-foreground text-xs">Purpos</span>
          <textarea rows={2} value={formData.purpose || ""} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} className="bg-muted/40 border border-border rounded-md p-2" />
        </label>
        
        {/* Summary */}
        {formData.principal_amount > 0 && (
          <div className="col-span-2 bg-muted/40 rounded-lg p-3">
            <div className="text-xs font-medium mb-2">Loan Summary</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Total Payable:</span>
                <span className="ml-2 font-medium">{formatCurrency(calculatedData.totalPayable)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Monthly:</span>
                <span className="ml-2 font-medium">{calculatedData.monthly_deduction ? formatCurrency(calculatedData.monthly_deduction) : "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Months:</span>
                <span className="ml-2 font-medium">{calculatedData.total_months || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Interest:</span>
                <span className="ml-2 font-medium">{formData.interest_rate || 0}%</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Validation Errors */}
        {errors.length > 0 && (
          <div className="col-span-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
            {errors.map((error, index) => (
              <div key={index} className="text-xs text-destructive flex items-center gap-1">
                <span>⚠</span> {error}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-5">
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
          </TabsList>

          <button
            onClick={() => openAddModal(activeTab === "compensation" ? "compensation" : "loan")}
            className="inline-flex items-center gap-2 px-3 h-8 rounded-md bg-primary text-primary-foreground text-sm"
          >
            <Plus className="w-4 h-4" />
            Add {activeTab === "compensation" ? "Compensation" : "Loan"}
          </button>
        </div>

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
              {activeTab === "loans" && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-40 h-9 rounded-md border border-border bg-muted/40 text-sm px-3"
                >
                  <option value="all">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              )}
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
                    <th className="text-left px-4 py-3">Base Salary</th>
                    <th className="text-left px-4 py-3">Total Allowances</th>
                    <th className="text-left px-4 py-3">Total Monthly</th>
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
                      <td className="px-4 py-3">{formatCurrency(parseFloat(item.basic_salary || "0"))}</td>
                      <td className="px-4 py-3">{formatCurrency(parseFloat(item.total_allowances))}</td>
                      <td className="px-4 py-3 font-semibold text-primary">{formatCurrency(parseFloat(item.total_monthly))}</td>
                      <td className="px-4 py-3">{item.effective_date}</td>
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
                    <th className="text-left px-4 py-3">Monthly Ded.</th>
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
                      <td className="px-4 py-3">{item.loan_type_display || item.loan_type}</td>
                      <td className="px-4 py-3">{formatCurrency(parseFloat(item.principal_amount))}</td>
                      <td className="px-4 py-3">{formatCurrency(parseFloat(item.monthly_deduction))}</td>
                      <td className="px-4 py-3">{formatCurrency(parseFloat(item.remaining_amount))}</td>
                      <td className="px-4 py-3 relative">
                        <div className="relative">
                          <button
                            onClick={() => setStatusDropdownId(statusDropdownId === item.id ? null : item.id)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border cursor-pointer ${getStatusColor(item.status)}`}
                          >
                            {item.status}
                            <MoreHorizontal className="w-3 h-3" />
                          </button>
                          {statusDropdownId === item.id && (
                            <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                              {['PENDING', 'ACTIVE', 'PAID', 'CANCELLED'].map(status => (
                                <button
                                  key={status}
                                  onClick={(e) => {e.preventDefault(); handleStatusChange(item.id, status)}}
                                  className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-muted ${
                                    item.status === status ? 'font-bold text-primary' : ''
                                  }`}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
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
        </div>
      </Tabs>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
              <h2 className="font-semibold">
                {editingItem ? "Edit" : "Add"} {modalType === "compensation" ? "Compensation" : "Loan"}
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
              <button 
                onClick={handleSave} 
                className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
                disabled={modalType === "loan" && getLoanValidationErrors().length > 0}
              >
                {editingItem ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Click outside to close status dropdown */}
      {statusDropdownId && (
       <div 
  className="fixed inset-0"
  onClick={() => setStatusDropdownId(null)}
/>
      )}
    </div>
  );
}