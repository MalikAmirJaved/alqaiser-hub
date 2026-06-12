// src/app/(app)/hr/compensation/page.tsx
"use client";
import CompensationLoanPage from "@/components/payroll/CompensationLoanPage";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import PageHeader from "@/components/PageHeader";

export default function CompensationLoanModule() {
  const formatCurrency = useFormatCurrency();

  return (
    <div>
      <PageHeader 
        title="Compensation & Loans" 
        subtitle="Manage salary structures and employee loans" 
      />
      <CompensationLoanPage formatCurrency={formatCurrency} />
    </div>
  );
}