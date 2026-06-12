// components/payroll/CompensationTab.tsx
"use client";

import { useRouter } from "next/navigation";
import { Pencil, Trash2, TrendingUp, Clock, Eye } from "lucide-react";
import { getFrequencyLabel, getFrequencyBadgeColor } from "./types";

interface CompensationTabProps {
  filteredCompensations: any[];
  formatCurrency: (amount: number) => string;
  onEdit?: (compensation: any) => void;
  onDelete?: (id: string) => void;
}

export default function CompensationTab({ filteredCompensations, formatCurrency, onEdit, onDelete }: CompensationTabProps) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 border-b border-border">
          <tr className="text-xs uppercase text-muted-foreground">
            <th className="text-left px-4 py-3 font-medium">Employee</th>
            <th className="text-left px-4 py-3 font-medium">Base Salary</th>
            <th className="text-left px-4 py-3 font-medium">Allowances</th>
            <th className="text-left px-4 py-3 font-medium">Total Monthly</th>
            <th className="text-left px-4 py-3 font-medium">Frequency</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredCompensations.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-12 text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                No compensation records found.
              </td>
            </tr>
          )}
          {filteredCompensations.map((item) => (
            <tr key={item.id} className="border-b border-border hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium">{item.employee_name}</div>
                <div className="text-xs text-muted-foreground">ID: {item.employee_id}</div>
              </td>
              <td className="px-4 py-3 font-semibold">{formatCurrency(parseFloat(item.basic_salary || "0"))}</td>
              <td className="px-4 py-3">{formatCurrency(parseFloat(item.total_allowances))}</td>
              <td className="px-4 py-3">
                <span className="font-bold text-primary">{formatCurrency(parseFloat(item.total_monthly))}</span>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs ${getFrequencyBadgeColor(item)}`}>
                  <Clock className="w-3 h-3" />
                  {getFrequencyLabel(item)}
                </span>
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => router.push(`/hr/compensation/${item.id}`)}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {onEdit && (
                    <button
                      onClick={() => onEdit(item)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(item.id)}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
