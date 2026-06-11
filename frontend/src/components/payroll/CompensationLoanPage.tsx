// components/payroll/CompensationLoanPage.tsx
"use client";

import { useState, useMemo } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import {
  useCompensations,
  useCreateCompensation,
  useUpdateCompensation,
  useDeleteCompensation,
  useEmployeeLoans,
  useCreateEmployeeLoan,
  useUpdateEmployeeLoan,
  useDeleteEmployeeLoan,
  useUpdateLoanStatus,
} from "@/hooks/usePayroll";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HandCoins, TrendingUp, Plus, Search } from "lucide-react";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import CompensationForm from "./CompensationForm";
import LoanForm from "./LoanForm";
import CompensationTab from "./CompensationTab";
import LoanTab from "./LoanTab";
import { toast } from "sonner";

interface CompensationLoanPageProps {
  formatCurrency: (amount: number) => string;
}

export default function CompensationLoanPage({
  formatCurrency,
}: CompensationLoanPageProps) {
  const permissions = useFeaturePermissions("HR", "compensation");

  const [activeTab, setActiveTab] = useState("compensation");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [modalType, setModalType] = useState<"compensation" | "loan">(
    "compensation"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formData, setFormData] = useState<any>({});
  const [statusDropdownId, setStatusDropdownId] = useState<number | null>(null);
  const [selectedEmployeeSalary, setSelectedEmployeeSalary] = useState<number>(0);
  const [loanValidationErrors, setLoanValidationErrors] = useState<string[]>([]);

  const { data: employees = [] } = useEmployees();
  const { data: compensations = [] } = useCompensations();
  const { data: loans = [] } = useEmployeeLoans();

  const createCompensation = useCreateCompensation();
  const updateCompensation = useUpdateCompensation();
  const deleteCompensation = useDeleteCompensation();
  const createLoan = useCreateEmployeeLoan();
  const updateLoan = useUpdateEmployeeLoan();
  const deleteLoan = useDeleteEmployeeLoan();
  const updateLoanStatus = useUpdateLoanStatus();

  // -----------------------------
  // Permissions helpers
  // -----------------------------
  const canCreate =
    (activeTab === "compensation" && permissions.create_compensation) ||
    (activeTab === "loans" && permissions.create_loan);

  const canUpdateModal = editingItem
    ? modalType === "compensation"
      ? permissions.update_compensation
      : permissions.update_loan
    : modalType === "compensation"
      ? permissions.create_compensation
      : permissions.create_loan;

  // -----------------------------
  // Derived data
  // -----------------------------
  const employeesWithCompensation = useMemo(() => {
    return compensations
      .filter((c) => c.status === "ACTIVE")
      .map((c) => c.employee_id);
  }, [compensations]);

  const employeeOptionsForCompensation = employees
    .filter(
      (e) =>
        !employeesWithCompensation.includes(e.id) ||
        (editingItem && editingItem.employee_id === e.id)
    )
    .map((e) => ({
      value: String(e.id),
      label: `${e.employee_id} - ${e.first_name} ${e.last_name || ""}`,
    }));

  const employeeOptionsForLoan = employees.map((e) => ({
    value: String(e.id),
    label: `${e.employee_id} - ${e.first_name} ${e.last_name || ""} (${formatCurrency(
      parseFloat(e.salary || "0")
    )})`,
  }));

  // -----------------------------
  // Actions
  // -----------------------------
  const handleSave = async () => {
    try {
      if (modalType === "compensation") {
        if (editingItem) {
          await updateCompensation.mutateAsync({
            id: editingItem.id,
            ...formData,
          });
          toast.success("Compensation updated successfully");
        } else {
          await createCompensation.mutateAsync(formData);
          toast.success("Compensation created successfully");
        }
      } else {
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

  // -----------------------------
  // Filters
  // -----------------------------
  const filteredCompensations = compensations.filter(
    (c) =>
      c.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.grade?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLoans = loans
    .filter(
      (l) =>
        l.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.loan_type?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(
      (l) => statusFilter === "all" || l.status === statusFilter
    );

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="mt-5">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <TabsList className="bg-muted/40">
            <TabsTrigger value="compensation">
              <TrendingUp className="w-4 h-4 mr-2" />
              Salary Structure
            </TabsTrigger>

            <TabsTrigger value="loans">
              <HandCoins className="w-4 h-4 mr-2" />
              Loans & Advances
            </TabsTrigger>
          </TabsList>

          {canCreate && (
            <button
              onClick={() =>
                openAddModal(
                  activeTab === "compensation" ? "compensation" : "loan"
                )
              }
              className="inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add {activeTab === "compensation" ? "Compensation" : "Loan"}
            </button>
          )}
        </div>

        {/* Search + Filters */}
        <div className="bg-card border rounded-xl p-4 mb-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 h-10 border rounded-lg"
                placeholder="Search employee..."
              />
            </div>

            {activeTab === "loans" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 border rounded-lg px-3"
              >
                <option value="all">All</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            )}
          </div>
        </div>

        {/* Tabs */}
        <TabsContent value="compensation">
          <CompensationTab
            filteredCompensations={filteredCompensations}
            formatCurrency={formatCurrency}
            onEdit={
              permissions.update_compensation
                ? (item) => openEditModal("compensation", item)
                : undefined
            }
            onDelete={
              permissions.delete_compensation
                ? (id) => handleDelete("compensation", id)
                : undefined
            }
          />
        </TabsContent>

        <TabsContent value="loans">
          <LoanTab
            filteredLoans={filteredLoans}
            formatCurrency={formatCurrency}
            statusDropdownId={statusDropdownId}
            setStatusDropdownId={setStatusDropdownId}
            onEdit={
              permissions.update_loan
                ? (item) => openEditModal("loan", item)
                : undefined
            }
            onDelete={
              permissions.delete_loan
                ? (id) => handleDelete("loan", id)
                : undefined
            }
            onStatusChange={
              permissions.update_loan_status
                ? handleStatusChange
                : undefined
            }
          />
        </TabsContent>
      </Tabs>

      {/* Modal */}
      {showModal && canUpdateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
          <div className="bg-card rounded-xl w-full max-w-3xl">
            <div className="p-4 border-b flex justify-between">
              <h2>
                {editingItem ? "Edit" : "Add"}{" "}
                {modalType === "compensation" ? "Compensation" : "Loan"}
              </h2>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="p-4">
              {modalType === "compensation" ? (
                <CompensationForm
                  formData={formData}
                  setFormData={setFormData}
                  employeeOptions={employeeOptionsForCompensation}
                  formatCurrency={formatCurrency}
                />
              ) : (
                <LoanForm
                  formData={formData}
                  setFormData={setFormData}
                  employeeOptions={employeeOptionsForLoan}
                  selectedEmployeeSalary={selectedEmployeeSalary}
                  formatCurrency={formatCurrency}
                  errors={[]}
                  onValidationChange={() => {}}
                />
              )}
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button onClick={handleSave}>
                {editingItem ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {statusDropdownId && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setStatusDropdownId(null)}
        />
      )}
    </div>
  );
}