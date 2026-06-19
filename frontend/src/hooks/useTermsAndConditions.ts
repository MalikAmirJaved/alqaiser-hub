import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface TermsAndConditions {
  quote: string;
  invoice: string;
}

const TERMS_ENDPOINT = "/api/company/settings/terms/";

export function useTermsAndConditions() {
  const queryClient = useQueryClient();

  const query = useQuery<TermsAndConditions>({
    queryKey: ["termsAndConditions"],
    queryFn: () => apiFetch<TermsAndConditions>(TERMS_ENDPOINT),
  });

  const mutation = useMutation({
    mutationFn: async (payload: Partial<TermsAndConditions>) => {
      return apiFetch<TermsAndConditions>(TERMS_ENDPOINT, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["termsAndConditions"] });
    },
  });

  return {
    terms: query.data,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    save: mutation.mutateAsync,
  };
}
