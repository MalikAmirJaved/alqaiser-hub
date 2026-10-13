"use client";

import { useParams, useRouter } from "next/navigation";
import QuoteForm from "@/components/sales/QuoteForm";
import { useQuote } from "@/hooks/sales/useQuotes";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

export default function QuoteEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: quote, isLoading } = useQuote(id);
  const permissions = useFeaturePermissions("SALES", "quote");

  if (isLoading) return <div className="p-8 text-center">Loading quote...</div>;
  if (!quote) return <div className="p-8 text-center">Quote not found.</div>;
  if (!permissions.update || quote.status !== "DRAFT") {
    return <div className="p-8 text-center">This quote cannot be edited.</div>;
  }

  return (
    <QuoteForm
      initialData={quote}
      onClose={() => router.push(`/sales/quotes/${quote.id}`)}
      onSuccess={() => router.replace(`/sales/quotes/${quote.id}`)}
    />
  );
}
