// /components/leave/LeaveFormModal.tsx
"use client";

import { useState } from "react";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { DateRangePickerRac } from "@/components/reuseable/DateRangePickerRac";
import { X, CalendarDays } from "lucide-react";
import { LEAVE_TYPES } from "@/hooks/useLeaves";

interface LeaveFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  employees: any[];
  isSubmitting: boolean;
}

export function LeaveFormModal({
  isOpen,
  onClose,
  onSubmit,
  employees,
  isSubmitting,
}: LeaveFormModalProps) {
  const [formData, setFormData] = useState({
    employee_id: "",
    leave_type: "CASUAL",
    start_date: "",
    end_date: "",
    is_half_day: false,
    reason: "",
    emergency_contact: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const calculateTotalDays = (startDate: string, endDate: string, isHalfDay: boolean) => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : start;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return isHalfDay && diffDays === 1 ? 0.5 : diffDays;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.employee_id) newErrors.employee_id = "Please select an employee";
    if (!formData.leave_type) newErrors.leave_type = "Please select leave type";
    if (!formData.start_date) newErrors.start_date = "Please select start date";
    if (!formData.reason) newErrors.reason = "Please provide a reason";

    // Validate date ordering: end date must not be before start date
    if (formData.start_date && formData.end_date) {
      try {
        const s = new Date(formData.start_date);
        const e = new Date(formData.end_date);
        if (e < s) {
          newErrors.end_date = 'End date cannot be before start date';
        }
      } catch (e) {
        newErrors.start_date = 'Invalid date values';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
      if (!isSubmitting) {
        setFormData({
          employee_id: "",
          leave_type: "CASUAL",
          start_date: "",
          end_date: "",
          is_half_day: false,
          reason: "",
          emergency_contact: "",
        });
      }
    }
  };

  if (!isOpen) return null;

  const employeeOptions = employees.map((e: any) => ({
    value: e.id,
    label: `${e.employee_id} - ${e.first_name} ${e.last_name || ""} (${e.department_name || e.department || ""})`
  }));

  const leaveTypeOptions = LEAVE_TYPES.map((t) => ({
    value: t.value,
    label: t.label
  }));

  const calculatedDays = formData.start_date
    ? calculateTotalDays(formData.start_date, formData.end_date || formData.start_date, formData.is_half_day)
    : 0;

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
              <span className="text-muted-foreground">Leave Type <span className="text-red-500">*</span></span>
              <SearchableSelect
                value={formData.leave_type}
                onChange={(val) => setFormData({ ...formData, leave_type: val })}
                options={leaveTypeOptions}
                required
                placeholder="Select Leave Type"
              />
              {errors.leave_type && (
                <p className="text-xs text-red-500 mt-1">{errors.leave_type}</p>
              )}
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm flex flex-col gap-1.5">
              <span className="text-muted-foreground">Half Day?</span>
              <select
                value={formData.is_half_day ? "true" : "false"}
                onChange={(e) => setFormData({ ...formData, is_half_day: e.target.value === "true" })}
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
              {errors.end_date && (
                <p className="text-xs text-red-500 mt-1">{errors.end_date}</p>
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
                value={formData.emergency_contact}
                onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value.replace(/[^0-9+]/g, "").slice(0, 20) })}
                maxLength={15}
                className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                placeholder="During leave period"
              />
            </label>
          </div>

          {/* Leave Summary */}
          {formData.start_date && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="text-sm font-medium mb-2">Leave Summary</div>
              <div className="space-y-1 text-sm">
                <p className="text-blue-700">
                  <span className="font-medium">Calculated Days:</span> {calculatedDays} {formData.is_half_day && calculatedDays === 0.5 && "(Half Day)"}
                </p>
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
            disabled={isSubmitting}
            className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}