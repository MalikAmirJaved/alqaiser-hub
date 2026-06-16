// components/payroll/CompensationTab.tsx
"use client";

import { useRouter } from "next/navigation";
import { Pencil, Trash2, TrendingUp, Clock, Eye } from "lucide-react";
import { getFrequencyLabel, getFrequencyBadgeColor } from "./types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CompensationTabProps {
  filteredCompensations: any[];
  formatCurrency: (amount: number) => string;
  onEdit?: (compensation: any) => void;
  onDelete?: (id: string) => void;
}

export default function CompensationTab({ filteredCompensations, formatCurrency, onEdit, onDelete }: CompensationTabProps) {
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
            <TableHead className="text-right uppercase text-xs tracking-wider">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCompensations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
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
                    {onEdit && (
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
                    {onDelete && (
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
