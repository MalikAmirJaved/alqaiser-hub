// app/(dashboard)/hr/policies/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import PageHeader from "@/components/PageHeader";
import { 
  ArrowLeft, FileText, Users, Clock, CheckCircle, 
  AlertCircle, Download, Eye, Calendar, User
} from "lucide-react";
import { toast } from "sonner";

interface PolicyDetail {
  id: string;
  code: string;
  title: string;
  category: string;
  department: string;
  employee_type: string;
  version: string;
  status: string;
  effective_date: string;
  review_date?: string;
  expiry_date?: string;
  requires_acknowledgment: boolean;
  acknowledgment_deadline?: number;
  document_url?: string;
  content: string;
  change_summary?: string;
  approved_by_name?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  acknowledgment_stats?: {
    total_employees: number;
    acknowledged: number;
    pending: number;
    completion_percentage: number;
  };
  acknowledgments?: Array<{
    id: number;
    employee_name: string;
    employee_id: string;
    acknowledged_at: string;
  }>;
  versions?: Array<{
    id: number;
    version: string;
    change_summary?: string;
    effective_date: string;
    changed_by_name?: string;
    created_at: string;
  }>;
}

export default function PolicyDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const api = useApi();
  const [policy, setPolicy] = useState<PolicyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPolicy();
  }, [id]);

  const loadPolicy = async () => {
    try {
      setLoading(true);
      const data = await api<PolicyDetail>(`/api/hr/policies/${id}/`);
      setPolicy(data);
    } catch (error: any) {
      toast.error("Failed to load policy details");
      router.push("/hr/policies");
    } finally {
      setLoading(false);
    }
  };

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
            Created by {policy.created_by_name} on {new Date(policy.created_at).toLocaleDateString()}
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
                        Effective: {new Date(version.effective_date).toLocaleDateString()}
                        {version.changed_by_name && ` · By: ${version.changed_by_name}`}
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
                <p className="text-sm">{policy.department}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Employee Type</label>
                <p className="text-sm">{policy.employee_type}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Effective Date</label>
                <p className="text-sm">{new Date(policy.effective_date).toLocaleDateString()}</p>
              </div>
              {policy.review_date && (
                <div>
                  <label className="text-xs text-muted-foreground">Review Date</label>
                  <p className="text-sm">{new Date(policy.review_date).toLocaleDateString()}</p>
                </div>
              )}
              {policy.expiry_date && (
                <div>
                  <label className="text-xs text-muted-foreground">Expiry Date</label>
                  <p className="text-sm">{new Date(policy.expiry_date).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Acknowledgment Stats */}
          {policy.requires_acknowledgment && policy.acknowledgment_stats && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Acknowledgments
              </h3>
              
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Completion</span>
                  <span className="font-semibold">{policy.acknowledgment_stats.completion_percentage}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-success rounded-full transition-all"
                    style={{ width: `${policy.acknowledgment_stats.completion_percentage}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-success/10 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-success">
                    {policy.acknowledgment_stats.acknowledged}
                  </div>
                  <div className="text-xs text-muted-foreground">Acknowledged</div>
                </div>
                <div className="bg-warning/10 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-warning">
                    {policy.acknowledgment_stats.pending}
                  </div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </div>
              </div>

              {/* Recent Acknowledgments */}
              {policy.acknowledgments && policy.acknowledgments.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Recent Acknowledgments</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {policy.acknowledgments.slice(0, 5).map(ack => (
                      <div key={ack.id} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-3 h-3 text-success flex-shrink-0" />
                        <span className="flex-1">{ack.employee_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ack.acknowledged_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}