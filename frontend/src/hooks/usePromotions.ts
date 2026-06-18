// src/hooks/usePromotions.ts
"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface PromotionPayload {
  employee_id: string;
  new_salary: number;
  effective_date: string;
  notes?: string;
}

/**
 * Create a promotion record for an employee
 */
export function useCreatePromotion() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PromotionPayload) =>
      api("/api/hr/promotions/", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}
