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
// Backward compatible: accepts string (search) or object (filters)
export function useCustomers(filters?: Record<string, string> | string) {
  const api = useApi();
  
  // Support old string-based usage
  if (typeof filters === 'string') {
    filters = { search: filters };
  }
  if (!filters) {
    filters = {};
  }
  
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, val]) => {
    if (val) params.append(key, val);
  });
  const queryString = params.toString();
  const url = `/api/inventory/customers/${queryString ? `?${queryString}` : ""}`;

  const query = useQuery<PaginatedResponse<Customer>, Error>({
    queryKey: ["customers", filters],
    queryFn: () => api<PaginatedResponse<Customer>>(url),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    data: query.data?.results ?? [],
    totalCount: query.data?.count ?? 0,
  };
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

/**
 * Fetch a single customer by ID
 */
export function useCustomer(id: string | undefined) {
  const api = useApi();
  return useQuery<Customer>({
    queryKey: ["customer", id],
    queryFn: () => api(`/api/inventory/customers/${id}/`),
    enabled: !!id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
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

// ── Customer Detail Summary ────────────────────────────────

export interface CustomerDetailRelated {
  leads: Array<{
    id: string;
    first_name: string;
    last_name: string;
    company_name: string;
    email: string;
    phone: string;
    source: string;
    status: string;
    created_at: string | null;
    updated_at: string | null;
  }>;
  quotes: Array<{
    id: string;
    quote_number: string;
    date: string | null;
    expiration_date: string | null;
    total_amount: string;
    overall_discount_percent: string;
    overall_tax_percent: string;
    status: string;
    source: string;
    lead_id: string | null;
    converted_invoice_id: string | null;
    converted_invoice_number: string | null;
    notes: string;
    created_at: string | null;
    updated_at: string | null;
  }>;
  sales_orders: Array<{
    id: string;
    order_number: string;
    order_date: string | null;
    total_amount: string;
    status: string;
    source: string;
    payment_method: string;
    notes: string;
    created_at: string | null;
    updated_at: string | null;
  }>;
  invoices: Array<{
    id: string;
    invoice_number: string;
    invoice_date: string | null;
    due_date: string | null;
    amount: string;
    paid_amount: string;
    outstanding: string;
    overall_discount_percent: string;
    overall_tax_percent: string;
    status: string;
    payment_status: string;
    source: string;
    payment_method: string;
    created_at: string | null;
    updated_at: string | null;
  }>;
}

export interface CustomerFinancialSummary {
  total_invoice_amount: string;
  total_paid: string;
  total_outstanding: string;
  total_discount: string;
  total_tax: string;
  total_orders: number;
  total_quotes: number;
  total_invoices: number;
  total_leads: number;
  total_order_payments: string;
}

export interface CustomerDetailSummary {
  customer: Customer;
  related: CustomerDetailRelated;
  financial_summary: CustomerFinancialSummary;
  source: {
    label: string;
    detail: string | null;
    created_by: string | null;
    created_at: string | null;
    updated_by: string | null;
    updated_at: string | null;
  };
  activity: Array<{
    type: string;
    description: string;
    date: string | null;
    user: string | null;
  }>;
}

export function useCustomerDetailSummary(id: string | undefined) {
  const api = useApi();
  return useQuery<CustomerDetailSummary>({
    queryKey: ["customerDetailSummary", id],
    queryFn: () => api(`/api/inventory/customers/${id}/detail_summary/`),
    enabled: !!id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}