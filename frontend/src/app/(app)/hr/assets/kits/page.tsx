// app/hr/assets/categories/page.tsx
"use client";
import dynamic from "next/dynamic";

const AssetCategories = dynamic(() => import("@/components/HRAssets/AssetCategories"), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
});

export default function AssetCategoriesPage() {
  return <AssetCategories />;
}