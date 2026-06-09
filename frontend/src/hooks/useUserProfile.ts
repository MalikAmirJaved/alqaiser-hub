// src/hooks/useUserProfile.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface UserProfile {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  full_name: string;
  branch_id?: string;      
  phone_number?: string;
}

export interface UpdateProfileData extends Partial<UserProfile> {
  password?: string;
  confirm_password?: string;
}

export function useUserProfile() {
  const api = useApi();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["userProfile"],
    queryFn: () => api("/api/organization/profile/"),
  });

  const updateProfile = useMutation({
    mutationFn: (updates: UpdateProfileData) =>
      api("/api/organization/profile/", {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    },
  });

  return {
    profile,
    isLoading,
    updateProfile: updateProfile.mutate,
    isUpdating: updateProfile.isPending,
  };
}