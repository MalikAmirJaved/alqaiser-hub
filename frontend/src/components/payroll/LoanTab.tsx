// components/payroll/LoanTab.tsx
"use client";

import { useRouter } from "next/navigation";
import { HandCoins, Clock, Eye, CreditCard, CheckCircle, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getFrequencyLabel, getFrequencyBadgeColor } from "./types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LoanTabProps {
    filteredLoans: any[];
    formatCurrency: (amount: number) => string;
    isLoading?: boolean;
    onConfirm?: (id: string) => void;
    onReject?: (id: string) => void;
    onPayLoan?: (loan: any) => void;
}

export default function LoanTab({
    filteredLoans,
    formatCurrency,
    isLoading,
    onConfirm,
    onReject,
    onPayLoan
}: LoanTabProps) {
    const router = useRouter();

    const getStatusClassName = (status: string) => {
        switch (status) {
            case "UNPAID": return "bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20";
            case "PAID": return "bg-blue-500/15 text-blue-600 border-blue-500/30 hover:bg-blue-500/20";
            case "RETURNED": return "bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20";
            default: return "bg-gray-500/15 text-gray-600 border-gray-500/30 hover:bg-gray-500/20";
        }
    };

    const getApprovalClassName = (approval: string) => {
        switch (approval) {
            case "PENDING": return "bg-yellow-500/15 text-yellow-600 border-yellow-500/30";
            case "CONFIRM": return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
            case "REJECTED": return "bg-red-500/15 text-red-600 border-red-500/30";
            default: return "bg-gray-500/15 text-gray-600 border-gray-500/30";
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
                        <TableHead className="uppercase text-xs tracking-wider">Approval</TableHead>
                        <TableHead className="text-right uppercase text-xs tracking-wider">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto rounded-md" /></TableCell>
                            </TableRow>
                        ))
                    ) : filteredLoans.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                                <HandCoins className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                No loan records found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredLoans.map((item) => {
                            const progress = calculateProgress(parseFloat(item.remaining_amount), parseFloat(item.total_payable));
                            const canPay = item.approval === 'CONFIRM' && item.status === 'UNPAID';
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
                                        <Badge variant="outline" className={`font-normal ${getStatusClassName(item.status)}`}>
                                            {item.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`font-normal ${getApprovalClassName(item.approval)}`}>
                                            {item.approval || 'PENDING'}
                                        </Badge>
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
                                            {canPay && onPayLoan && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs gap-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                                    onClick={() => onPayLoan(item)}
                                                    title="Pay Loan"
                                                >
                                                    <CreditCard className="w-3 h-3" />
                                                    Pay Loan
                                                </Button>
                                            )}
                                            {item.approval === 'PENDING' && (
                                                <>
                                                    {onConfirm && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 text-xs gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"
                                                            onClick={() => onConfirm(item.id)}
                                                            title="Confirm Loan"
                                                        >
                                                            <CheckCircle className="w-3 h-3" />
                                                            Confirm
                                                        </Button>
                                                    )}
                                                    {onReject && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 text-xs gap-1 bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20"
                                                            onClick={() => onReject(item.id)}
                                                            title="Reject Loan"
                                                        >
                                                            <XCircle className="w-3 h-3" />
                                                            Reject
                                                        </Button>
                                                    )}
                                                </>
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
