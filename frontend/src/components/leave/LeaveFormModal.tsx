// /components/leave/LeaveFormModal.tsx
"use client";

import { useState } from "react";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { DateRangePickerRac } from "@/components/reuseable/DateRangePickerRac";
import { X, CalendarDays, AlertCircle } from "lucide-react";

interface LeaveFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  employees: any[];
  leaveTypes: any[];
  leaveBalances: any[];
  isSubmitting: boolean;
}

export function LeaveFormModal({
  isOpen,
  onClose,
  onSubmit,
  employees,
  leaveTypes,
  leaveBalances,
  isSubmitting,
}: LeaveFormModalProps) {
  const [formData, setFormData] = useState({
    employee_id: "",
    leave_type_id: "",
    leave_year: new Date().getFullYear(),
    start_date: "",
    end_date: "",
    is_half_day: "false",
    reason: "",
    contact_number: "",
    document_url: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const getEmployeeBalance = (employeeId: number, leaveTypeId: number) => {
    const balance = leaveBalances.find(
      b => b.employee_id === employeeId && b.leave_type_id === leaveTypeId
    );
    return balance || { allocated: 0, used: 0, available: 0, carry_forward_from: 0 };
  };

  const calculateTotalDays = (startDate: string, endDate: string, isHalfDay: string) => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : start;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return isHalfDay === "true" && diffDays === 1 ? 0.5 : diffDays;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.employee_id) newErrors.employee_id = "Please select an employee";
    if (!formData.leave_type_id) newErrors.leave_type_id = "Please select leave type";
    if (!formData.start_date) newErrors.start_date = "Please select start date";
    if (!formData.reason) newErrors.reason = "Please provide a reason";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
      if (!isSubmitting) {
        setFormData({
          employee_id: "",
          leave_type_id: "",
          leave_year: new Date().getFullYear(),
          start_date: "",
          end_date: "",
          is_half_day: "false",
          reason: "",
          contact_number: "",
          document_url: "",
        });
      }
    }
  };

  if (!isOpen) return null;

  const employeeOptions = employees.map((e: any) => ({
    value: e.id.toString(),
    label: `${e.employee_id} - ${e.first_name} ${e.last_name || ""} (${e.department})`
  }));

  const leaveTypeOptions = leaveTypes.map((t: any) => ({
    value: t.id.toString(),
    label: `${t.name} (${t.defaultDaysPerYear} days/year)`
  }));

  const selectedBalance = formData.employee_id && formData.leave_type_id
    ? getEmployeeBalance(parseInt(formData.employee_id), parseInt(formData.leave_type_id))
    : null;

  const calculatedDays = formData.start_date
    ? calculateTotalDays(formData.start_date, formData.end_date || formData.start_date, formData.is_half_day)
    : 0;

  const hasInsufficientBalance = selectedBalance && calculatedDays > selectedBalance.available;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Apply for Leave
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm flex flex-col gap-1.5">
              <span className="text-muted-foreground">
                Employee <span className="text-red-500">*</span>
              </span>
              <SearchableSelect
                value={formData.employee_id}
                onChange={(val) => setFormData({ ...formData, employee_id: val })}
                options={employeeOptions}
                required
                placeholder="Select Employee"
              />
              {errors.employee_id && (
                <p className="text-xs text-red-500 mt-1">{errors.employee_id}</p>
              )}
            </label>
            <label className="text-sm flex flex-col gap-1.5">
              <span className="text-muted-foreground">Leave Year <span className="text-red-500">*</span></span>
              <input
                type="number"
                value={formData.leave_year}
                onChange={(e) => setFormData({ ...formData, leave_year: parseInt(e.target.value) })}
                className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm flex flex-col gap-1.5">
              <span className="text-muted-foreground">Leave Type <span className="text-red-500">*</span></span>
              <SearchableSelect
                value={formData.leave_type_id}
                onChange={(val) => setFormData({ ...formData, leave_type_id: val })}
                options={leaveTypeOptions}
                required
                placeholder="Select Leave Type"
              />
              {errors.leave_type_id && (
                <p className="text-xs text-red-500 mt-1">{errors.leave_type_id}</p>
              )}
            </label>
            <label className="text-sm flex flex-col gap-1.5">
              <span className="text-muted-foreground">Half Day?</span>
              <select
                value={formData.is_half_day}
                onChange={(e) => setFormData({ ...formData, is_half_day: e.target.value })}
                className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="false">No (Full Day)</option>
                <option value="true">Yes (Half Day)</option>
              </select>
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm flex flex-col gap-1.5">
              <span className="text-muted-foreground">Leave Period <span className="text-red-500">*</span></span>
              <DateRangePickerRac
                startDate={formData.start_date}
                endDate={formData.end_date}
                onChange={(start, end) => {
                  setFormData({ ...formData, start_date: start || "", end_date: end || "" });
                }}
                placeholder="Select leave period"
                required
              />
              {errors.start_date && (
                <p className="text-xs text-red-500 mt-1">{errors.start_date}</p>
              )}
            </label>
          </div>

          <label className="text-sm flex flex-col gap-1.5">
            <span className="text-muted-foreground">Reason <span className="text-red-500">*</span></span>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={3}
              className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Please provide a detailed reason for your leave request..."
            />
            {errors.reason && (
              <p className="text-xs text-red-500 mt-1">{errors.reason}</p>
            )}
          </label>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm flex flex-col gap-1.5">
              <span className="text-muted-foreground">Emergency Contact Number</span>
              <input
                type="tel"
                value={formData.contact_number}
                onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                placeholder="During leave period"
              />
            </label>
            <label className="text-sm flex flex-col gap-1.5">
              <span className="text-muted-foreground">Supporting Document URL</span>
              <input
                type="text"
                value={formData.document_url}
                onChange={(e) => setFormData({ ...formData, document_url: e.target.value })}
                className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                placeholder="Link to medical certificate, etc."
              />
            </label>
          </div>

          {/* Leave Summary */}
          {formData.start_date && formData.leave_type_id && formData.employee_id && selectedBalance && (
            <div className={`rounded-xl p-4 ${hasInsufficientBalance ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium mb-2">Leave Summary</div>
                  <div className="space-y-1 text-sm">
                    <p className={hasInsufficientBalance ? 'text-red-700' : 'text-blue-700'}>
                      <span className="font-medium">Calculated Days:</span> {calculatedDays} {formData.is_half_day === "true" && calculatedDays === 0.5 && "(Half Day)"}
                    </p>
                    <p className={selectedBalance.available < 5 ? 'text-red-600' : 'text-blue-600'}>
                      <span className="font-medium">Available Balance:</span> {selectedBalance.available} days
                    </p>
                    <p className="text-blue-600">
                      <span className="font-medium">Allocated:</span> {selectedBalance.allocated} days | 
                      <span className="font-medium ml-2">Used:</span> {selectedBalance.used} days
                    </p>
                  </div>
                </div>
                {hasInsufficientBalance && (
                  <div className="flex items-center gap-1 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs font-medium">Insufficient Balance</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
          <button
            onClick={onClose}
            className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || hasInsufficientBalance}
            className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}