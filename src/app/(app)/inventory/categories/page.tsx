"use client";
import dynamic from "next/dynamic";
const CrudPage = dynamic(() => import("@/components/CrudPage"), { ssr: false });
import { schemas } from "@/config/schemas";

/**
 * Category Management Page
 * Uses the generic CrudPage with category schema from config.
 * SSR disabled to prevent localStorage hydration mismatches.
 */
export default function CategoriesPage() {
  return <CrudPage {...schemas.categories} />;
}