"use client";

import { useRouter } from "next/navigation";
import QuoteForm from "@/components/sales/QuoteForm";
import { useCreateQuote } from "@/hooks/sales/useQuotes";
import PageHeader from "@/components/PageHeader";

export default function NewQuotePage() {
  const router = useRouter();
  const createQuote = useCreateQuote();

  const handleSubmit = async (data: any) => {
    try {
      await createQuote.mutateAsync(data);
      router.push("/sales/quotes");
    } catch (error: any) {
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Quote"
        subtitle="Create a price estimate for a customer"
      />
      <div className="bg-card p-6 rounded-2xl border border-border">
        <QuoteForm
          onSubmit={handleSubmit}
          onCancel={() => router.push("/sales/quotes")}
          isLoading={createQuote.isPending}
        />
      </div>
    </div>
  );
}
