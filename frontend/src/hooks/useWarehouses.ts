// src/hooks/useWarehouses.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface Warehouse {
  id: number;
  warehouse_name: string;
  code: string;
  manager_name: string;
  phone: string;
  capacity: number;
  current_occupancy: number;
  available_capacity: number;
  occupancy_percentage: number;
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
  total_capacity: number;
  total_occupancy: number;
  overall_occupancy_percentage: number;
}

// Fetch all warehouses
export function useWarehouses(filters?: { search?: string; is_active?: boolean; country?: string; city?: string }) {
  const api = useApi();
  
  let url = "/api/inventory/warehouses/";
  const params = new URLSearchParams();
  
  if (filters?.search) params.append('search', filters.search);
  if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
  if (filters?.country) params.append('country', filters.country);
  if (filters?.city) params.append('city', filters.city);
  
  const queryString = params.toString();
  if (queryString) url += `?${queryString}`;
  
  return useQuery<Warehouse[]>({
    queryKey: ["warehouses", filters],
    queryFn: () => api(url),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// Fetch single warehouse
export function useWarehouse(id: number | null) {
  const api = useApi();
  
  return useQuery<Warehouse>({
    queryKey: ["warehouse", id],
    queryFn: () => api(`/api/inventory/warehouses/${id}/`),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

// Fetch warehouse statistics
export function useWarehouseStats() {
  const api = useApi();
  
  return useQuery<WarehouseStats>({
    queryKey: ["warehouseStats"],
    queryFn: () => api("/api/inventory/warehouses/stats/"),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Fetch warehouse utilization
export function useWarehouseUtilization(id: number | null) {
  const api = useApi();
  
  return useQuery({
    queryKey: ["warehouseUtilization", id],
    queryFn: () => api(`/api/inventory/warehouses/${id}/utilization/`),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

// Create warehouse
export function useCreateWarehouse() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (warehouse: Omit<Warehouse, "id" | "created_at" | "updated_at" | "available_capacity" | "occupancy_percentage">) =>
      api("/api/inventory/warehouses/", {
        method: "POST",
        body: JSON.stringify(warehouse),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["warehouseStats"] });
    },
  });
}

// Update warehouse
export function useUpdateWarehouse() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (warehouse: Partial<Warehouse> & { id: number }) =>
      api(`/api/inventory/warehouses/${warehouse.id}/`, {
        method: "PATCH",
        body: JSON.stringify(warehouse),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
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
    mutationFn: (id: number) =>
      api(`/api/inventory/warehouses/${id}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["warehouseStats"] });
    },
  });
}