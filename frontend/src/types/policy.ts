// types/policy.ts
export interface Policy {
  id: string;
  code: string;
  title: string;
  category: string;
  department: string | null;
  department_name?: string;
  employee_type: string;
  version: string;
  status: PolicyStatus;
  document_url?: string;
  content: string;
  change_summary?: string;
  approved_by?: string;
  approved_by_name?: string;
  approval_date?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  versions?: PolicyVersion[];
}

export type PolicyStatus = 
  | "DRAFT" 
  | "PENDING_REVIEW" 
  | "APPROVED" 
  | "PUBLISHED" 
  | "ARCHIVED" 
  | "REVOKED";

export interface PolicyVersion {
  id: number;
  version: string;
  content: string;
  document_url?: string;
  change_summary?: string;
  changed_by_name?: string;
  created_at: string;
}

export interface PolicyStats {
  totalPolicies: number;
  publishedPolicies: number;
  draftPolicies: number;
  pendingReview: number;
  approvedPolicies: number;
  archivedPolicies: number;
  statusDistribution: Record<string, number>;
  categoryDistribution: Array<{ category: string; count: number }>;
  departmentDistribution: Array<{ department: string; count: number }>;
  updatedAt: string;
}

export interface PolicyFormData {
  code: string;
  title: string;
  category: string;
  department: string | null;
  employee_type: string;
  version: string;
  status: PolicyStatus;
  document_url?: string;
  content: string;
  change_summary?: string;
}

export interface BulkActionPayload {
  action: 'publish' | 'archive' | 'delete' | 'approve' | 'submit_for_review';
  policy_ids: string[];
  notes?: string;
}

export interface PolicyCategory {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  sorting_order: number;
  color_code?: string;
  icon?: string;
}
