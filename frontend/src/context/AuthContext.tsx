"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

// ----- Types -----
interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface LoginInput {
  username: string;
  password: string;
}

interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  ready: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

// ----- API client (inline, token from state) -----
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(endpoint: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
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
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(true);   // no session to check, always ready
  const router = useRouter();

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch<LoginResponse>("/api/accounts/login/", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      setAccessToken(data.access);
      setUser(data.user);
      // Refresh token is ignored because we don't persist tokens anywhere else.
      // If you later want persistence, store refresh token in httpOnly cookie or localStorage. 
    },
  });

  const login = useCallback(
    async (email: string, password: string, remember?: boolean) => {
      try {
        // Backend expects "username" field – we pass the email as the username
        await loginMutation.mutateAsync({ username: email, password });
        return { ok: true };
      } catch (error: any) {
        return { ok: false, error: error.message || "Login failed" };
      }
    },
    [loginMutation]
  );

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, accessToken, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

// Optional: a hook that gives you an authenticated fetch function
export const useApi = () => {
  const { accessToken, logout } = useAuth();
  return useCallback(
    async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
      try {
        return await apiFetch<T>(endpoint, options, accessToken);
      } catch (error: any) {
        // If 401, force logout
        if (error.message.includes("401")) logout();
        throw error;
      }
    },
    [accessToken, logout]
  );
};