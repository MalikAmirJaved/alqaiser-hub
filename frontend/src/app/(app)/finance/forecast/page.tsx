"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import { useSalesForecast, type SalesForecast } from "@/hooks/finance/useForecast";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

export default function SalesForecastPage() {
  const router = useRouter();
  const { data: forecasts, isLoading } = useSalesForecast();
  const permissions = useFeaturePermissions("INVENTORY", "forecast");

  const modulePermissions: ModulePermissions = {
    create: false,
    update: false,
    delete: false,
    view: permissions.view,
    export: true,
  };

  const handleRowClick = (forecast: SalesForecast) => {
    // Optional: navigate to detail page using forecast.id (UUID)
    // router.push(`/finance/forecast/sales/${forecast.id}`);
  };

  const computeKPIs = (data: SalesForecast[]) => {
    if (!data.length) return [];

    const totalPredicted = data.reduce(
      (sum, f) => sum + parseFloat(f.predicted_quantity),
      0
    );
    const avgPredicted = totalPredicted / data.length;
    const uniqueVariants = new Set(data.map(f => f.variant_sku)).size;

    return [
      {
        label: "Avg. Predicted / Day",
        value: avgPredicted.toFixed(2),
        sub: `across ${data.length} forecasts`,
        tone: "info" as const,
        isCurrency: false,
      },
      {
        label: "Total Predicted Units",
        value: totalPredicted,
        sub: `${uniqueVariants} variant(s)`,
        tone: "success" as const,
        isCurrency: false,
      },
    ];
  };

  const columns = [
    {
      key: "forecast_date",
      label: "Date",
      sortable: true,
    },
    {
      key: "variant_sku",
      label: "SKU",
      mono: true,
      sortable: true,
    },
    {
      key: "predicted_quantity",
      label: "Predicted Qty",
      align: "right" as const,
      sortable: true,
      render: (val: string) => parseFloat(val).toFixed(2),
    },
    {
      key: "confidence",
      label: "Confidence",
      align: "right" as const,
      sortable: true,
      render: (val: number) => `${(val * 100).toFixed(0)}%`,
    },
    {
      key: "method_used",
      label: "Method",
    },
  ];

  return (
    <DynamicModulePage
      breadcrumbs={["Finance", "Forecast", "Sales"]}
      title="Sales Forecast"
      description="Daily predicted sales quantities based on historical orders"
      data={forecasts || []}
      isLoading={isLoading}
      columns={columns}
      kpis={computeKPIs}
      getRowId={(forecast) => forecast.id}    // UUID string
      permissions={modulePermissions}
      onRowClick={handleRowClick}
      exportEnabled
    />
  );
}