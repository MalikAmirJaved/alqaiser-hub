"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface TermsData {
  quote: string;
  invoice: string;
}

const TERMS_KEY = ["termsAndConditions"];

export function useTermsAndConditions() {
  const api = useApi();
  const queryClient = useQueryClient();

  const query = useQuery<TermsData>({
    queryKey: TERMS_KEY,
    queryFn: () => api("/api/company/settings/terms/"),
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<TermsData>) =>
      api("/api/company/settings/terms/", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TERMS_KEY });
    },
  });

  return {
    terms: query.data,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    save: mutation.mutateAsync,
    query,
  };
}
