"use client";

import { useState, useMemo } from "react";
import {
  useOverallSummary,
  useStockSummaryReport,
  useInventoryValuationReport,
  useStockMovementReport,
  useSalesVsPurchaseReport,
  useProfitLossReport,
  useSlowMovingReport,
  useReorderPlanningReport,
  useSupplierPerformanceReport,
} from "@/hooks/useReports";
import { useWarehouses } from "@/hooks/useWarehouses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DateRangePickerRac } from "@/components/reuseable/DateRangePickerRac";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Filter, RefreshCcw, BarChart3, TrendingUp, PiggyBank, ClipboardList } from "lucide-react";
import { format } from "date-fns";

import { KPIStats } from "./components/KPIStats";
import { ReportTable } from "./components/ReportTable";
import {
  StockMovementChart,
  SalesVsPurchaseChart,
  ProfitLossChart,
  SupplierPerformanceChart,
  SlowMovingChart,
} from "./components/ReportCharts";

export default function ReportsPage() {
  /* ───── Global Filters ───── */
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("stock");

  const warehouseFilter = selectedWarehouse !== "all" ? selectedWarehouse : undefined;
  const startDate = dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
  const endDate = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;

  /* ───── Warehouses Dropdown ───── */
  const { data: warehouses } = useWarehouses({ is_active: true });

  /* ───── API Hooks ───── */
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useOverallSummary({
    start_date: startDate,
    end_date: endDate,
    warehouse_id: warehouseFilter,
  });

  const { data: stockSummary, isLoading: stockSummaryLoading } = useStockSummaryReport(warehouseFilter);
  const { data: valuation, isLoading: valuationLoading } = useInventoryValuationReport(warehouseFilter);

  const { data: movementData, isLoading: movementLoading } = useStockMovementReport({
    start_date: startDate,
    end_date: endDate,
  });
  const { data: salesVsPurchase, isLoading: svpLoading } = useSalesVsPurchaseReport({
    start_date: startDate,
    end_date: endDate,
  });

  const { data: profitLoss, isLoading: plLoading } = useProfitLossReport(warehouseFilter);
  const { data: slowMoving, isLoading: smLoading } = useSlowMovingReport(warehouseFilter);

  const { data: reorderData, isLoading: reorderLoading } = useReorderPlanningReport(warehouseFilter);
  const { data: supplierData, isLoading: supplierLoading } = useSupplierPerformanceReport();

  /* ───── Derived Metrics ───── */
  const slowMovingCount = useMemo(
    () => (slowMoving || []).filter((s) => s.status !== "HEALTHY").length,
    [slowMoving]
  );

  /* ───── Apply Filters ───── */
  const applyFilters = () => {
    refetchSummary();
    setFilterModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* ─── Page Header ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Inventory Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Comprehensive analytics, financial intelligence, and operational planning
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchSummary()}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          {/* <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" /> Filters
              </Button>
            </DialogTrigger>
            <DialogContent className="overflow-visible sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Report Filters</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <DateRangePickerRac
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(start, end) => {
                    setDateRange({
                      from: start ? new Date(start) : undefined,
                      to: end ? new Date(end) : undefined,
                    });
                  }}
                />
                </div>
                <div className="space-y-2">
                  <Label>Warehouse</Label>
                  <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Warehouses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Warehouses</SelectItem>
                      {warehouses?.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>
                          {wh.warehouse_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={applyFilters} className="w-full">
                  Apply Filters
                </Button>
              </div>
            </DialogContent>
          </Dialog> */}
        </div>
      </div>

      {/* ─── KPI Dashboard ─── */}
      <KPIStats
        totalValue={Number(summary?.total_stock_value || 0)}
        totalVariants={summary?.total_variants || 0}
        lowStockCount={summary?.low_stock_count || 0}
        warehouseCount={summary?.total_warehouses || 0}
        turnoverRate={0}
        slowMovingCount={slowMovingCount}
        loading={summaryLoading}
      />

      {/* ─── Tabbed Reports ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-muted/50 backdrop-blur-sm rounded-lg">
          <TabsTrigger value="stock" className="flex items-center gap-2 py-2.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Stock & Valuation</span>
            <span className="sm:hidden">Stock</span>
          </TabsTrigger>
          <TabsTrigger value="movement" className="flex items-center gap-2 py-2.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Movement & Trends</span>
            <span className="sm:hidden">Trends</span>
          </TabsTrigger>
          <TabsTrigger value="finance" className="flex items-center gap-2 py-2.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
            <PiggyBank className="h-4 w-4" />
            <span className="hidden sm:inline">Financial Intel</span>
            <span className="sm:hidden">Finance</span>
          </TabsTrigger>
          <TabsTrigger value="operations" className="flex items-center gap-2 py-2.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Operations</span>
            <span className="sm:hidden">Ops</span>
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  TAB 1 – Stock Summary & Valuation                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="stock" className="space-y-6">
          {/* Valuation Summary Card */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border bg-card/65 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Methodology</CardTitle>
              </CardHeader>
              <CardContent>
                {valuationLoading ? (
                  <div className="h-5 w-40 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="text-sm font-medium text-foreground">{valuation?.methodology || "—"}</p>
                )}
              </CardContent>
            </Card>
            <Card className="border bg-card/65 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Total Inventory Value</CardTitle>
              </CardHeader>
              <CardContent>
                {valuationLoading ? (
                  <div className="h-7 w-32 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    ${Number(valuation?.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="border bg-card/65 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Average Unit Cost</CardTitle>
              </CardHeader>
              <CardContent>
                {valuationLoading ? (
                  <div className="h-7 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    ${Number(valuation?.average_unit_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Stock Summary Table */}
          <Card className="border bg-card/65 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Detailed Stock Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReportTable
                title="Stock Summary"
                loading={stockSummaryLoading}
                headers={["Product", "Category", "SKU", "Warehouse", "On Hand", "Reserved", "Available", "Unit Cost", "Total Value"]}
                keys={["product_name", "category_name", "variant_sku", "warehouse_name", "quantity_on_hand", "quantity_reserved", "quantity_available", "unit_cost", "total_value"]}
                data={stockSummary || []}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  TAB 2 – Movement & Trends                                 */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="movement" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-1">
            <SalesVsPurchaseChart data={salesVsPurchase || []} loading={svpLoading} />
          </div>
          <StockMovementChart data={movementData || []} loading={movementLoading} />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  TAB 3 – Financial Intelligence                            */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="finance" className="space-y-6">
          <ProfitLossChart data={profitLoss || []} loading={plLoading} />

          {/* Profit & Loss Detail Table */}
          <Card className="border bg-card/65 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Profit & Loss Detail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReportTable
                title="Profit and Loss"
                loading={plLoading}
                headers={["Product", "SKU", "Qty Sold", "Revenue", "COGS", "Gross Profit", "Margin %"]}
                keys={["product_name", "variant_sku", "sales_quantity", "sales_revenue", "cogs", "gross_profit", "margin_percent"]}
                data={profitLoss || []}
              />
            </CardContent>
          </Card>

          {/* Slow-moving & Obsolete */}
          <div className="grid gap-6 lg:grid-cols-2">
            <SlowMovingChart data={slowMoving || []} loading={smLoading} />
            <Card className="border bg-card/65 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Slow-moving & Obsolete Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReportTable
                  title="Slow Moving Stock"
                  loading={smLoading}
                  headers={["Product", "SKU", "Warehouse", "On Hand", "Days Since Sale", "Status"]}
                  keys={["product_name", "variant_sku", "warehouse_name", "quantity_on_hand", "days_since_last_sale", "status"]}
                  data={slowMoving || []}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  TAB 4 – Operational Planning                              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="operations" className="space-y-6">
          {/* Reorder Planning */}
          <Card className="border bg-card/65 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Reorder Planning & Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReportTable
                title="Reorder Planning"
                loading={reorderLoading}
                headers={["Product", "SKU", "On Hand", "Min Level", "Max Level", "Reorder Qty", "Urgency Score", "Suggested Supplier"]}
                keys={["product_name", "variant_sku", "quantity_on_hand", "min_stock_level", "max_stock_level", "recommended_reorder_qty", "urgency_score", "suggested_supplier_name"]}
                data={reorderData || []}
              />
            </CardContent>
          </Card>

          {/* Supplier Performance */}
          <div className="grid gap-6 lg:grid-cols-2">
            <SupplierPerformanceChart data={supplierData || []} loading={supplierLoading} />
            <Card className="border bg-card/65 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Supplier Scorecard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReportTable
                  title="Supplier Performance"
                  loading={supplierLoading}
                  headers={["Supplier", "Code", "Fulfillment %", "Lead Time (days)", "Total Spend", "Orders", "Score"]}
                  keys={["supplier_name", "supplier_code", "fulfillment_rate", "average_lead_time_days", "total_purchase_amount", "orders_count", "performance_score"]}
                  data={supplierData || []}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}