"use client";

import { useState, useEffect } from "react";
import { ls } from "@/services/localStorageService";
import {  X,  Wallet } from "lucide-react";

// ============================================
// COMPENSATION LIST MODAL
// ============================================
export default function CompensationListModal({
  formatCurrency,
  employee,
  isOpen,
  onClose
}: {
  formatCurrency: (amount: number) => string;
  employee: any;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [compensations, setCompensations] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && employee) {
      const allCompensations = (ls.get("compensation") || []);
      const employeeCompensations = allCompensations.filter((c: any) => c.employee_id === employee.id);
      setCompensations(employeeCompensations);
    }
  }, [isOpen, employee]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Compensation History - {employee?.first_name} {employee?.last_name || ""}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {compensations.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No compensation records found
            </div>
          ) : (
            <div className="space-y-3">
              {compensations.map((comp) => (
                <div key={comp.id} className={`border rounded-xl p-4 ${comp.status === "ACTIVE" ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Effective Date</div>
                      <div className="font-medium">{new Date(comp.effective_date).toLocaleDateString()}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${comp.status === "ACTIVE" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {comp.status === "ACTIVE" ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Basic Salary</div>
                      <div className="font-medium">{formatCurrency(comp.basic_salary)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">HRA</div>
                      <div>{formatCurrency(comp.house_rent_allowance)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Medical</div>
                      <div>{formatCurrency(comp.medical_allowance)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="font-semibold text-primary">{formatCurrency(comp.total_compensation)}</div>
                    </div>
                  </div>

                  {comp.notes && (
                    <div className="mt-2 text-xs text-muted-foreground">{comp.notes}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}