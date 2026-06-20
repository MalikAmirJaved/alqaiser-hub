// src/hooks/sales/useSalesInvoices.ts
"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/**
 * Create a sales invoice (SALES module)
 */
export function useCreateSalesInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiFetch("/api/sales/invoices/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_customer_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["sales_dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_variant"] });
    },
  });
}

/**
 * Update a sales invoice (SALES module)
 */
export function useUpdateSalesInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) =>
      apiFetch(`/api/sales/invoices/${id}/`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_customer_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["sales_dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_variant"] });
    },
  });
}
