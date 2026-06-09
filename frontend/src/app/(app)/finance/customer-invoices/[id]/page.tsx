"use client";

import { useParams } from "next/navigation";
import CustomerInvoiceDetail from "@/components/finance/customer-invoices/CustomerInvoiceDetail";

export default function FinanceCustomerInvoiceDetailPage() {
  const { id } = useParams();

  return <CustomerInvoiceDetail id={id as string} moduleCode="FINANCE" />;
}