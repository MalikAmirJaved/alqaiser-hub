"use client";

import { useParams } from "next/navigation";
import CustomerDetail from "@/components/inventory/customers/CustomerDetail";

export default function InventoryCustomerDetailPage() {
  const { id } = useParams();

  return <CustomerDetail id={id as string} moduleCode="INVENTORY" />;
}