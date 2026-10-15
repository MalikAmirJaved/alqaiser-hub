"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import DocumentForm from "@/components/documents/DocumentForm";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

function QuoteCreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const permissions = useFeaturePermissions("SALES", "quote");
  if (!permissions.create) {
    return <div className="p-8 text-center">You do not have permission to create quotes.</div>;
  }

  return (
    <DocumentForm
      documentType="quote"
      onClose={() => router.push("/sales/quotes")}
      initialCustomerId={searchParams.get("customerId")}
      initialLeadId={searchParams.get("leadId")}
      onSuccess={(quote) => {
        if (quote?.id) router.replace(`/sales/quotes/${quote.id}`);
        else router.push("/sales/quotes");
      }}
    />
  );
}

export default function QuoteCreatePage() {
  return (
    <Suspense fallback={<div className=" text-center">Loading...</div>}>
      <QuoteCreatePageContent />
    </Suspense>
  );
}
