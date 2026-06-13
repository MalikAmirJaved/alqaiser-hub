// hooks/useEmployeeAssets.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

// ---------- Types ----------
export interface AssetBasic {
  id: number;
  name: string;
  brand?: string;
  model?: string;
  serial_number?: string;
}

export interface EmployeeAssetAssignment {
  id: number;
  asset: AssetBasic;
  source_type: 'DIRECT' | 'KIT';
  source_kit?: {
    id: number;
    name: string;
  };
  assigned_date: string;
  condition: string;
  status: string;
}

export interface AssignedKit {
  id: number;
  name: string;
  description?: string;
  assets: AssetBasic[];
}

export interface AssignmentHistoryEntry {
  id: number;
  asset_name: string;
  assigned_date: string;
  returned_date?: string;
  status: string;
}

export interface EmployeeAssignmentsData {
  active_assignments: EmployeeAssetAssignment[];
  kits: AssignedKit[];
  history: AssignmentHistoryEntry[];
}

export interface AvailableAsset extends AssetBasic {
  is_assigned: boolean;
  already_assigned_to_employee?: boolean; // used in kits context
}

export interface AvailableKit {
  id: number;
  name: string;
  description?: string;
  asset_count: number;
  assets: (AvailableAsset & { already_assigned_to_employee: boolean })[];
}

export interface AvailableAssetsData {
  assets: AvailableAsset[];
  kits: AvailableKit[];
}

// ---------- Hooks ----------
export function useEmployeeAssignments(employeeId?: number) {
  const api = useApi();
  return useQuery<EmployeeAssignmentsData>({
    queryKey: ["employee-assignments", employeeId],
    queryFn: () => api(`/api/hr/employee-assets/assignments/?employee_id=${employeeId}`),
    enabled: !!employeeId,
    staleTime: 30 * 1000,
  });
}

export function useAvailableAssets(employeeId?: number) {
  const api = useApi();
  const queryString = employeeId ? `?employee_id=${employeeId}` : '';
  return useQuery<AvailableAssetsData>({
    queryKey: ["available-assets", employeeId],
    queryFn: () => api(`/api/hr/employee-assets/available/${queryString}`),
    staleTime: 30 * 1000,
  });
}

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