// types/policy.ts
export interface Policy {
  id: string;
  code: string;
  title: string;
  category: string;
  department: string;
  employee_type: string;
  version: string;
  status: PolicyStatus;
  effective_date: string;
  review_date?: string;
  expiry_date?: string;
  requires_acknowledgment: boolean;
  acknowledgment_deadline?: number;
  document_url?: string;
  content: string;
  change_summary?: string;
  approved_by?: string;
  approved_by_name?: string;
  approval_date?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  acknowledgment_stats?: AcknowledgmentStats;
  acknowledgments?: Acknowledgment[];
  versions?: PolicyVersion[];
}

export type PolicyStatus = 
  | "DRAFT" 
  | "PENDING_REVIEW" 
  | "APPROVED" 
  | "PUBLISHED" 
  | "ARCHIVED" 
  | "REVOKED";

export interface AcknowledgmentStats {
  total_employees?: number;
  acknowledged?: number;
  pending?: number;
  completion_percentage?: number;
  total_acknowledgments?: number;
}

export interface Acknowledgment {
  id: number;
  employee: number;
  employee_name: string;
  employee_id: string;
  acknowledged_at: string;
  acknowledged_via: string;
  notes?: string;
}

export interface PolicyVersion {
  id: number;
  version: string;
  content: string;
  document_url?: string;
  change_summary?: string;
  effective_date: string;
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
  policiesRequiringAck: number;
  totalAcknowledgments: number;
  expiringSoon: number;
  overdueReview: number;
  statusDistribution: Record<string, number>;
  categoryDistribution: Array<{ category: string; count: number }>;
  departmentDistribution: Array<{ department: string; count: number }>;
  updatedAt: string;
}

export interface PolicyFormData {
  code: string;
  title: string;
  category: string;
  department: string;
  employee_type: string;
  version: string;
  status: PolicyStatus;
  effective_date: string;
  review_date?: string;
  expiry_date?: string;
  requires_acknowledgment: boolean;
  acknowledgment_deadline?: number;
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