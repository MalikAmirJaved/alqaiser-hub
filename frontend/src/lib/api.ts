// src/lib/api.ts

import { toast } from "sonner";

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
interface ErrorResponse {
  detail?: string;
  message?: string;
  error?: string;
}

const TOKEN_ERROR_PATTERNS = [
  "token",
  "token not valid",
  "not valid for any token",
  "not yet valid",
  "token is expired",
  "token has expired",
  "invalid token",
  "authentication credentials",
  "unauthenticated",
];

function isTokenError(message: string): boolean {
  const lower = message.toLowerCase();
  return TOKEN_ERROR_PATTERNS.some((p) => lower.includes(p));
}

let isClearingSession = false;

async function clearSessionCookies(): Promise<void> {
  if (isClearingSession) return;
  isClearingSession = true;
  try {
    await fetch(`${BASE_URL}/api/accounts/logout/`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // force-clear via expired cookie
    document.cookie =
      "access_token=; path=/; max-age=0; SameSite=Lax";
    document.cookie =
      "refresh_token=; path=/; max-age=0; SameSite=Lax";
  } finally {
    isClearingSession = false;
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = options.method?.toUpperCase() || "GET";

  // APIs where toast should be disabled
  const disableToastEndpoints = [
    "/api/accounts/token/refresh/",
    "/api/inventory/stock/batch-stock/",
    "/api/accounts/login/",
  ];

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
      } catch {}

      const errorMessage =
        errorBody.detail ||
        errorBody.message ||
        errorBody.error ||
        `Request failed with status ${res.status}`;

      // ── Token error → clear cookies, show toast, redirect ──
      if (res.status === 401 && isTokenError(errorMessage)) {
        toast.error("Session expired. Please try again.", {
          duration: 5000,
        });
        await clearSessionCookies();
        localStorage.removeItem("isAuthenticated");
        sessionStorage.clear();
        window.location.href = "/login";
        throw new Error(errorMessage);
      }

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
    if (data?.message || data?.detail) {
      // Success toast
      if (
        shouldShowToast &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(method)
      ) {
        const successMessage = data?.message || data?.detail;
        toast.success(successMessage, {
          description: data?.detail || "",
          duration: 4000,
        });
      }
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
