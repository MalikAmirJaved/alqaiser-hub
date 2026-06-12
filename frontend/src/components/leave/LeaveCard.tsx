// components/leave/LeaveCard.tsx
"use client";

import { Calendar, User, CheckCircle, XCircle, Clock, FileText, Eye, Trash2 } from "lucide-react";

interface LeaveCardProps {
  leave: any;
  onView: () => void;
  onCancel?: () => void;
  getStatusBadge: (status: string) => string;
  showApprovalInfo?: boolean;
}

export function LeaveCard({ leave, onView, onCancel, getStatusBadge, showApprovalInfo = true }: LeaveCardProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "REJECTED":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "PENDING":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-all duration-200">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {getStatusIcon(leave.status)}
            <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full border ${getStatusBadge(leave.status)}`}>
              {leave.status}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onView}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>
            {leave.status === "PENDING" && onCancel && (
              <button
                onClick={onCancel}
                className="p-1.5 rounded-md hover:bg-red-100 text-red-600 transition-colors"
                title="Cancel"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Leave Type & Dates */}
        <div className="mb-3">
          <h3 className="font-semibold text-base">{leave.leave_type_name}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(leave.start_date)} → {formatDate(leave.end_date)}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {leave.total_days} day{leave.total_days !== 1 ? 's' : ''}{leave.is_half_day === "true" ? " (Half Day)" : ""}
          </div>
        </div>

        {/* Reason Preview */}
        <div className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {leave.reason}
        </div>

        {/* Approval Information */}
        {showApprovalInfo && leave.status !== "PENDING" && (
          <div className="border-t border-border pt-3 mt-2">
            {leave.status === "APPROVED" && leave.approved_by_name && (
              <div className="flex items-start gap-2 text-sm">
                <User className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs text-muted-foreground">Approved by</span>
                  <p className="text-sm font-medium">{leave.approved_by_name}</p>
                  {leave.approval_date && (
                    <p className="text-xs text-muted-foreground">{formatDateTime(leave.approval_date)}</p>
                  )}
                </div>
              </div>
            )}
            {leave.status === "REJECTED" && (
              <div>
                {leave.approved_by_name && (
                  <div className="flex items-start gap-2 text-sm mb-1">
                    <User className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground">Rejected by</span>
                      <p className="text-sm font-medium">{leave.approved_by_name}</p>
                      {leave.approval_date && (
                        <p className="text-xs text-muted-foreground">{formatDateTime(leave.approval_date)}</p>
                      )}
                    </div>
                  </div>
                )}
                {leave.rejection_reason && (
                  <div className="mt-2 p-2 bg-red-50 rounded-md">
                    <p className="text-xs text-red-700 font-medium">Reason:</p>
                    <p className="text-sm text-red-600">{leave.rejection_reason}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Applied Info */}
        <div className="border-t border-border pt-3 mt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Applied: {formatDateTime(leave.applied_at)}</span>
            {leave.created_by_name && <span>by {leave.created_by_name}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}