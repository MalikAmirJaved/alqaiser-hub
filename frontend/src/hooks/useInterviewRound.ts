// src/hooks/useInterviewRounds.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface InterviewRound {
  id: string;
  round_number: number;
  round_title: string;
  interview_type: string;
  interview_type_display: string;
  status: "PENDING" | "PASSED" | "FAILED" | "SCHEDULED" | "CANCELLED";
  status_display: string;
  interview_date?: string;
  interviewer?: string;
  interviewer_name?: string;
  interviewer_name_display?: string;
  feedback?: string;
  rating?: number;
  notes?: string;
  meeting_link?: string;
  duration_minutes?: number;
  created_at: string;
  updated_at: string;
}

export function useInterviewRounds(candidateId?: string) {
  const api = useApi();
  
  return useQuery<InterviewRound[]>({
    queryKey: ["interviewRounds", candidateId],
    queryFn: async () => {
      if (!candidateId) {
        throw new Error("Candidate ID is required");
      }
      return api(`/api/hr/recruitment/candidates/${candidateId}/rounds/`);
    },
    enabled: !!candidateId, // Only run query when candidateId is provided
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {
      // Don't retry on 404
      if (error?.status === 404) return false;
      return failureCount < 1;
    },
  });
}

export function useCreateInterviewRound() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ candidateId, roundData }: { candidateId: string; roundData: any }) =>
      api(`/api/hr/recruitment/candidates/${candidateId}/rounds/`, {
        method: "POST",
        body: JSON.stringify(roundData),
      }),
    onSuccess: (_, { candidateId }) => {
      queryClient.invalidateQueries({ queryKey: ["interviewRounds", candidateId] });
    },
  });
}

export function useUpdateInterviewRound() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ candidateId, roundId, data }: { candidateId: string; roundId: string; data: any }) =>
      api(`/api/hr/recruitment/candidates/${candidateId}/rounds/${roundId}/`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { candidateId }) => {
      queryClient.invalidateQueries({ queryKey: ["interviewRounds", candidateId] });
    },
  });
}

export function useDeleteInterviewRound() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ candidateId, roundId }: { candidateId: string; roundId: string }) =>
      api(`/api/hr/recruitment/candidates/${candidateId}/rounds/${roundId}/`, {
        method: "DELETE",
      }),
    onSuccess: (_, { candidateId }) => {
      queryClient.invalidateQueries({ queryKey: ["interviewRounds", candidateId] });
    },
  });
}

export function useBulkCreateRounds() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ candidateId, rounds }: { candidateId: string; rounds: any[] }) =>
      api(`/api/hr/recruitment/candidates/${candidateId}/rounds/bulk/`, {
        method: "POST",
        body: JSON.stringify({ rounds }),
      }),
    onSuccess: (_, { candidateId }) => {
      queryClient.invalidateQueries({ queryKey: ["interviewRounds", candidateId] });
      queryClient.invalidateQueries({ queryKey: ["recruitment"] });
    },
  });
}

export function useBulkUpdateRoundStatus() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ candidateId, updates }: { candidateId: string; updates: Array<{ round_id: string; status: string; feedback?: string; rating?: number; interview_date?: string }> }) =>
      api(`/api/hr/recruitment/candidates/${candidateId}/rounds/bulk-status/`, {
        method: "POST",
        body: JSON.stringify({ updates }),
      }),
    onSuccess: (_, { candidateId }) => {
      queryClient.invalidateQueries({ queryKey: ["interviewRounds", candidateId] });
      queryClient.invalidateQueries({ queryKey: ["recruitment"] });
      queryClient.invalidateQueries({ queryKey: ["recruitmentStats"] });
    },
  });
}