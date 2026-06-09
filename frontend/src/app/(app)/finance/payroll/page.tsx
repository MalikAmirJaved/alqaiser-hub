"use client";

import { PayrollPage } from "@/app/(app)/hr/payroll/page";

export default function FinancePayrollPage() {
  return <PayrollPage module="finance" title="Finance Payroll" permissionModule="FINANCE" />;
}
