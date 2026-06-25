"use client";

import { useCallback, useRef } from "react";
import { useApi } from "@/hooks/useApi";
import type { SearchableSelectOption } from "@/components/reuseable/SearchableSelect";

interface UseServerSearchOptions {
  pageSize?: number;
  searchParam?: string;
  extraParams?: Record<string, string>;
  transformOption: (item: any) => SearchableSelectOption;
}

interface ApiResponse {
  results?: any[];
  count?: number;
  [key: string]: any;
}

export function useServerSearch(
  endpoint: string,
  options: UseServerSearchOptions
) {
  const api = useApi();
  const {
    pageSize = 20,
    searchParam = "search",
    extraParams = {},
    transformOption,
  } = options;

  const endpointRef = useRef(endpoint);
  endpointRef.current = endpoint;

  const transformOptionRef = useRef(transformOption);
  transformOptionRef.current = transformOption;

  const extraParamsRef = useRef(extraParams);
  extraParamsRef.current = extraParams;

  const fetchOptions = useCallback(
    async (params: {
      search: string;
      page: number;
      pageSize: number;
    }) => {
      const url = new URL(endpointRef.current, window.location.origin);

      if (params.search) {
        url.searchParams.set(searchParam, params.search);
      }
      url.searchParams.set("page", String(params.page));
      url.searchParams.set("page_size", String(params.pageSize));

      Object.entries(extraParamsRef.current).forEach(([key, val]) => {
        if (val) url.searchParams.set(key, val);
      });

      const data: ApiResponse = await api(url.pathname + url.search);

      const results = data?.results ?? (Array.isArray(data) ? data : []);
      const totalCount = data?.count ?? results.length;
      const transformed = results.map(transformOptionRef.current);

      return {
        options: transformed,
        hasMore: results.length === params.pageSize,
        totalCount,
      };
    },
    [api, searchParam]
  );

  return fetchOptions;
}
