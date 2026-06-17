// src/hooks/usePolicies.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

// ==========================================
// TYPES
// ==========================================
export interface PolicyRecord {
  id: string;
  code: string;
  title: string;
  category: string;
  department: string | null;
  department_name?: string;
  employee_type: string;
  version: string;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED" | "REVOKED";
  document_url?: string;
  content: string;
  approved_by?: string | null;
  approved_by_name?: string;
  approval_date?: string;
  change_summary?: string;
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PolicyDetail extends PolicyRecord {
  versions?: Array<{
    id: number;
    version: string;
    content: string;
    document_url?: string;
    change_summary?: string;
    changed_by_name?: string;
    created_at: string;
  }>;
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

export interface PolicyFilters {
  search?: string;
  status?: string;
  category?: string;
  department?: string;
  employeeType?: string;
  sortBy?: string;
  page?: number;
  pageSize?: number;
}

export interface PolicyFormData {
  code: string;
  title: string;
  category: string;
  department: string | null;
  employee_type: string;
  version: string;
  status: PolicyRecord['status'];
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

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ==========================================
// QUERY HOOKS
// ==========================================

/**
 * Fetch paginated list of policies with optional filters
 */
export function usePolicies(filters?: PolicyFilters) {
  const api = useApi();
  
  const queryParams = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });
  }
  
  const queryString = queryParams.toString();
  
  return useQuery<PaginatedResponse<PolicyRecord>>({
    queryKey: ["policies", filters],
    queryFn: () => api(`/api/hr/policies/${queryString ? `?${queryString}` : ''}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch a single policy by ID with full details
 */
export function usePolicyDetail(policyId: string | undefined) {
  const api = useApi();
  
  return useQuery<PolicyDetail>({
    queryKey: ["policy", policyId],
    queryFn: () => api(`/api/hr/policies/${policyId}/`),
    enabled: !!policyId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch policy statistics for dashboard
 */
export function usePolicyStats() {
  const api = useApi();
  
  return useQuery<PolicyStats>({
    queryKey: ["policyStats"],
    queryFn: () => api("/api/hr/policies/stats/"),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch policy versions for a specific policy
 */
export function usePolicyVersions(policyId: string | undefined) {
  const api = useApi();
  
  return useQuery({
    queryKey: ["policyVersions", policyId],
    queryFn: () => api(`/api/hr/policies/${policyId}/versions/`),
    enabled: !!policyId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch custom policy categories
 */
export function usePolicyCategories() {
  const api = useApi();
  
  return useQuery<PolicyCategory[]>({
    queryKey: ["policyCategories"],
    queryFn: () => api("/api/hr/policies/categories/"),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

// ==========================================
// MUTATION HOOKS
// ==========================================

/**
 * Create a new policy
 */
export function useCreatePolicy() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PolicyFormData) =>
      api("/api/hr/policies/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      queryClient.invalidateQueries({ queryKey: ["policyStats"] });
    },
  });
}

/**
 * Update an existing policy
 */
export function useUpdatePolicy() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PolicyFormData> }) =>
      api(`/api/hr/policies/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      queryClient.invalidateQueries({ queryKey: ["policy", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["policyStats"] });
    },
  });
}

/**
 * Delete (soft delete) a policy
 */
export function useDeletePolicy() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/hr/policies/${id}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      queryClient.invalidateQueries({ queryKey: ["policyStats"] });
    },
  });
}

/**
 * Perform bulk actions on multiple policies
 */
export function useBulkPolicyAction() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BulkActionPayload) =>
      api("/api/hr/policies/bulk-action/", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      queryClient.invalidateQueries({ queryKey: ["policyStats"] });
    },
  });
}

/**
 * Create a custom policy category
 */
export function useCreatePolicyCategory() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<PolicyCategory>) =>
      api("/api/hr/policies/categories/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policyCategories"] });
    },
  });
}

// ==========================================
// COMPOSITE HOOK (Optional convenience hook)
// ==========================================

/**
 * Convenience hook that bundles all policy operations together
 */
export function usePolicyOperations() {
  const queries = {
    policies: usePolicies,
    policyDetail: usePolicyDetail,
    stats: usePolicyStats,
    versions: usePolicyVersions,
    categories: usePolicyCategories,
  };

  const mutations = {
    createPolicy: useCreatePolicy(),
    updatePolicy: useUpdatePolicy(),
    deletePolicy: useDeletePolicy(),
    bulkAction: useBulkPolicyAction(),
    createCategory: useCreatePolicyCategory(),
  };

  return {
    queries,
    mutations,
    
    isCreating: mutations.createPolicy.isPending,
    isUpdating: mutations.updatePolicy.isPending,
    isDeleting: mutations.deletePolicy.isPending,
    isBulkProcessing: mutations.bulkAction.isPending,
  };
}
