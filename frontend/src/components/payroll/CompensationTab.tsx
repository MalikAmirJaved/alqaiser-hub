// components/payroll/CompensationTab.tsx
"use client";

import { useRouter } from "next/navigation";
import { Pencil, Trash2, TrendingUp, Clock, Eye, CheckCircle, XCircle } from "lucide-react";
import { getFrequencyLabel, getFrequencyBadgeColor } from "./types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CompensationTabProps {
  filteredCompensations: any[];
  formatCurrency: (amount: number) => string;
  onEdit?: (compensation: any) => void;
  onDelete?: (id: string) => void;
  onConfirm?: (id: string) => void;
  onReject?: (id: string) => void;
}

const getStatusClassName = (status: string) => {
  switch (status) {
    case "PENDING": return "bg-yellow-500/15 text-yellow-600 border-yellow-500/30";
    case "CONFIRM": return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
    case "REJECT": return "bg-red-500/15 text-red-600 border-red-500/30";
    case "FULLYPAID": return "bg-green-500/15 text-green-600 border-green-500/30";
    default: return "bg-gray-500/15 text-gray-600 border-gray-500/30";
  }
};

export default function CompensationTab({ filteredCompensations, formatCurrency, onEdit, onDelete, onConfirm, onReject }: CompensationTabProps) {
  const router = useRouter();
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="uppercase text-xs tracking-wider">Employee</TableHead>
            <TableHead className="uppercase text-xs tracking-wider">Base Salary</TableHead>
            <TableHead className="uppercase text-xs tracking-wider">Allowances</TableHead>
            <TableHead className="uppercase text-xs tracking-wider">Total Monthly</TableHead>
            <TableHead className="uppercase text-xs tracking-wider">Frequency</TableHead>
            <TableHead className="uppercase text-xs tracking-wider">Status</TableHead>
            <TableHead className="text-right uppercase text-xs tracking-wider">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCompensations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                No compensation records found.
              </TableCell>
            </TableRow>
          ) : (
            filteredCompensations.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.employee_name}</div>
                  <div className="text-xs text-muted-foreground">ID: {item.employee_id}</div>
                </TableCell>
                <TableCell className="font-semibold">{formatCurrency(parseFloat(item.basic_salary || "0"))}</TableCell>
                <TableCell>{formatCurrency(parseFloat(item.total_allowances))}</TableCell>
                <TableCell>
                  <span className="font-bold text-primary">{formatCurrency(parseFloat(item.total_monthly))}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`gap-1.5 font-normal ${getFrequencyBadgeColor(item)}`}>
                    <Clock className="w-3 h-3" />
                    {getFrequencyLabel(item)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`font-normal ${getStatusClassName(item.status)}`}>
                    {item.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => router.push(`/hr/compensation/${item.id}`)}
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {item.status === 'PENDING' && onConfirm && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"
                        onClick={() => onConfirm(item.id)}
                        title="Confirm"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Confirm
                      </Button>
                    )}
                    {item.status === 'PENDING' && onReject && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1 bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20"
                        onClick={() => onReject(item.id)}
                        title="Reject"
                      >
                        <XCircle className="w-3 h-3" />
                        Reject
                      </Button>
                    )}
                    {item.status === 'PENDING' && onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(item)}
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    {item.status === 'PENDING' && onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-500 hover:bg-red-500/10"
                        onClick={() => onDelete(item.id)}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
