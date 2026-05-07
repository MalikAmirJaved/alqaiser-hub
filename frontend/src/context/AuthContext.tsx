"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ----- Types -----
interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

// ----- API client (cookie‑based, no token in state) -----
const BASE_URL = process.env.NEXT_PUBLIC_API_URL

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include",   // always send cookies
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

// ----- Context -----
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);   // true when initial /me check completes
  const router = useRouter();

  // Call /me on mount to check existing session (cookie)
  useEffect(() => {
  apiFetch<User>("/api/accounts/me/")
    .then((data) => setUser(data))
    .catch(() => {
      setUser(null);
      router.push("/login");
    })
    .finally(() => setReady(true));
}, [router]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const data = await apiFetch<{ user: User }>("/api/accounts/login/", {
        method: "POST",
        body: JSON.stringify({ username: email, password }),
      });
      setUser(data.user);
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error.message || "Login failed" };
    }
  }, []);

  const logout = useCallback(async () => {
    // Clear cookies via server
    await apiFetch("/api/accounts/logout/", { method: "POST" }).catch(() => {});
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

// ------------- Authenticated fetch for other hooks -------------
export const useApi = () => {
  const { logout } = useAuth();
  return useCallback(
    async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
      try {
        return await apiFetch<T>(endpoint, options);
      } catch (error: any) {
        // If 401, force logout
        if (error.message.includes("401")) logout();
        throw error;
      }
    },
    [logout]
  );
};