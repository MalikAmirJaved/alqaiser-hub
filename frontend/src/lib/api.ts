// src/lib/api.ts

import { toast } from "sonner";

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

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

  // APIs where toast should be disabled
  const disableToastEndpoints = ["/api/accounts/token/refresh/", "/api/inventory/stock/batch-stock/"];

  const shouldShowToast = !disableToastEndpoints.includes(endpoint);

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
      } catch { }

      const errorMessage =
        errorBody.detail ||
        errorBody.message ||
        errorBody.error ||
        `Request failed with status ${res.status}`;

      const error = new Error(errorMessage) as any;
      error.status = res.status;
      error.response = errorBody;
      // Error toast
      if (
        shouldShowToast &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(method)
      ) {
        toast.error(errorMessage, {
          description: res.status ? `Status: ${res.status}` : undefined,
        });
      }

      throw error;
    }

    const data = await res.json();
      console.log("endpoint and  method",endpoint ,  method)

    // Success toast
    if (
      shouldShowToast &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(method)
    ) {
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
    // Network errors
    if (error.name === "TypeError" && !error.status) {
      const networkError = "Network error. Please check your connection.";

      if (
        shouldShowToast &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(method)
      ) {
        toast.error(networkError);
      }

      throw new Error(networkError);
    }

    throw error;
  }
}