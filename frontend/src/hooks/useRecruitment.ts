// src/hooks/useRecruitment.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface RecruitmentCandidate {
  id: number;
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  position: string;
  department: string;
  apply_date: string;
  interview_date?: string;
  assigned_to_id?: number;
  assigned_to_name?: string;
  assigned_name?: string;
  stage: "Applied" | "Screening" | "Interview" | "Offer" | "Hired" | "Rejected";
  status: "Active" | "Closed";
  resume_url?: string;
  notes?: string;
  source?: string;
  expected_salary?: number;
  current_company?: string;
  current_position?: string;
  years_of_experience?: number;
  notice_period_days?: number;
  interview_round: number;
  interview_notes?: string;
  interviewers?: string;
  offer_sent_date?: string;
  offer_accepted_date?: string;
  offer_amount?: number;
  joining_date?: string;
  rejection_reason?: string;
  rejection_date?: string;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  updated_by_name?: string;
}

export interface RecruitmentStats {
  total_applicants: number;
  screening: number;
  interviewing: number;
  offer_sent: number;
  hired: number;
  rejected: number;
  by_department: Record<string, number>;
  by_source: Record<string, number>;
  by_month: Array<{ month: string; applications: number; hired: number }>;
}

export function useRecruitment(params?: {
  department?: string;
  stage?: string;
  status?: string;
  source?: string;
  assigned_to?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}) {
  const api = useApi();
  
  const queryString = params 
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';
  
  return useQuery<{ data: RecruitmentCandidate[]; pagination: any }>({
    queryKey: ["recruitment", params],
    queryFn: () => api(`/api/hr/recruitment/candidates/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useRecruitmentStats(params?: { date_from?: string; date_to?: string }) {
  const api = useApi();
  
  const queryString = params 
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';
  
  return useQuery<RecruitmentStats>({
    queryKey: ["recruitmentStats", params],
    queryFn: () => api(`/api/hr/recruitment/stats/${queryString}`),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useCreateRecruitmentCandidate() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (candidate: Omit<RecruitmentCandidate, "id" | "_id" | "created_at" | "updated_at" | "created_by_name" | "updated_by_name" | "assigned_to_name">) =>
      api("/api/hr/recruitment/candidates/", {
        method: "POST",
        body: JSON.stringify(candidate),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment"] });
      queryClient.invalidateQueries({ queryKey: ["recruitmentStats"] });
    },
  });
}

export function useUpdateRecruitmentCandidate() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (candidate: Partial<RecruitmentCandidate> & { id: number }) =>
      api("/api/hr/recruitment/candidates/", {
        method: "PATCH",
        body: JSON.stringify(candidate),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment"] });
      queryClient.invalidateQueries({ queryKey: ["recruitmentStats"] });
    },
  });
}

export function useDeleteRecruitmentCandidate() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) =>
      api("/api/hr/recruitment/candidates/", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment"] });
      queryClient.invalidateQueries({ queryKey: ["recruitmentStats"] });
    },
  });
}

export function useRecruitmentBulkAction() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ action, candidate_ids, new_stage, assigned_to_id }: { 
      action: string; 
      candidate_ids: number[]; 
      new_stage?: string; 
      assigned_to_id?: number;
    }) =>
      api("/api/hr/recruitment/bulk-action/", {
        method: "POST",
        body: JSON.stringify({ action, candidate_ids, new_stage, assigned_to_id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment"] });
      queryClient.invalidateQueries({ queryKey: ["recruitmentStats"] });
    },
  });
}

export function useRecruitmentActivities(candidateId?: number, params?: {
  action?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}) {
  const api = useApi();
  
  const endpoint = candidateId 
    ? `/api/hr/recruitment/activities/${candidateId}/`
    : '/api/hr/recruitment/activities/';
  
  const queryString = params 
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';
  
  return useQuery({
    queryKey: ["recruitmentActivities", candidateId, params],
    queryFn: () => api(`${endpoint}${queryString}`),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}