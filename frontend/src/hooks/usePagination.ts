import { useState, useCallback } from "react";

export function usePagination(defaultPageSize = 20) {
  const [page, setPage] = useState(1);

  const nextPage = useCallback(() => setPage((p) => p + 1), []);
  const prevPage = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goToPage = useCallback((p: number) => setPage(Math.max(1, p)), []);
  const resetPage = useCallback(() => setPage(1), []);

  return { page, setPage, nextPage, prevPage, goToPage, resetPage, pageSize: defaultPageSize };
}
