"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShieldAlert, Layers, Warehouse, TrendingUp, AlertTriangle } from "lucide-react";

interface KPIStatsProps {
  totalValue?: number;
  totalVariants?: number;
  lowStockCount?: number;
  warehouseCount?: number;
  turnoverRate?: number;
  slowMovingCount?: number;
  loading?: boolean;
}

export function KPIStats({
  totalValue = 0,
  totalVariants = 0,
  lowStockCount = 0,
  warehouseCount = 0,
  turnoverRate = 0,
  slowMovingCount = 0,
  loading = false,
}: KPIStatsProps) {
  const cards = [
    {
      title: "Total Stock Value",
      value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      description: "Asset cost-basis total",
      icon: DollarSign,
      colorClass: "text-blue-500 bg-blue-50/50 dark:bg-blue-950/20",
    },
    {
      title: "Total Product Variants",
      value: totalVariants.toLocaleString(),
      description: "Unique SKUs registered",
      icon: Layers,
      colorClass: "text-purple-500 bg-purple-50/50 dark:bg-purple-950/20",
    },
    {
      title: "Low Stock Items",
      value: lowStockCount.toLocaleString(),
      description: "Currently below safety margin",
      icon: ShieldAlert,
      colorClass: lowStockCount > 0 ? "text-red-500 bg-red-50/50 dark:bg-red-950/20" : "text-green-500 bg-green-50/50 dark:bg-green-950/20",
    },
    {
      title: "Active Warehouses",
      value: warehouseCount.toLocaleString(),
      description: "Locations storing inventory",
      icon: Warehouse,
      colorClass: "text-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20",
    },
    {
      title: "Stock Turnover Rate",
      value: `${turnoverRate.toFixed(2)}x`,
      description: "Yearly inventory cycles",
      icon: TrendingUp,
      colorClass: "text-orange-500 bg-orange-50/50 dark:bg-orange-950/20",
    },
    {
      title: "Slow-moving Stocks",
      value: slowMovingCount.toLocaleString(),
      description: "Over 30 days without sales",
      icon: AlertTriangle,
      colorClass: "text-yellow-600 bg-yellow-50/50 dark:bg-yellow-950/20",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card key={idx} className="relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-black/50 border bg-card/65 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg transition-colors ${card.colorClass}`}>
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-6 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold tracking-tight text-foreground transition-all duration-300">
                    {card.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {card.description}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
