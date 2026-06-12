// hooks/useEmployeeAssets.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface EmployeeAssetAssignment {
  id: number;
  asset: {
    id: number;
    name: string;
    brand?: string;
    model?: string;
    serial_number?: string;
  };
  source_type: 'DIRECT' | 'KIT';
  source_kit?: {
    id: number;
    name: string;
  };
  assigned_date: string;
  condition: string;
  status: string;
}

export interface AvailableAsset {
  id: number;
  name: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  is_assigned: boolean;
}

export interface AvailableKit {
  id: number;
  name: string;
  description?: string;
  asset_count: number;
  assets: (AvailableAsset & { already_assigned_to_employee: boolean })[];
}

// Fetch employee assignments
export function useEmployeeAssignments(employeeId?: number) {
  const api = useApi();
  return useQuery({
    queryKey: ["employee-assignments", employeeId],
    queryFn: () => api(`/api/hr/employee-assets/assignments/?employee_id=${employeeId}`),
    enabled: !!employeeId,
    staleTime: 30 * 1000,
  });
}

// Fetch available assets & kits
export function useAvailableAssets(employeeId?: number) {
  const api = useApi();
  const queryString = employeeId ? `?employee_id=${employeeId}` : '';
  return useQuery({
    queryKey: ["available-assets", employeeId],
    queryFn: () => api(`/api/hr/employee-assets/available/${queryString}`),
    staleTime: 30 * 1000,
  });
}

// Assign assets/kits
export function useAssignAssets() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      employee_id: number;
      asset_ids?: number[];
      kit_ids?: number[];
      condition?: string;
      notes?: string;
    }) => api("/api/hr/employee-assets/assignments/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["available-assets"] });
    },
  });
}

// Return assets
export function useReturnAssets() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      assignment_ids: number[];
      condition_on_return?: string;
      return_notes?: string;
    }) => api("/api/hr/employee-assets/assignments/", {
      method: "PATCH",
      body: JSON.stringify({ ...data, action: 'return' }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["available-assets"] });
    },
  });
}