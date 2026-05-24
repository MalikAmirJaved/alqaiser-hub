// components/payroll/CompensationLoanPage.tsx
"use client";

import { useState, useMemo } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import {
  useCompensations, useCreateCompensation, useUpdateCompensation, useDeleteCompensation,
  useEmployeeLoans, useCreateEmployeeLoan, useUpdateEmployeeLoan, useDeleteEmployeeLoan,
  useUpdateLoanStatus
} from "@/hooks/usePayroll";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HandCoins, TrendingUp, Plus, Search } from "lucide-react";
import CompensationForm from "./CompensationForm";
import LoanForm from "./LoanForm";
import CompensationTab from "./CompensationTab";
import LoanTab from "./LoanTab";
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
  const [loanValidationErrors, setLoanValidationErrors] = useState<string[]>([]);

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

  const handleSave = async () => {
    try {
      if (modalType === "compensation") {
        if (editingItem) {
          await updateCompensation.mutateAsync({ id: editingItem.id, ...formData });
          toast.success("Compensation updated successfully");
        } else {
          await createCompensation.mutateAsync(formData);
          toast.success("Compensation created successfully");
        }
      } else {
        // Validate loan before saving
        if (loanValidationErrors.length > 0) {
          toast.error(loanValidationErrors[0]);
          return;
        }
        
        const payload = { ...formData };
        delete payload.status;
        
        if (editingItem) {
          await updateLoan.mutateAsync({ id: editingItem.id, ...payload });
          toast.success("Loan updated successfully");
        } else {
          await createLoan.mutateAsync(payload);
          toast.success("Loan created successfully");
        }
      }
      setShowModal(false);
      setEditingItem(null);
      setFormData({});
      setSelectedEmployeeSalary(0);
      setLoanValidationErrors([]);
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
    }
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      if (type === "compensation") {
        await deleteCompensation.mutateAsync(id);
        toast.success("Compensation deleted successfully");
      } else {
        await deleteLoan.mutateAsync(id);
        toast.success("Loan deleted successfully");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete");
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
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
    setLoanValidationErrors([]);
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

  // Handle employee selection change for loan
  const handleEmployeeChangeForLoan = (employeeId: string) => {
    setFormData({ ...formData, employee_id: employeeId });
    if (employeeId) {
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

  const renderFormFields = () => {
    if (modalType === "compensation") {
      return (
        <CompensationForm
          formData={formData}
          setFormData={setFormData}
          employeeOptions={employeeOptionsForCompensation}
          formatCurrency={formatCurrency}
        />
      );
    }

    return (
      <LoanForm
        formData={formData}
        setFormData={(data) => {
          setFormData(data);
          // Update employee salary when employee changes
          if (data.employee_id !== formData.employee_id) {
            const employee = employees.find(e => String(e.id) === data.employee_id);
            if (employee) {
              setSelectedEmployeeSalary(parseFloat(employee.salary || "0"));
            }
          }
        }}
        employeeOptions={employeeOptionsForLoan}
        selectedEmployeeSalary={selectedEmployeeSalary}
        formatCurrency={formatCurrency}
        errors={[]}
        onValidationChange={(hasErrors) => {
          // Validation will be handled by the form component
        }}
      />
    );
  };

  return (
    <div className="mt-5">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
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
            className="inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add {activeTab === "compensation" ? "Compensation" : "Loan"}
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/20">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by employee name..."
                  className="w-full bg-background pl-9 pr-3 h-10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 border border-border"
                />
              </div>
              {activeTab === "loans" && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-40 h-10 rounded-lg border border-border bg-background text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
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

          <TabsContent value="compensation" className="m-0">
            <CompensationTab
              filteredCompensations={filteredCompensations}
              formatCurrency={formatCurrency}
              onEdit={(item) => openEditModal("compensation", item)}
              onDelete={(id) => handleDelete("compensation", id)}
            />
          </TabsContent>

          <TabsContent value="loans" className="m-0">
            <LoanTab
              filteredLoans={filteredLoans}
              formatCurrency={formatCurrency}
              statusDropdownId={statusDropdownId}
              setStatusDropdownId={setStatusDropdownId}
              onEdit={(item) => openEditModal("loan", item)}
              onDelete={(id) => handleDelete("loan", id)}
              onStatusChange={handleStatusChange}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="text-lg font-semibold">
                {editingItem ? "Edit" : "Add"} {modalType === "compensation" ? "Compensation" : "Loan"}
              </h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              {renderFormFields()}
            </div>
            <div className="p-5 border-t border-border flex justify-end gap-3 sticky bottom-0 bg-card">
              <button 
                onClick={() => setShowModal(false)} 
                className="px-4 h-10 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                className="px-4 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={modalType === "loan" && loanValidationErrors.length > 0}
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
          className="fixed inset-0 z-40"
          onClick={() => setStatusDropdownId(null)}
        />
      )}
    </div>
  );
}