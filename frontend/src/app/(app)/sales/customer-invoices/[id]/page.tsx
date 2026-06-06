"use client";

import { useParams } from "next/navigation";
import CustomerInvoiceDetail from "@/components/finance/customer-invoices/CustomerInvoiceDetail";

export default function SalesCustomerInvoiceDetailPage() {
  const { id } = useParams();

  return <CustomerInvoiceDetail id={id as string} moduleCode="SALES" />;
}