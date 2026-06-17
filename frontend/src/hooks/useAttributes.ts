import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";

export interface AttributeGroup {
  key: string;
  values: { value: string; label: string }[];
}

export function useAttributes() {
  const api = useApi();
  return useQuery<AttributeGroup[]>({
    queryKey: ["inventory_attributes"],
    queryFn: () => api<AttributeGroup[]>("/api/inventory/attributes/"),
    staleTime: 30 * 1000,
  });
}

export function useCreateAttribute() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { attribute_key: string; attribute_value: string }) =>
      api("/api/inventory/attributes/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_attributes"] });
    },
  });
}
