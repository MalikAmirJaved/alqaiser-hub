// src/hooks/useCustomers.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Customer extends Record<string, unknown> {
  id: string;
  customer_code: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address_line: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Fetch all customers (paginated)
export function useCustomers(search?: string) {
  const api = useApi();
  const url = search
    ? `/api/inventory/customers/?search=${encodeURIComponent(search)}`
    : "/api/inventory/customers/";

  return useQuery<PaginatedResponse<Customer>, Error, Customer[]>({
    queryKey: ["customers", search],
    queryFn: () => api<PaginatedResponse<Customer>>(url),
    select: (data) => data.results,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// Create customer
export function useCreateCustomer() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Customer, "id" | "created_at" | "updated_at">) => {
      const response = await api<{ status: string; message: string; data: Customer }>(
        "/api/inventory/customers/",
        { method: "POST", body: JSON.stringify(data) }
      );
      // Return the actual customer data from the nested response
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
}


// Update customer
export function useUpdateCustomer() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Customer> }) =>
      api(`/api/inventory/customers/${id}/`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
}

// Delete customer
export function useDeleteCustomer() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/inventory/customers/${id}/`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
}