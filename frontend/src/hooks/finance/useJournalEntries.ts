// src/hooks/finance/useJournalEntries.ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface JournalLine {
  id: string;
  account: {
    id: string;
    code: string;
    name: string;
  };
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  entry_number: string;
  date: string;
  description: string;
  is_posted: boolean;
  reference_type: string;
  reference_id: string;
  lines: JournalLine[];
  created_at: string;
  updated_at: string;
  created_by?: number | string | null;
  updated_by?: number | string | null;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function useJournalEntries(filters?: {
  date?: string;
  date__gte?: string;
  date__lte?: string;
  entry_number?: string;
  reference_type?: string;
  reference_id?: string;
  is_posted?: boolean;
  ordering?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.date) params.append('date', filters.date);
  if (filters?.date__gte) params.append('date__gte', filters.date__gte);
  if (filters?.date__lte) params.append('date__lte', filters.date__lte);
  if (filters?.entry_number) params.append('entry_number', filters.entry_number);
  if (filters?.reference_type) params.append('reference_type', filters.reference_type);
  if (filters?.reference_id) params.append('reference_id', filters.reference_id);
  if (filters?.is_posted !== undefined) params.append('is_posted', String(filters.is_posted));
  if (filters?.ordering) params.append('ordering', filters.ordering);
  const url = `/api/finance/journal-entries/${params.toString() ? `?${params}` : ''}`;
  return useQuery({
    queryKey: ['finance_journal_entries', filters],
    queryFn: () => apiFetch<PaginatedResponse<JournalEntry>>(url),
    select: (data) => data.results,
    staleTime: 30_000,
  });
}

// Add this function to fetch single journal entry
export function useJournalEntry(id: string | null) {
  return useQuery({
    queryKey: ['finance_journal_entry', id],
    queryFn: () => apiFetch<JournalEntry>(`/api/finance/journal-entries/${id}/`),
    enabled: !!id,
    staleTime: 30_000,
  });
}