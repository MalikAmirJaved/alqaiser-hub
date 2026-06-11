// @ts-nocheck
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUpdateEmployee } from "@/hooks/useEmployees";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle } from "lucide-react";

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active", color: "bg-success/15 text-success border-success/30" },
  { value: "ON_LEAVE", label: "On Leave", color: "bg-warning/15 text-warning border-warning/30" },
  { value: "SUSPENDED", label: "Suspended", color: "bg-destructive/15 text-destructive border-destructive/30" },
  { value: "TERMINATED", label: "Terminated", color: "bg-destructive/15 text-destructive border-destructive/30" },
  { value: "RESIGNED", label: "Resigned", color: "bg-muted text-muted-foreground border-muted-foreground/30" },
];

interface EmployeeStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: any;
  onSuccess?: () => void;
}

export default function EmployeeStatusModal({
  open,
  onOpenChange,
  employee,
  onSuccess,
}: EmployeeStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(employee?.employment_status || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateEmployee = useUpdateEmployee();

  const handleStatusChange = async () => {
    if (!selectedStatus || selectedStatus === employee?.employment_status) {
      toast.info("Please select a different status");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateEmployee.mutateAsync({
        id: employee._id || employee.id,
        employment_status: selectedStatus,
      });

      toast.success("Employee status updated successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update employee status");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Change Employee Status
          </DialogTitle>
          <DialogDescription>
            Update the employment status for <span className="font-semibold">{employee?.first_name} {employee?.last_name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Current Status: <span className="font-semibold">{employee?.employment_status}</span>
          </p>

          <div className="grid grid-cols-1 gap-3">
            {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedStatus(option.value)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  selectedStatus === option.value
                    ? `border-primary bg-primary/10`
                    : "border-transparent hover:border-primary/30 bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border inline-flex ${option.color}`}>
                    {option.label}
                  </span>
                  {selectedStatus === option.value && (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {selectedStatus !== employee?.employment_status && selectedStatus && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                This will change the employee's employment status. Make sure you confirm this action.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleStatusChange}
            disabled={isSubmitting || !selectedStatus || selectedStatus === employee?.employment_status}
          >
            {isSubmitting ? "Updating..." : "Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
