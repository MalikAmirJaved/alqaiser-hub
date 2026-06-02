// src/app/(app)/hr/compensation/page.tsx
"use client";
import CompensationLoanPage from "@/components/payroll/CompensationLoanPage";
import { formatCurrency } from "@/lib/currency";
import PageHeader from "@/components/PageHeader";

export default function CompensationLoanModule() {

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