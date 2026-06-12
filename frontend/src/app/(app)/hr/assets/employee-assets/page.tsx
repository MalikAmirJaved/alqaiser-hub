// app/hr/assets/employee-assets/page.tsx
"use client";
import dynamic from "next/dynamic";

const EmployeeAssetsNew = dynamic(
  () => import("@/components/HRAssets/EmployeeAssetsNew"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    ),
  }
);

export default function EmployeeAssetsPage() {
  return <EmployeeAssetsNew />;
}