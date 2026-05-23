// components/payroll/LoanTab.tsx
"use client";

import { useState } from "react";
import { Pencil, Trash2, MoreHorizontal, HandCoins, Calendar, DollarSign, TrendingDown } from "lucide-react";

interface LoanTabProps {
    filteredLoans: any[];
    formatCurrency: (amount: number) => number;
    statusDropdownId: number | null;
    setStatusDropdownId: (id: number | null) => void;
    onEdit: (loan: any) => void;
    onDelete: (id: string) => void;
    onStatusChange: (id: string, status: string) => void;
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
    const getStatusColor = (status: string) => {
        switch (status) {
            case "ACTIVE": return "bg-green-500/15 text-green-600 border-green-500/30";
            case "PAID": return "bg-blue-500/15 text-blue-600 border-blue-500/30";
            case "PENDING": return "bg-yellow-500/15 text-yellow-600 border-yellow-500/30";
            case "CANCELLED": return "bg-red-500/15 text-red-600 border-red-500/30";
            default: return "bg-gray-500/15 text-gray-600 border-gray-500/30";
        }
    };

    const getLoanTypeIcon = (type: string) => {
        if (type.includes('CAR')) return '🚗';
        if (type.includes('HOUSE')) return '🏠';
        if (type.includes('EDUCATION')) return '📚';
        if (type.includes('MEDICAL')) return '🏥';
        if (type.includes('SALARY')) return '💰';
        if (type.includes('EMERGENCY')) return '🚨';
        return '💳';
    };

    const calculateProgress = (remaining: number, principal: number) => {
        if (principal === 0) return 0;
        const paid = principal - remaining;
        return (paid / principal) * 100;
    };

    return (
        <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                    <tr className="text-xs uppercase text-muted-foreground">
                        <th className="text-left px-4 py-3 font-medium">Employee</th>
                        <th className="text-left px-4 py-3 font-medium">Loan Type</th>
                        <th className="text-left px-4 py-3 font-medium">Principal</th>
                        <th className="text-left px-4 py-3 font-medium">Monthly</th>
                        <th className="text-left px-4 py-3 font-medium">Remaining</th>
                        <th className="text-left px-4 py-3 font-medium">Progress</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredLoans.length === 0 && (
                        <tr>
                            <td colSpan={8} className="text-center py-12 text-muted-foreground">
                                <HandCoins className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                No loan records found.
                            </td>
                        </tr>
                    )}
                    {filteredLoans.map((item) => {
                        const progress = calculateProgress(parseFloat(item.remaining_amount), parseFloat(item.principal_amount));
                        return (
                            <tr key={item.id} className="border-b border-border transition-colors hover:bg-muted/30" >
                                <td className="px-4 py-3">
                                    <div className="font-medium">{item.employee_name}</div>
                                    <div className="text-xs text-muted-foreground">ID: {item.employee_id}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{getLoanTypeIcon(item.loan_type)}</span>
                                        <span>{item.loan_type_display || item.loan_type}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 font-semibold">{formatCurrency(parseFloat(item.principal_amount))}</td>
                                <td className="px-4 py-3">{formatCurrency(parseFloat(item.monthly_deduction))}</td>
                                <td className="px-4 py-3">{formatCurrency(parseFloat(item.remaining_amount))}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full transition-all duration-300"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 relative overflow-visible">
                                    <div className="relative">
                                        <button
                                            onClick={() => setStatusDropdownId(statusDropdownId === item.id ? null : item.id)}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border cursor-pointer transition-all hover:scale-105 ${getStatusColor(item.status)}`}
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                            {item.status}
                                            <MoreHorizontal className="w-3 h-3" />
                                        </button>
                                        {statusDropdownId === item.id && (
                                            <div className="absolute top-full mt-1 left-0 bg-popover border border-border rounded-lg shadow-lg z-[9999] py-1 min-w-[120px] animate-in fade-in zoom-in-95 duration-100">                        {['PENDING', 'ACTIVE', 'PAID', 'CANCELLED'].map(status => (
                                                <button
                                                    key={status}
                                                    onClick={() => onStatusChange(item.id, status)}
                                                    className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors ${item.status === status ? 'bg-primary/10 text-primary font-medium' : ''
                                                        }`}
                                                >
                                                    {status}
                                                </button>
                                            ))}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => onEdit(item)}
                                            className="p-1.5 rounded-md hover:bg-muted transition-colors"
                                            title="Edit"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => onDelete(item.id)}
                                            className="p-1.5 rounded-md hover:bg-red-500/10 text-red-500 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}