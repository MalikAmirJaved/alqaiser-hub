// src/lib/api.ts

import { toast } from "sonner";

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL

interface ErrorResponse {
  detail?: string;
  message?: string;
  error?: string;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = options.method?.toUpperCase() || "GET";

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      let errorBody: ErrorResponse = {};
      try {
        errorBody = await res.json();
      } catch {}

      const errorMessage =
        errorBody.detail ||
        errorBody.message ||
        errorBody.error ||
        `Request failed with status ${res.status}`;

      const error = new Error(errorMessage) as any;
      error.status = res.status;
      error.response = errorBody;

      // Show error toast only for mutations
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        toast.error(errorMessage, {
          description: res.status ? `Status: ${res.status}` : undefined,
        });
      }

      throw error;
    }

    const data = await res.json();

    // Success toast for POST, PUT, PATCH, DELETE only
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const successMessage =
        data?.message ||
        data?.detail ||
        (method === "DELETE"
          ? "Deleted successfully"
          : method === "POST"
          ? "Created successfully"
          : "Updated successfully");

      toast.success(successMessage, {
        description: data?.detail || "",
        duration: 4000,
      });
    }

    return data;
  } catch (error: any) {
    // Handle network errors or other unexpected errors
    if (error.name === "TypeError" && !error.status) {
      const networkError = "Network error. Please check your connection.";
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        toast.error(networkError);
      }
      throw new Error(networkError);
    }

    // Re-throw the error so your components can still catch it if needed
    throw error;
  }
}