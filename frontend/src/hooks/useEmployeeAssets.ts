// hooks/useEmployeeAssets.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

// ---------- Types ----------
export interface AssetBasic {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  category?: string;
  serial_number?: string;
  available_quantity?: number;   // ← added
}

export interface EmployeeAssetAssignment {
  id: string;
  asset: AssetBasic;
  quantity: number;               // ← added
  source_type: 'DIRECT' | 'KIT';
  source_kit?: {
    id: string;
    name: string;
  };
  assigned_date: string;
  condition: string;
  status: string;
}

export interface AssignedKit {
  id: string;
  name: string;
  description?: string;
  assets: AssetBasic[];
}

export interface AssignmentHistoryEntry {
  id: string;
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
  available_quantity: number;
  total_quantity: number;
  already_assigned_to_employee: boolean;
}

export interface AvailableKit {
  id: string;
  name: string;
  description?: string;
  asset_count: number;
  assets: (AvailableAsset & { already_assigned_to_employee: boolean })[];
}

export interface AvailableAssetsData {
  assets: AvailableAsset[];
  assets_total: number;
  assets_page: number;
  assets_page_size: number;
  kits: AvailableKit[];
  kits_total: number;
  kits_page: number;
  kits_page_size: number;
}

// ---------- Hooks ----------
export function useEmployeeAssignments(employeeId?: string) {
  const api = useApi();
  return useQuery<EmployeeAssignmentsData>({
    queryKey: ["employee-assignments", employeeId],
    queryFn: () => api(`/api/hr/employee-assets/assignments/?employee_id=${employeeId}`),
    enabled: !!employeeId,
    staleTime: 30 * 1000,
  });
}

export function useAvailableAssets(employeeId?: string, params?: Record<string, string>) {
  const api = useApi();
  const queryParts: Record<string, string> = {};
  if (employeeId) queryParts.employee_id = employeeId;
  if (params) Object.assign(queryParts, params);
  const queryString = Object.keys(queryParts).length > 0 ? '?' + new URLSearchParams(queryParts).toString() : '';
  return useQuery<AvailableAssetsData>({
    queryKey: ["available-assets", employeeId, params],
    queryFn: () => api(`/api/hr/employee-assets/available/${queryString}`),
    enabled: !!employeeId,
    staleTime: 30 * 1000,
  });
}

export function useAssignAssets() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      employee_id: string;
      assets?: { asset_id: string; quantity: number }[]; // ← new format
      kit_ids?: string[];
      condition?: string;
      notes?: string;
    }) =>
      api("/api/hr/employee-assets/assignments/", {
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
      assignment_ids: string[];
      condition_on_return?: string;
      return_notes?: string;
    }) =>
      api("/api/hr/employee-assets/assignments/", {
        method: "PATCH",
        body: JSON.stringify({ ...data, action: "return" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["available-assets"] });
    },
  });
}