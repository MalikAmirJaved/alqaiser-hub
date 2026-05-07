import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useApi } from "./useApi";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export function useAuth() {
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["user"],
    queryFn: () => api<User>("/api/accounts/me/"),
    retry: false,
    staleTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api<{ user: User }>("/api/accounts/login/", {
        method: "POST",
        body: JSON.stringify({ username: email, password }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["user"], data.user);
      router.push("/dashboard");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api("/api/accounts/logout/", { method: "POST" }).catch(() => {}),
    onSuccess: () => {
      queryClient.setQueryData(["user"], null);
      router.push("/login");
    },
  });

  return {
    user,
    ready: !isLoading,
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