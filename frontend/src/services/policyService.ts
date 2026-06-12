// services/policyService.ts
import { apiFetch } from "@/lib/api";

export interface PolicyFilters {
  search?: string;
  status?: string;
  category?: string;
  department?: string;
  employeeType?: string;
  requiresAcknowledgment?: boolean;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  page?: number;
  pageSize?: number;
}

export const policyService = {
  async getPolicies(filters: PolicyFilters = {}) {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, String(value));
      }
    });
    
    const queryString = params.toString();
    const endpoint = `/api/hr/policies/${queryString ? `?${queryString}` : ''}`;
    
    return apiFetch<any>(endpoint);
  },

  async getPolicyById(id: string) {
    return apiFetch<any>(`/api/hr/policies/${id}/`);
  },

  async getPolicyStats() {
    return apiFetch<any>("/api/hr/policies/stats/");
  },

  async createPolicy(data: any) {
    return apiFetch<any>("/api/hr/policies/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updatePolicy(id: string, data: any) {
    return apiFetch<any>(`/api/hr/policies/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deletePolicy(id: string) {
    return apiFetch<any>(`/api/hr/policies/${id}/`, {
      method: "DELETE",
    });
  },

  async bulkAction(action: string, policyIds: string[], notes?: string) {
    return apiFetch<any>("/api/hr/policies/bulk-action/", {
      method: "POST",
      body: JSON.stringify({
        action,
        policy_ids: policyIds,
        notes,
      }),
    });
  },

  async getPolicyVersions(policyId: string) {
    return apiFetch<any>(`/api/hr/policies/${policyId}/versions/`);
  },

  async acknowledgePolicy(policyId: string, employeeId: number, notes?: string) {
    return apiFetch<any>(`/api/hr/policies/${policyId}/acknowledge/`, {
      method: "POST",
      body: JSON.stringify({
        employee: employeeId,
        notes,
      }),
    });
  },

  async getPendingAcknowledgments(employeeId: number) {
    return apiFetch<any>(`/api/hr/employees/${employeeId}/pending-acknowledgments/`);
  },

  async getCategories() {
    return apiFetch<any>("/api/hr/policies/categories/");
  },

  async createCategory(data: any) {
    return apiFetch<any>("/api/hr/policies/categories/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};