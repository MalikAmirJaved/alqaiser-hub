"use client";

import { Clock, ArrowRight, User } from "lucide-react";
import type { StatusHistoryEntry } from "@/hooks/sales/useLeads";

interface StatusHistoryTimelineProps {
  history: StatusHistoryEntry[];
  isLoading?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  FOLLOW_UP: "Follow Up",
  CONVERTED: "Converted",
  LOST: "Lost",
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export default function StatusHistoryTimeline({ history, isLoading }: StatusHistoryTimelineProps) {
  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading history...</div>;
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Clock className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">No status changes recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />
      <div className="space-y-0">
        {history.map((entry, idx) => {
          const isFirst = idx === 0;
          return (
            <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
              <div className={`relative z-10 mt-1.5 w-[38px] flex items-center justify-center`}>
                <div
                  className={`w-2.5 h-2.5 rounded-full ring-2 ring-background ${
                    isFirst ? "bg-primary" : "bg-muted-foreground/40"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="font-medium text-foreground">
                    {STATUS_LABELS[entry.from_status] || entry.from_status || "(initial)"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className={`font-semibold ${
                    entry.to_status === "LOST" || entry.to_status === "REJECTED"
                      ? "text-destructive"
                      : entry.to_status === "CONVERTED" || entry.to_status === "APPROVED" || entry.to_status === "PAID"
                      ? "text-success"
                      : "text-primary"
                  }`}>
                    {STATUS_LABELS[entry.to_status] || entry.to_status}
                  </span>
                </div>
                {entry.notes && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{entry.notes}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {entry.changed_by_name || "System"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
