"use client";
import { useState } from "react";
import { ls, uid } from "@/services/localStorageService";
import { permissionService } from "@/services/permissionService";
import {  X,  CheckCircle,  Wallet } from "lucide-react";
import { DatePicker } from "../DatePicker";

// ============================================
// COMPENSATION MODAL
// ============================================
export default function CompensationModal({
  employee,
  formatCurrency,
  isOpen,
  onClose,
  onSuccess
}: {
  formatCurrency: (amount: number) => string;
  employee: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    basic_salary: employee?.salary || 0,
    house_rent_allowance: 0,
    medical_allowance: 0,
    transport_allowance: 0,
    utilities_allowance: 0,
    education_allowance: 0,
    other_allowances: 0,
    overtime_rate: 0,
    bonus_percentage: 0,
    effective_date: new Date().toISOString().slice(0, 10),
    notes: ""
  });
  const [loading, setLoading] = useState(false);

  const totalCompensation = formData.basic_salary +
    formData.house_rent_allowance +
    formData.medical_allowance +
    formData.transport_allowance +
    formData.utilities_allowance +
    formData.education_allowance +
    formData.other_allowances;

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const compensations = (ls.get("compensation") || []);
      const newCompensation = {
        id: uid("comp"),
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name || ""}`,
        employee_code: employee.employee_id,
        department: employee.department,
        designation: employee.designation,
        ...formData,
        total_compensation: totalCompensation,
        status: "ACTIVE",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        company_id: employee.company_id,
        branch_id: employee.branch_id,
        created_by: permissionService.getCurrentUser()?.id
      };

      // Deactivate old compensation
      const updatedCompensations = compensations.map((c: any) =>
        c.employee_id === employee.id ? { ...c, status: "INACTIVE", updated_at: new Date().toISOString() } : c
      );

      ls.set("compensation", [newCompensation, ...updatedCompensations]);

      // Update employee's salary
      const employees = (ls.get("employees") || []);
      const updatedEmployees = employees.map((e: any) =>
        e.id === employee.id
          ? { ...e, salary: totalCompensation, compensation_id: newCompensation.id }
          : e
      );
      ls.set("employees", updatedEmployees);

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving compensation:", error);
      alert("Error saving compensation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Compensation Structure - {employee?.first_name} {employee?.last_name || ""}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Employee Info */}
          <div className="bg-muted/40 rounded-xl p-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Employee ID</div>
              <div className="font-medium">{employee?.employee_id}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Department</div>
              <div className="font-medium">{employee?.department}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Designation</div>
              <div className="font-medium">{employee?.designation || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Effective Date</div>
              <DatePicker
                value={formData.effective_date}
                onChange={(value) => setFormData({ ...formData, effective_date: value })}
                className="bg-muted/40 border border-border rounded-md h-8 px-2 text-sm"
              />
            </div>
          </div>

          {/* Salary Components */}
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Basic Salary *</span>
              <input
                type="number"
                value={formData.basic_salary}
                onChange={(e) => setFormData({ ...formData, basic_salary: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">House Rent Allowance (HRA)</span>
              <input
                type="number"
                value={formData.house_rent_allowance}
                onChange={(e) => setFormData({ ...formData, house_rent_allowance: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Medical Allowance</span>
              <input
                type="number"
                value={formData.medical_allowance}
                onChange={(e) => setFormData({ ...formData, medical_allowance: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Transport Allowance</span>
              <input
                type="number"
                value={formData.transport_allowance}
                onChange={(e) => setFormData({ ...formData, transport_allowance: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Utilities Allowance</span>
              <input
                type="number"
                value={formData.utilities_allowance}
                onChange={(e) => setFormData({ ...formData, utilities_allowance: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Education Allowance</span>
              <input
                type="number"
                value={formData.education_allowance}
                onChange={(e) => setFormData({ ...formData, education_allowance: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Other Allowances</span>
              <input
                type="number"
                value={formData.other_allowances}
                onChange={(e) => setFormData({ ...formData, other_allowances: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Overtime Rate (per hour)</span>
              <input
                type="number"
                value={formData.overtime_rate}
                onChange={(e) => setFormData({ ...formData, overtime_rate: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
                placeholder="Hourly rate for overtime"
              />
            </label>

            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted-foreground">Bonus Percentage (%)</span>
              <input
                type="number"
                value={formData.bonus_percentage}
                onChange={(e) => setFormData({ ...formData, bonus_percentage: Number(e.target.value) || 0 })}
                className="bg-muted/40 border border-border rounded-md h-10 px-3 outline-none focus:ring-2 focus:ring-ring"
                placeholder="Annual bonus % of basic"
              />
            </label>
          </div>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Notes</span>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="bg-muted/40 border border-border rounded-md p-2 outline-none focus:ring-2 focus:ring-ring"
              placeholder="Additional notes about compensation structure..."
            />
          </label>

          {/* Total Summary */}
          <div className="bg-primary/10 rounded-xl p-4">
            <div className="text-sm font-medium text-primary mb-2">Total Monthly Compensation</div>
            <div className="text-3xl font-bold text-primary">{formatCurrency(totalCompensation)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              This will be used as the base salary for all future payroll calculations
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 h-10 rounded-md border border-border text-sm hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 h-10 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Save Compensation
          </button>
        </div>
      </div>
    </div>
  );
}