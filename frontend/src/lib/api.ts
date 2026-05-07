export const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

interface ErrorResponse {
  detail?: string;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
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

    const error = new Error(
      errorBody.detail || `Request failed with status ${res.status}`
    );

    (error as any).status = res.status;

    throw error;
  }

  return res.json();
}
