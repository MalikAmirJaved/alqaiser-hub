// src/components/payroll/CompensationLoanPage.tsx
"use client";

import { useState } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import {
  useCompensations, useCreateCompensation, useUpdateCompensation, useDeleteCompensation,
  useEmployeeLoans, useCreateEmployeeLoan, useUpdateEmployeeLoan, useDeleteEmployeeLoan
} from "@/hooks/usePayroll";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HandCoins, TrendingUp, Plus, Pencil, Trash2, Search } from "lucide-react";
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

  const employeeOptions = employees.map((e) => ({
  value: String(e.id),
  label: `${e.employee_id} - ${e.first_name} ${e.last_name || ""}`,
}));

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
        if (editingItem) {
          await updateLoan.mutateAsync({ id: editingItem.id, ...formData });
          toast.success("Loan updated");
        } else {
          await createLoan.mutateAsync(formData);
          toast.success("Loan created");
        }
      }
      setShowModal(false);
      setEditingItem(null);
      setFormData({});
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

  const openAddModal = (type: "compensation" | "loan") => {
    setModalType(type);
    setEditingItem(null);
    setFormData({});
    setShowModal(true);
  };

  const openEditModal = (type: "compensation" | "loan", item: any) => {
    setModalType(type);
    setEditingItem(item);
    setFormData(item);
    setShowModal(true);
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

  const renderFormFields = () => {
    if (modalType === "compensation") {
      return (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm flex flex-col gap-1 col-span-2">
            <span className="text-muted-foreground text-xs">Employee *</span>
            <SearchableSelect
              value={formData.employee_id || ""}
              onChange={(val) => setFormData({ ...formData, employee_id: val })}
              options={employeeOptions}
              placeholder="Select Employee"
              required
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Grade/Band</span>
            <input type="text" value={formData.grade || ""} onChange={(e) => setFormData({ ...formData, grade: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-2" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Basic Salary *</span>
            <input type="number" value={formData.basic_salary || ""} onChange={(e) => setFormData({ ...formData, basic_salary: Number(e.target.value) })} required className="bg-muted/40 border border-border rounded-md h-9 px-2" />
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

    return (
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm flex flex-col gap-1 col-span-2">
          <span className="text-muted-foreground text-xs">Employee *</span>
          <SearchableSelect
            value={formData.employee_id || ""}
            onChange={(val) => setFormData({ ...formData, employee_id: val })}
            options={employeeOptions}
            placeholder="Select Employee"
            required
          />
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
          <input type="number" value={formData.principal_amount || ""} onChange={(e) => setFormData({ ...formData, principal_amount: Number(e.target.value) })} required className="bg-muted/40 border border-border rounded-md h-9 px-2" />
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Monthly Deduction</span>
          <input type="number" value={formData.monthly_deduction || ""} onChange={(e) => setFormData({ ...formData, monthly_deduction: Number(e.target.value) })} className="bg-muted/40 border border-border rounded-md h-9 px-2" />
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Total Months *</span>
          <input type="number" value={formData.total_months || ""} onChange={(e) => setFormData({ ...formData, total_months: Number(e.target.value) })} required className="bg-muted/40 border border-border rounded-md h-9 px-2" />
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Start Date</span>
          <DatePicker value={formData.start_date} onChange={(val) => setFormData({ ...formData, start_date: val || "" })} />
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Interest Rate (%)</span>
          <input type="number" value={formData.interest_rate || ""} onChange={(e) => setFormData({ ...formData, interest_rate: Number(e.target.value) })} className="bg-muted/40 border border-border rounded-md h-9 px-2" />
        </label>
        <label className="text-sm flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Status</span>
          <select value={formData.status || "PENDING"} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="bg-muted/40 border border-border rounded-md h-9 px-2">
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
        <label className="text-sm flex flex-col gap-1 col-span-2">
          <span className="text-muted-foreground text-xs">Purpose</span>
          <textarea rows={2} value={formData.purpose || ""} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} className="bg-muted/40 border border-border rounded-md p-2" />
        </label>
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
                      <td className="px-4 py-3">{formatCurrency(parseFloat(item.basic_salary))}</td>
                      <td className="px-4 py-3">{formatCurrency(parseFloat(item.total_allowances))}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(parseFloat(item.total_ctc))}</td>
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
                      <td className="px-4 py-3">{item.loan_type_display || item.loan_type}</td>
                      <td className="px-4 py-3">{formatCurrency(parseFloat(item.principal_amount))}</td>
                      <td className="px-4 py-3">{formatCurrency(parseFloat(item.monthly_deduction))}</td>
                      <td className="px-4 py-3">{formatCurrency(parseFloat(item.remaining_amount))}</td>
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
              <button onClick={handleSave} className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
                {editingItem ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}