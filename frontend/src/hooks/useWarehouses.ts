// frontend/src/hooks/useWarehouses.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Warehouse {
  id: string;
  warehouse_name: string;
  code: string;
  employee_id?: string | null;      // UUID of responsible employee
  employee_name?: string | null;    // read‑only from backend
  landline_number?: string | null;
  country: string;
  state: string;
  city: string;
  address_line: string;
  postal_code: string;
  email: string;
  is_active: boolean;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface WarehouseStats {
  total_warehouses: number;
  active_warehouses: number;
  inactive_warehouses: number;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Fetch all warehouses
export function useWarehouses(filters?: {
  search?: string;
  is_active?: boolean;
  country?: string;
  state?: string;
  city?: string;
  page?: string;
}) {
  const api = useApi();
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active));
  if (filters?.country) params.append("country", filters.country);
  if (filters?.state) params.append("state", filters.state);
  if (filters?.city) params.append("city", filters.city);
  if (filters?.page) params.append("page", filters.page);
  const url = `/api/inventory/warehouses/${params.toString() ? `?${params}` : ""}`;

  const query = useQuery<PaginatedResponse<Warehouse>, Error>({
    queryKey: ["inventory_warehouse", filters],
    queryFn: () => api(url),
    staleTime: 30_000,
  });

  return {
    ...query,
    data: query.data?.results ?? [],
    totalCount: query.data?.count ?? 0,
  };
}

// Fetch single warehouse
export function useWarehouse(id: string | null) {
  const api = useApi();
  return useQuery<Warehouse>({
    queryKey: ["warehouse", id],
    queryFn: () => api(`/api/inventory/warehouses/${id}/`),
    enabled: !!id,
  });
}

// Fetch warehouse statistics (simplified)
export function useWarehouseStats() {
  const api = useApi();
  return useQuery<WarehouseStats>({
    queryKey: ["warehouseStats"],
    queryFn: () => api("/api/inventory/warehouses/stats/"),
    staleTime: 60_000,
  });
}

// Create warehouse
export function useCreateWarehouse() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (warehouse: Omit<Warehouse, "id" | "created_at" | "updated_at" | "employee_name">) =>
      api("/api/inventory/warehouses/", {
        method: "POST",
        body: JSON.stringify(warehouse),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["warehouseStats"] });
    },
  });
}

// Update warehouse
export function useUpdateWarehouse() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (warehouse: Partial<Warehouse> & { id: string }) =>
      api(`/api/inventory/warehouses/${warehouse.id}/`, {
        method: "PATCH",
        body: JSON.stringify(warehouse),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["inventory_warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["warehouseStats"] });
    },
  });
}

// Delete warehouse
export function useDeleteWarehouse() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/inventory/warehouses/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["warehouseStats"] });
    },
  });
}