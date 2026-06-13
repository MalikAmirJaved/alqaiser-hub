import { useQuery } from "@tanstack/react-query";
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
