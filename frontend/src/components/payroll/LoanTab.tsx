// components/payroll/LoanTab.tsx
"use client";

import { useRouter } from "next/navigation";
import { Pencil, Trash2, HandCoins, Clock, Eye, MoreHorizontal } from "lucide-react";
import { getFrequencyLabel, getFrequencyBadgeColor } from "./types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface LoanTabProps {
    filteredLoans: any[];
    formatCurrency: (amount: number) => string;
    statusDropdownId: number | null;
    setStatusDropdownId: (id: number | null) => void;
    onEdit?: (loan: any) => void;
    onDelete?: (id: string) => void;
    onStatusChange?: (id: string, status: string) => void;
}

export default function LoanTab({
    filteredLoans,
    formatCurrency,
    statusDropdownId,
    setStatusDropdownId,
    onEdit,
    onDelete,
    onStatusChange
}: LoanTabProps) {
    const router = useRouter();

    const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
        switch (status) {
            case "PAID": return "default";
            case "RETURNED": return "secondary";
            default: return "outline";
        }
    };

    const getStatusClassName = (status: string) => {
        switch (status) {
            case "PAID": return "bg-blue-500/15 text-blue-600 border-blue-500/30 hover:bg-blue-500/20";
            case "RETURNED": return "bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20";
            default: return "bg-gray-500/15 text-gray-600 border-gray-500/30 hover:bg-gray-500/20";
        }
    };

    const getLoanTypeIcon = (type: string) => {
        if (type.includes('CAR')) return '\uD83D\uDE97';
        if (type.includes('HOUSE')) return '\uD83C\uDFE0';
        if (type.includes('EDUCATION')) return '\uD83D\uDCDA';
        if (type.includes('MEDICAL')) return '\uD83C\uDFE5';
        if (type.includes('SALARY')) return '\uD83D\uDCB0';
        if (type.includes('EMERGENCY')) return '\uD83D\uDEA8';
        return '\uD83D\uDCB3';
    };

    const calculateProgress = (remaining: number, totalPayable: number) => {
        if (totalPayable === 0) return 0;
        const paid = totalPayable - remaining;
        return (paid / totalPayable) * 100;
    };

    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="uppercase text-xs tracking-wider">Employee</TableHead>
                        <TableHead className="uppercase text-xs tracking-wider">Loan Type</TableHead>
                        <TableHead className="uppercase text-xs tracking-wider">Principal</TableHead>
                        <TableHead className="uppercase text-xs tracking-wider">Total Payable</TableHead>
                        <TableHead className="uppercase text-xs tracking-wider">Remaining</TableHead>
                        <TableHead className="uppercase text-xs tracking-wider">Progress</TableHead>
                        <TableHead className="uppercase text-xs tracking-wider">Frequency</TableHead>
                        <TableHead className="uppercase text-xs tracking-wider">Status</TableHead>
                        <TableHead className="text-right uppercase text-xs tracking-wider">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredLoans.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                <HandCoins className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                No loan records found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredLoans.map((item) => {
                            const progress = calculateProgress(parseFloat(item.remaining_amount), parseFloat(item.total_payable));
                            return (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="font-medium">{item.employee_name}</div>
                                        <div className="text-xs text-muted-foreground">ID: {item.employee_id}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{getLoanTypeIcon(item.loan_type)}</span>
                                            <span>{item.loan_type_display || item.loan_type}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-semibold">{formatCurrency(parseFloat(item.principal_amount))}</TableCell>
                                    <TableCell>{formatCurrency(parseFloat(item.total_payable))}</TableCell>
                                    <TableCell>{formatCurrency(parseFloat(item.remaining_amount))}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary rounded-full transition-all duration-300"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">{Math.round(progress)}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`gap-1.5 font-normal ${getFrequencyBadgeColor(item)}`}>
                                            <Clock className="w-3 h-3" />
                                            {getFrequencyLabel(item)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {onStatusChange ? (
                                            <DropdownMenu
                                                open={statusDropdownId === item.id}
                                                onOpenChange={(open) => setStatusDropdownId(open ? item.id : null)}
                                            >
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className={`gap-1.5 h-7 px-2.5 text-xs rounded-full font-normal ${getStatusClassName(item.status)}`}
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                        {item.status}
                                                        <MoreHorizontal className="w-3 h-3" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="min-w-[120px]">
                                                    {['PAID', 'RETURNED'].map(status => (
                                                        <DropdownMenuItem
                                                            key={status}
                                                            onClick={() => onStatusChange(item.id, status)}
                                                            className={item.status === status ? 'bg-primary/10 text-primary font-medium' : ''}
                                                        >
                                                            {status}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : (
                                            <Badge variant="outline" className={`font-normal ${getStatusClassName(item.status)}`}>
                                                {item.status}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => router.push(`/hr/compensation/loan/${item.id}`)}
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
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
