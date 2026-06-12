// components/leave/LeaveDetailDrawer.tsx
"use client";

import { X, Calendar, User, FileText, Phone, Link, CheckCircle, XCircle, Clock, UserCheck } from "lucide-react";

interface LeaveDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  leave: any;
  onApprove?: () => void;
  onReject?: () => void;
  canApprove?: boolean;
  getStatusBadge: (status: string) => string;
}

export function LeaveDetailDrawer({
  isOpen,
  onClose,
  leave,
  onApprove,
  onReject,
  canApprove,
  getStatusBadge,
}: LeaveDetailDrawerProps) {
  if (!isOpen || !leave) return null;

  const DetailRow = ({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: any }) => (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
      <div className="flex-1">
        <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
        <div className="text-sm font-medium">{value || "—"}</div>
      </div>
    </div>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-4">
      <h3 className="text-sm font-semibold mb-2 text-muted-foreground">{title}</h3>
      {children}
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-xl z-50 transform transition-transform duration-300 ease-in-out">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h2 className="font-semibold text-lg">Leave Request Details</h2>
              <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full border ${getStatusBadge(leave.status)} mt-1`}>
                {leave.status}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Basic Information */}
            <Section title="Basic Information">
              <DetailRow label="Leave Type" value={leave.leave_type_name} icon={Calendar} />
              <DetailRow
                label="Period"
                value={`${leave.start_date} → ${leave.end_date}`}
                icon={Calendar}
              />
              <DetailRow
                label="Total Days"
                value={`${leave.total_days}${leave.is_half_day === "true" ? " (Half Day)" : ""}`}
                icon={Clock}
              />
              <DetailRow label="Applied On" value={new Date(leave.applied_at).toLocaleDateString()} />
            </Section>

            {/* Employee Information */}
            <Section title="Employee Information">
              <DetailRow label="Employee Name" value={leave.employee_name} icon={User} />
              <DetailRow label="Employee ID" value={leave.employee_id} />
            </Section>

            {/* Leave Reason */}
            <Section title="Leave Reason">
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{leave.reason}</p>
                </div>
              </div>
            </Section>

            {/* Contact & Documents */}
            {(leave.contact_number || leave.document_url) && (
              <Section title="Additional Information">
                {leave.contact_number && (
                  <DetailRow label="Emergency Contact" value={leave.contact_number} icon={Phone} />
                )}
                {leave.document_url && (
                  <DetailRow
                    label="Supporting Document"
                    value={
                      <a
                        href={leave.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <Link className="w-3 h-3" />
                        View Document
                      </a>
                    }
                    icon={Link}
                  />
                )}
              </Section>
            )}

            {/* Approval Information */}
            {(leave.rejection_reason || leave.approved_by) && (
              <Section title="Approval Information">
                {leave.status === "REJECTED" && leave.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-medium text-red-700 mb-1">Rejection Reason</div>
                        <p className="text-sm text-red-600">{leave.rejection_reason}</p>
                      </div>
                    </div>
                  </div>
                )}
                {leave.status === "APPROVED" && (
                  <>
                    <DetailRow label="Approved By" value={leave.approved_by} icon={UserCheck} />
                    <DetailRow
                      label="Approved On"
                      value={new Date(leave.approval_date).toLocaleDateString()}
                    />
                  </>
                )}
              </Section>
            )}
          </div>

          {/* Footer Actions */}
          {canApprove && leave.status === "PENDING" && (
            <div className="p-4 border-t border-border flex gap-2">
              <button
                onClick={onApprove}
                className="flex-1 px-4 h-9 rounded-md bg-green-600 text-white text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Approve
              </button>
              <button
                onClick={onReject}
                className="flex-1 px-4 h-9 rounded-md bg-red-600 text-white text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </div>
          )}

          {leave.status !== "PENDING" && (
            <div className="p-4 border-t border-border">
              <button
                onClick={onClose}
                className="w-full px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}