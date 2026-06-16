// components/payroll/CompensationLoanPage.tsx
"use client";

import { useState, useMemo } from "react";
import { useActiveEmployees } from "@/hooks/useEmployees";
import {
  useCompensations,
  useCreateCompensation,
  useUpdateCompensation,
  useDeleteCompensation,
  useUpdateCompensationStatus,
  useEmployeeLoans,
  useCreateEmployeeLoan,
  useApproveLoan,
  usePayLoan,
} from "@/hooks/usePayroll";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HandCoins, TrendingUp, Plus, Search } from "lucide-react";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import CompensationForm from "./CompensationForm";
import LoanForm from "./LoanForm";
import CompensationTab from "./CompensationTab";
import LoanTab from "./LoanTab";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SearchableSelect from "@/components/reuseable/SearchableSelect";

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
  const [payLoanModalOpen, setPayLoanModalOpen] = useState(false);
  const [payLoanItem, setPayLoanItem] = useState<any>(null);

  const { data: employees = [] } = useActiveEmployees();
  const { data: compensations = [] } = useCompensations();
  const { data: loans = [] } = useEmployeeLoans();
  const createCompensation = useCreateCompensation();
  const updateCompensation = useUpdateCompensation();
  const deleteCompensation = useDeleteCompensation();
  const updateCompensationStatus = useUpdateCompensationStatus();
  const createLoan = useCreateEmployeeLoan();
  const approveLoan = useApproveLoan();
  const payLoan = usePayLoan();

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
      .filter((c) => c.status === "CONFIRM" || c.status === "PENDING")
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
        const allowanceFields = ['house_rent_allowance', 'medical_allowance', 'transport_allowance', 'phone_allowance', 'utilities_allowance', 'education_allowance', 'other_allowances'];
        const hasAllowance = allowanceFields.some(f => parseFloat(formData[f] || 0) > 0);
        if (!hasAllowance) {
          toast.error("At least one allowance must be entered");
          return;
        }
        const payload: any = {
          employee_id: formData.employee_id,
          house_rent_allowance: formData.house_rent_allowance || 0,
          medical_allowance: formData.medical_allowance || 0,
          transport_allowance: formData.transport_allowance || 0,
          phone_allowance: formData.phone_allowance || 0,
          utilities_allowance: formData.utilities_allowance || 0,
          education_allowance: formData.education_allowance || 0,
          other_allowances: formData.other_allowances || 0,
          overtime_rate: formData.overtime_rate || 0,
          frequency_type: formData.frequency_type,
          review_date: formData.review_date,
          notes: formData.notes,
        };

        if (formData.frequency_type === 'MONTH_RANGE') {
          payload.month_range = formData.month_range ? {
            start_month: formData.month_range.start_month,
            start_year: formData.month_range.start_year,
            end_month: formData.month_range.end_month,
            end_year: formData.month_range.end_year,
          } : null;
          payload.selected_months = [];
        } else {
          payload.selected_months = formData.selected_months || [];
          payload.month_range = null;
        }

        if (editingItem) {
          await updateCompensation.mutateAsync({
            id: editingItem.id,
            ...payload,
          });
        } else {
          await createCompensation.mutateAsync(payload);
        }
      } else {
        if (loanValidationErrors.length > 0) {
          toast.error(loanValidationErrors[0]);
          return;
        }

        const payload: any = {
          employee_id: formData.employee_id,
          loan_type: formData.loan_type,
          principal_amount: formData.principal_amount,
          interest_rate: formData.interest_rate || 0,
          frequency_type: formData.frequency_type,
          purpose: formData.purpose,
          notes: formData.notes,
        };

        if (formData.frequency_type === 'MONTH_RANGE') {
          payload.month_range = formData.month_range ? {
            start_month: formData.month_range.start_month,
            start_year: formData.month_range.start_year,
            end_month: formData.month_range.end_month,
            end_year: formData.month_range.end_year,
          } : null;
          payload.selected_months = formData.selected_months || [];
        } else {
          payload.selected_months = formData.selected_months || [];
          payload.month_range = null;
        }

        await createLoan.mutateAsync(payload);
      }

      setShowModal(false);
      setEditingItem(null);
      setFormData({});
      setSelectedEmployeeSalary(0);
      setLoanValidationErrors([]);
    } catch (error: any) {
    }
  };

  const handleDeleteCompensation = async (id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;

    try {
      await deleteCompensation.mutateAsync(id);
    } catch (error: any) {
    }
  };

  const handleConfirmCompensation = async (id: string) => {
    try {
      await updateCompensationStatus.mutateAsync({ id, status: 'CONFIRM' });
    } catch (error: any) {
      toast.error("Failed to confirm compensation");
    }
  };

  const handleRejectCompensation = async (id: string) => {
    try {
      await updateCompensationStatus.mutateAsync({ id, status: 'REJECT' });
    } catch (error: any) {
      toast.error("Failed to reject compensation");
    }
  };

  const handleConfirmLoan = async (id: string) => {
    try {
      await approveLoan.mutateAsync({ id, approval: 'CONFIRM' });
    } catch (error: any) {
    }
  };

  const handleRejectLoan = async (id: string) => {
    try {
      await approveLoan.mutateAsync({ id, approval: 'REJECTED' });
    } catch (error: any) {
    }
  };

  const handlePayLoanOpen = (loan: any) => {
    setPayLoanItem(loan);
    setFormData({
      ...loan,
      selected_months: loan.selected_months || [],
      month_range: loan.month_range || null,
    });
    setPayLoanModalOpen(true);
  };

  const handlePayLoanSave = async () => {
    try {
      const payload: any = {
        id: payLoanItem.id,
        bank_name: formData.bank_name,
        bank_account_number: formData.bank_account_number,
        bank_iban: formData.bank_iban,
        principal_amount: formData.principal_amount,
        interest_rate: formData.interest_rate,
      };
      if (formData.frequency_type === 'MONTH_RANGE') {
        payload.month_range = formData.month_range ? {
          start_month: formData.month_range.start_month,
          start_year: formData.month_range.start_year,
          end_month: formData.month_range.end_month,
          end_year: formData.month_range.end_year,
        } : null;
        payload.selected_months = formData.selected_months || [];
      } else {
        payload.selected_months = formData.selected_months || [];
        payload.month_range = null;
      }
      await payLoan.mutateAsync(payload);
      setPayLoanModalOpen(false);
      setPayLoanItem(null);
      setFormData({});
    } catch (error: any) {
    }
  };

  const openAddModal = (type: "compensation" | "loan") => {
    setModalType(type);
    setEditingItem(null);
    setFormData({ frequency_type: 'MONTH_RANGE', selected_months: [], month_range: {} });
    setSelectedEmployeeSalary(0);
    setLoanValidationErrors([]);
    setShowModal(true);
  };

  const openEditModal = (type: "compensation" | "loan", item: any) => {
    setModalType(type);
    setEditingItem(item);
    setFormData({
      ...item,
      selected_months: item.selected_months || [],
      month_range: item.month_range || null,
    });

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
      c.employee_code?.toLowerCase().includes(searchQuery.toLowerCase())
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
            <Button
              onClick={() =>
                openAddModal(
                  activeTab === "compensation" ? "compensation" : "loan"
                )
              }
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add {activeTab === "compensation" ? "Compensation" : "Loan"}
            </Button>
          )}
        </div>

        {/* Search + Filters */}
        <div className="bg-card border rounded-xl p-4 mb-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                placeholder="Search employee..."
              />
            </div>

            {activeTab === "loans" && (
              <SearchableSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "PAID", label: "Paid" },
                  { value: "RETURNED", label: "Returned" },
                ]}
                placeholder="All Statuses"
                className="w-[140px]"
              />
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
                ? (id) => handleDeleteCompensation(id)
                : undefined
            }
            onConfirm={
              permissions.update_compensation_status
                ? (id) => handleConfirmCompensation(id)
                : undefined
            }
            onReject={
              permissions.update_compensation_status
                ? (id) => handleRejectCompensation(id)
                : undefined
            }
          />
        </TabsContent>

        <TabsContent value="loans">
          <LoanTab
            filteredLoans={filteredLoans}
            formatCurrency={formatCurrency}
            onConfirm={
              permissions.approve_loan
                ? handleConfirmLoan
                : undefined
            }
            onReject={
              permissions.approve_loan
                ? handleRejectLoan
                : undefined
            }
            onPayLoan={
              permissions.pay_loan
                ? handlePayLoanOpen
                : undefined
            }
          />
        </TabsContent>
      </Tabs>

      {/* Modal */}
      {showModal && canUpdateModal && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent pr-12">
              <DialogTitle>
                {editingItem ? "Edit" : "Add"}{" "}
                {modalType === "compensation" ? "Compensation" : "Loan"}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6">
              {modalType === "compensation" ? (
                <CompensationForm
                  formData={formData}
                  setFormData={setFormData}
                  employeeOptions={employeeOptionsForCompensation}
                  formatCurrency={formatCurrency}
                  employeeJoiningDate={
                    formData.employee_id
                      ? employees.find((e: any) => String(e.id) === String(formData.employee_id))?.joining_date
                      : null
                  }
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
                  employeeJoiningDate={
                    formData.employee_id
                      ? employees.find((e: any) => String(e.id) === String(formData.employee_id))?.joining_date
                      : null
                  }
                />
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3 bg-muted/30">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingItem ? "Update" : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {statusDropdownId && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setStatusDropdownId(null)}
        />
      )}

      {/* Pay Loan Modal */}
      {payLoanModalOpen && payLoanItem && (
        <Dialog open={payLoanModalOpen} onOpenChange={setPayLoanModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent pr-12">
              <DialogTitle>
                Pay Loan - {payLoanItem.employee_name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6">
              <LoanForm
                formData={formData}
                setFormData={setFormData}
                employeeOptions={employeeOptionsForLoan}
                selectedEmployeeSalary={selectedEmployeeSalary}
                formatCurrency={formatCurrency}
                errors={[]}
                onValidationChange={() => {}}
                employeeJoiningDate={
                  formData.employee_id
                    ? employees.find((e: any) => String(e.id) === String(formData.employee_id))?.joining_date
                    : null
                }
              />
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3 bg-muted/30">
              <Button variant="outline" onClick={() => { setPayLoanModalOpen(false); setPayLoanItem(null); setFormData({}); }}>
                Cancel
              </Button>
              <Button onClick={handlePayLoanSave}>
                {payLoan.isPending ? 'Processing...' : 'Confirm Payment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
