// app/(dashboard)/hr/policies/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { usePolicyDetail } from "@/hooks/usePolicies";
import PageHeader from "@/components/PageHeader";
import { 
  ArrowLeft, FileText, Clock, Download
} from "lucide-react";

export default function PolicyDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: policy, isLoading: loading } = usePolicyDetail(id as string | undefined);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"/>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="text-center py-20">
        <h2 className="text-lg font-semibold">Policy not found</h2>
        <button 
          onClick={() => router.push("/hr/policies")}
          className="mt-4 text-primary hover:underline"
        >
          Back to Policies
        </button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: "bg-muted text-muted-foreground border-border",
      PENDING_REVIEW: "bg-warning/15 text-warning border-warning/30",
      APPROVED: "bg-info/15 text-info border-info/30",
      PUBLISHED: "bg-success/15 text-success border-success/30",
      ARCHIVED: "bg-destructive/15 text-destructive border-destructive/30",
      REVOKED: "bg-destructive/15 text-destructive border-destructive/30",
    };
    return colors[status] || colors.DRAFT;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={policy.title}
        subtitle={`${policy.code} - v${policy.version}`}
        actions={
          <button
            onClick={() => router.push("/hr/policies")}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border text-sm hover:bg-muted"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        }
      />

      {/* Status & Actions Bar */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 text-sm rounded-full border ${getStatusColor(policy.status)}`}>
            {policy.status.replace("_", " ")}
          </span>
          <span className="text-sm text-muted-foreground">
            Created by {policy.created_by_name} on {policy.created_at ? new Date(policy.created_at).toLocaleDateString() : "—"}
          </span>
        </div>
        <div className="flex gap-2">
          {policy.document_url && (
            <a
              href={policy.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border text-sm hover:bg-muted"
            >
              <Download className="w-4 h-4" /> Download
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Policy Content */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Policy Content
            </h3>
            <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
              {policy.content}
            </div>
          </div>

          {/* Version History */}
          {policy.versions && policy.versions.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Version History
              </h3>
              <div className="space-y-3">
                {policy.versions.map((version, index) => (
                  <div key={version.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary">v{version.version}</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        Version {version.version}
                        {index === 0 && (
                          <span className="ml-2 text-xs text-success">Current</span>
                        )}
                      </div>
                      {version.change_summary && (
                        <p className="text-xs text-muted-foreground mt-1">{version.change_summary}</p>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {version.changed_by_name && `By: ${version.changed_by_name}`}
                        {version.changed_by_name && ' · '}
                        {new Date(version.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Policy Details */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Details</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Category</label>
                <p className="text-sm">{policy.category}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Department</label>
                <p className="text-sm">{policy.department_name || 'All'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Employee Type</label>
                <p className="text-sm">{policy.employee_type}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
