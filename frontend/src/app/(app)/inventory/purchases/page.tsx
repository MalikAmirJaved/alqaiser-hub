"use client";
import dynamic from "next/dynamic";
const PurchaseOrdersPage = dynamic(() => import("@/components/inventory/purchase/PurchaseOrdersPage"), { ssr: false });

export default () => <PurchaseOrdersPage />;