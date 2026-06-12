// components/leave/ApprovalActions.tsx
"use client";

import { CheckCircle, XCircle, Eye } from "lucide-react";

interface ApprovalActionsProps {
  onApprove: () => void;
  onReject: () => void;
  onView: () => void;
}

export function ApprovalActions({ onApprove, onReject, onView }: ApprovalActionsProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={onApprove}
        className="px-3 py-1.5 rounded-md bg-green-100 text-green-700 text-sm hover:bg-green-200 transition-colors flex items-center gap-1"
        title="Approve"
      >
        <CheckCircle className="w-3.5 h-3.5" /> Approve
      </button>
      <button
        onClick={onReject}
        className="px-3 py-1.5 rounded-md bg-red-100 text-red-700 text-sm hover:bg-red-200 transition-colors flex items-center gap-1"
        title="Reject"
      >
        <XCircle className="w-3.5 h-3.5" /> Reject
      </button>
      <button
        onClick={onView}
        className="p-1.5 rounded-md hover:bg-muted transition-colors"
        title="View Details"
      >
        <Eye className="w-4 h-4" />
      </button>
    </div>
  );
}