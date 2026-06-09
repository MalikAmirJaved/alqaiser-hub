import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { useApi } from "./useApi";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import { setUser, setUnauthenticated, setInitialized } from "@/store/slices/authSlice";
import { useEffect, useState } from "react";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export function useAuth() {
  const api = useApi();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  
  const { user, isAuthenticated, isInitialized } = useSelector((state: RootState) => state.auth);
  const [loading, setLoading] = useState(!isInitialized);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      if (isAuthenticated && !user) {
        try {
          const data = await api<User>("/api/accounts/me/");
          if (mounted) {
            dispatch(setUser(data));
          }
        } catch (error: any) {
          if (mounted) {
            dispatch(setUnauthenticated());
          }
        }
      } else if (!isAuthenticated) {
        if (mounted) {
          dispatch(setInitialized());
        }
      }
      if (mounted) {
        setLoading(false);
      }
    };

    if (!isInitialized) {
      checkAuth();
    } else {
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, user, isInitialized, api, dispatch]);

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api<{ user: User }>("/api/accounts/login/", {
        method: "POST",
        body: JSON.stringify({ username: email, password }),
      }),
    onSuccess: (data) => {
      dispatch(setUser(data.user));
      router.push("/dashboard");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api("/api/accounts/logout/", { method: "POST" }).catch(() => {}),
    onSuccess: () => {
      queryClient.clear();
      dispatch(setUnauthenticated());
      router.push("/login");
    },
  });

  return {
    user,
    ready: !loading,
    login: async (email: string, password: string) => {
      try {
        await loginMutation.mutateAsync({ email, password });
        return { ok: true };
      } catch (error: any) {
        return { ok: false, error: error.message || "Login failed" };
      }
    },
    logout: () => logoutMutation.mutate(),
  };
}