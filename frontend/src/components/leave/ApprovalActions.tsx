// components/leave/ApprovalActions.tsx
"use client";

import { CheckCircle, XCircle, Eye } from "lucide-react";
import { getPermissions } from "@/lib/permissions";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
interface ApprovalActionsProps {
  onApprove: () => void;
  onReject: () => void;
  onView: () => void;
}

export function ApprovalActions({ onApprove, onReject, onView }: ApprovalActionsProps) {
      const permissions = useSelector(
  (state: RootState) => state.permissions.permissions
);

const leavePermissions = getPermissions(
  permissions,
  "HR",
  "leave"
);
  return (
    <div className="flex items-center justify-end gap-2">
      {leavePermissions.approve && (
      <button
        onClick={onApprove}
        className="px-3 py-1.5 rounded-md bg-green-100 text-green-700 text-sm hover:bg-green-200 transition-colors flex items-center gap-1"
        title="Approve"
      >
        <CheckCircle className="w-3.5 h-3.5" /> Approve
      </button>
      )}
      {leavePermissions.reject && (
      <button
        onClick={onReject}
        className="px-3 py-1.5 rounded-md bg-red-100 text-red-700 text-sm hover:bg-red-200 transition-colors flex items-center gap-1"
        title="Reject"
      >
        <XCircle className="w-3.5 h-3.5" /> Reject
      </button>
      )}
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