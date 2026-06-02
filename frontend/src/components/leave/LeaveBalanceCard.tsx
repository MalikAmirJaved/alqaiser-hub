// components/leave/LeaveBalanceCard.tsx
"use client";

import { Calendar, TrendingUp, TrendingDown, CheckCircle } from "lucide-react";

interface LeaveBalanceCardProps {
  employeeName: string;
  employeeId?: string;
  department?: string;
  leaveType: string;
  allocated: number;
  used: number;
  available: number;
  carriedForward?: number;
}

export function LeaveBalanceCard({
  employeeName,
  employeeId,
  department,
  leaveType,
  allocated,
  used,
  available,
  carriedForward = 0,
}: LeaveBalanceCardProps) {
  const usagePercentage = allocated > 0 ? (used / allocated) * 100 : 0;
  const isLowBalance = available < 5;
  const isCriticalBalance = available < 2;

  const getStatusColor = () => {
    if (isCriticalBalance) return "text-red-600";
    if (isLowBalance) return "text-yellow-600";
    return "text-green-600";
  };

  const getProgressBarColor = () => {
    if (usagePercentage >= 90) return "bg-red-500";
    if (usagePercentage >= 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-base">{leaveType}</h3>
            </div>
            <p className="text-sm font-medium">{employeeName}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>{employeeId}</span>
              {department && (
                <>
                  <span>•</span>
                  <span>{department}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getStatusColor()}`}>{available}</div>
            <div className="text-xs text-muted-foreground">days available</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Usage</span>
            <span>{used} / {allocated} days ({Math.round(usagePercentage)}%)</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor()}`}
              style={{ width: `${usagePercentage}%` }}
            />
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-0.5">Allocated</div>
            <div className="text-sm font-semibold">{allocated} days</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-0.5">Used</div>
            <div className="text-sm font-semibold text-yellow-600">{used} days</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-0.5">Carried Forward</div>
            <div className="text-sm font-semibold">{carriedForward} days</div>
          </div>
        </div>

        {/* Warning Indicator */}
        {isLowBalance && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {isCriticalBalance ? (
              <>
                <TrendingDown className="w-3 h-3 text-red-500" />
                <span className="text-red-600">Critical: Balance running low</span>
              </>
            ) : (
              <>
                <TrendingUp className="w-3 h-3 text-yellow-500" />
                <span className="text-yellow-600">Warning: Low balance</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}