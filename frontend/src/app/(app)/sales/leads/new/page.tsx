"use client";

import { useRouter } from "next/navigation";
import LeadForm from "@/components/sales/LeadForm";
import { useCreateLead } from "@/hooks/sales/useLeads";
import PageHeader from "@/components/PageHeader";

export default function NewLeadPage() {
  const router = useRouter();
  const createLead = useCreateLead();

  const handleSubmit = async (data: any) => {
    try {
      await createLead.mutateAsync(data);
      router.push("/sales/leads");
    } catch (error: any) {
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Lead"
        subtitle="Capture details for a new potential customer"
      />
      <div className="bg-card p-6 rounded-2xl border border-border max-w-4xl">
        <LeadForm
          onSubmit={handleSubmit}
          onCancel={() => router.push("/sales/leads")}
          isLoading={createLead.isPending}
        />
      </div>
    </div>
  );
}
