// src/hooks/useBranches.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Branch {
  id: string;          // UUID
  _id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  is_hq: boolean;
  currency_code: string;
  tax_id: string;
}

export interface BranchInput {
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  is_hq?: boolean;
  currency_code?: string;
  tax_id?: string;
}

// Fetch single branch
export function useBranch() {
  const api = useApi();

  return useQuery<Branch>({
    queryKey: ["branch"],
    queryFn: () => api(`/api/organization/branches/detail/`),
    staleTime: 5 * 60 * 1000,
  });
}

// Update branch
export function useUpdateBranch() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BranchInput) =>
      api(`/api/organization/branches/detail/`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch"] });
    },
  });
}

// Create branch (existing)
export function useCreateBranch() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchData: BranchInput) =>
      api("/api/organization/branches/", {
        method: "POST",
        body: JSON.stringify(branchData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });
}