// src/app/(app)/hr/compensation/page.tsx
"use client";
import CompensationLoanPage from "@/components/payroll/CompensationLoanPage";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import PageHeader from "@/components/PageHeader";

export default function CompensationLoanModule() {
  const { formatCurrency } = useCompanySettings();

  return (
    <div>
      <PageHeader 
        title="Compensation & Loan" 
        subtitle="Manage salary structures, employee loans" 
      />
      <CompensationLoanPage formatCurrency={formatCurrency} />
    </div>
  );
}