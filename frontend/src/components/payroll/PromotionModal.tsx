// components/payroll/PromotionModal.tsx
"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, TrendingUp } from "lucide-react";

export default function PromotionModal({
  employee,
  isOpen,
  onClose,
  onSuccess,
  formatCurrency,
}: {
  employee: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  formatCurrency: (amount: number) => string;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [newSalary, setNewSalary] = useState(parseFloat(employee?.salary || "0"));
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const currentSalary = parseFloat(employee?.salary || "0");

  const promotionMutation = useMutation({
    mutationFn: (data: any) =>
      api("/api/hr/promotions/", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      onSuccess();
      onClose();
    },
  });

  const handleSubmit = async () => {
    if (newSalary <= 0) return;
    await promotionMutation.mutateAsync({
      employee_id: employee.id,
      new_salary: newSalary,
      effective_date: effectiveDate,
      notes: notes,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Promotion - {employee?.first_name} {employee?.last_name || ""}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-muted/40 rounded-xl p-3 space-y-2">
            <div className="text-xs font-medium text-primary mb-2">Current Salary</div>
            <div className="text-xl font-bold">{formatCurrency(currentSalary)}</div>
          </div>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground font-medium">
              New Salary <span className="text-red-500">*</span>
            </span>
            <input
              type="number"
              value={newSalary}
              onChange={(e) => setNewSalary(Number(e.target.value) || 0)}
              className="bg-background border border-border rounded-md h-10 px-3 text-lg font-bold"
              min="0"
              step="1000"
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground font-medium">Effective Date</span>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="bg-background border border-border rounded-md h-10 px-3"
            />
          </label>

          <label className="text-sm flex flex-col gap-1">
            <span className="text-muted-foreground">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="bg-background border border-border rounded-md p-2"
              placeholder="Promotion reason..."
            />
          </label>

          {newSalary > 0 && newSalary !== currentSalary && (
            <div className="bg-success/10 border border-success/30 rounded-xl p-3 space-y-1">
              <div className="text-xs font-medium text-success">Salary Change</div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Previous</span>
                <span>{formatCurrency(currentSalary)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">New</span>
                <span className="font-bold text-success">{formatCurrency(newSalary)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-success/20 pt-1 mt-1">
                <span className="text-muted-foreground">Difference</span>
                <span className={newSalary > currentSalary ? "text-success font-semibold" : "text-destructive font-semibold"}>
                  {newSalary > currentSalary ? "+" : ""}{formatCurrency(newSalary - currentSalary)}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-md border border-border text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={promotionMutation.isPending || newSalary <= 0 || newSalary === currentSalary}
              className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {promotionMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4" />
                  Apply Promotion
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
