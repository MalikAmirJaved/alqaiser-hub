"use client";
import dynamic from "next/dynamic";
const CrudPage = dynamic(() => import("@/components/CrudPage"), { ssr: false });
import { schemas } from "@/config/schemas";

/**
 * Brand Management Page
 * Reuses the same scalable CrudPage architecture.
 */
export default function BrandsPage() {
  return <CrudPage {...schemas.brands} />;
}