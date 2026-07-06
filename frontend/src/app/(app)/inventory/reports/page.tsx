"use client";

import { useState, useMemo } from "react";
import { useInventoryAnalytics } from "@/hooks/useInventoryAnalytics";
import { useWarehouses } from "@/hooks/useWarehouses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  RefreshCcw, Filter, X, Calendar, TrendingUp, Package, Users,
  Truck, Tag, ShoppingCart, AlertTriangle, BarChart3,
  Award, Warehouse as WarehouseIcon,
  Layers, BellRing,
} from "lucide-react";
import { format } from "date-fns";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { ReportTable } from "./components/ReportTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#ec4899", "#84cc16", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#22c55e", "#eab308",
];

function formatCurrency(value: number, code: string) {
  return `${code} ${(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    HEALTHY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    SLOW_MOVING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    OBSOLETE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
    IN_TRANSIT: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    CANCELLED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    PARTIALLY_RECEIVED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    FULLY_RECEIVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    inactive: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    info: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  };
  const color = colors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{status.replace(/_/g, " ")}</span>;
}

function MiniStat({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: React.ElementType; color?: string;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border bg-card/50 ${color || ""}`}>
      <div className={`p-2 rounded-lg ${color ? "bg-white/20" : "bg-muted/50"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

export default function AnalyticsDashboardPage() {
  const { CurrencyCode } = useCompanySettings();
  const currency = CurrencyCode();

  /* ───── Filters ───── */
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return format(d, "yyyy-MM-dd");
  });
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const warehouseFilter = selectedWarehouse !== "all" ? selectedWarehouse : undefined;

  const { data: warehouses } = useWarehouses({ is_active: true });
  const { data: analytics, isLoading, refetch } = useInventoryAnalytics({
    start_date: dateFrom || undefined,
    end_date: dateTo || undefined,
    warehouse_id: warehouseFilter,
  });

  /* ───── Derived ───── */
  const totalSalesRevenue = useMemo(
    () => (analytics?.pos_summary || []).reduce((s, p) => s + p.total_revenue, 0),
    [analytics?.pos_summary]
  );

  const clearFilters = () => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    setDateFrom(format(d, "yyyy-MM-dd"));
    setDateTo(format(new Date(), "yyyy-MM-dd"));
    setSelectedWarehouse("all");
  };

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Complete inventory intelligence — products, brands, categories, customers, warehouses & more
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={showFilters ? "default" : "outline"} size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="mr-2 h-4 w-4" /> Filters
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* ─── FILTERS ─── */}
      {showFilters && (
        <Card className="border bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">From Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="pl-8 w-48" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">To Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="pl-8 w-48" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Warehouse</Label>
                <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Warehouses</SelectItem>
                    {warehouses?.map(wh => (
                      <SelectItem key={wh.id} value={wh.id}>{wh.warehouse_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-3 w-3" /> Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================ */}
      {/*  TOP-LEVEL KPI ROW                                              */}
      {/* ================================================================ */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="pt-6"><div className="h-12 bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <MiniStat label="Total Products" value={String(analytics?.products_summary?.total_products || 0)} icon={Package} color="text-blue-600" />
          <MiniStat label="Total Variants" value={String(analytics?.products_summary?.total_variants || 0)} icon={Layers} color="text-purple-600" />
          <MiniStat label="Active Products" value={String(analytics?.products_summary?.active_products || 0)} icon={BarChart3} color="text-emerald-600" />
          <MiniStat label="Total Customers" value={String(analytics?.products_summary?.total_customers || 0)} icon={Users} color="text-indigo-600" />
          <MiniStat label="Active Warehouses" value={String((analytics?.warehouses?.length || 0))} icon={WarehouseIcon} color="text-orange-600" />
          <MiniStat label="Period Revenue" value={formatCurrency(totalSalesRevenue, currency)} icon={TrendingUp} color="text-emerald-600" />
        </div>
      )}

      {/* ================================================================ */}
      {/*  SECTION: PRODUCTS — HIGH VALUE, HIGH SALE, HIGH PURCHASE        */}
      {/* ================================================================ */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-500" /> Product Intelligence
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Top by Value */}
          <Card className="border bg-card/65">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">🏆 Top by Stock Value</CardTitle></CardHeader>
            <CardContent className="max-h-80 overflow-y-auto">
              {analytics?.top_products_by_value?.map((p, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                    <span className="truncate">{p.product_name}</span>
                  </div>
                  <span className="font-semibold shrink-0 ml-2">{formatCurrency(p.total_stock_value, currency)}</span>
                </div>
              ))}
              {(!analytics?.top_products_by_value || analytics.top_products_by_value.length === 0) && (
                <p className="text-sm text-muted-foreground py-4 text-center">No data</p>
              )}
            </CardContent>
          </Card>

          {/* Top by Sales */}
          <Card className="border bg-card/65">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">🏆 Top by Sales Revenue</CardTitle></CardHeader>
            <CardContent className="max-h-80 overflow-y-auto">
              {analytics?.top_products_by_sales?.map((p, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                    <span className="truncate">{p.product_name}</span>
                    <span className="text-xs text-muted-foreground">({p.total_sales_qty} sold)</span>
                  </div>
                  <span className="font-semibold shrink-0 ml-2">{formatCurrency(p.total_sales_revenue, currency)}</span>
                </div>
              ))}
              {(!analytics?.top_products_by_sales || analytics.top_products_by_sales.length === 0) && (
                <p className="text-sm text-muted-foreground py-4 text-center">No data</p>
              )}
            </CardContent>
          </Card>

          {/* Top by Purchase */}
          <Card className="border bg-card/65">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">🏆 Top by Purchase Cost</CardTitle></CardHeader>
            <CardContent className="max-h-80 overflow-y-auto">
              {analytics?.top_products_by_purchase?.map((p, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                    <span className="truncate">{p.product_name}</span>
                    <span className="text-xs text-muted-foreground">({p.total_purchase_qty} bought)</span>
                  </div>
                  <span className="font-semibold shrink-0 ml-2">{formatCurrency(p.total_purchase_cost, currency)}</span>
                </div>
              ))}
              {(!analytics?.top_products_by_purchase || analytics.top_products_by_purchase.length === 0) && (
                <p className="text-sm text-muted-foreground py-4 text-center">No data</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ================================================================ */}
      {/*  SECTION: BRANDS & CATEGORIES                                    */}
      {/* ================================================================ */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Brands */}
        <Card className="border bg-card/65">
          <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Award className="h-4 w-4" /> Brand Performance
          </CardTitle></CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {analytics?.brands && analytics.brands.length > 0 ? (
              <div className="space-y-3">
                {analytics.brands.slice(0, 10).map((b, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="w-1 h-10 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.brand_name}</p>
                      <p className="text-xs text-muted-foreground">{b.product_count} variants</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(b.total_sales_revenue, currency)}</p>
                      <p className="text-xs text-muted-foreground">{b.total_sales_qty} sold</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No brand data available</p>
            )}
          </CardContent>
        </Card>

        {/* Categories */}
        <Card className="border bg-card/65">
          <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Tag className="h-4 w-4" /> Category Performance
          </CardTitle></CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {analytics?.categories && analytics.categories.length > 0 ? (
              <div className="space-y-3">
                {analytics.categories.slice(0, 10).map((c, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}>
                      {c.category_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.category_name}</p>
                      <p className="text-xs text-muted-foreground">{c.product_count} variants</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(c.total_sales_revenue, currency)}</p>
                      <p className="text-xs text-muted-foreground">{c.total_sales_qty} sold</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No category data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/*  SECTION: CUSTOMERS & WAREHOUSES                                 */}
      {/* ================================================================ */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Customers */}
        <Card className="border bg-card/65">
          <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" /> Top Customers
          </CardTitle></CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {analytics?.top_customers && analytics.top_customers.length > 0 ? (
              <div className="space-y-2">
                {analytics.top_customers.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                      <span className="truncate font-medium">{c.customer_name}</span>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-semibold">{formatCurrency(c.total_revenue, currency)}</p>
                      <p className="text-xs text-muted-foreground">{c.total_orders} orders · {c.total_products} items</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No customer data with completed orders</p>
            )}
          </CardContent>
        </Card>

        {/* Warehouses */}
        <Card className="border bg-card/65">
          <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <WarehouseIcon className="h-4 w-4" /> Warehouse Performance
          </CardTitle></CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {analytics?.warehouses && analytics.warehouses.length > 0 ? (
              <div className="space-y-3">
                {analytics.warehouses.map((w, i) => (
                  <div key={i} className="p-3 rounded-lg border hover:bg-muted/20 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium">{w.warehouse_name}</p>
                      <p className="text-sm font-semibold">{formatCurrency(w.total_stock_value, currency)}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <span>{w.total_on_hand} units</span>
                      <span>{w.unique_variants} variants</span>
                      <span>↗ {w.total_transfers_out} out · ↘ {w.total_transfers_in} in</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No warehouse data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/*  SECTION: SUPPLIERS                                               */}
      {/* ================================================================ */}
      <h2 className="text-lg font-semibold mt-2 mb-3 flex items-center gap-2">
        <Truck className="h-5 w-5 text-orange-500" /> Supplier & Vendor Performance
      </h2>
      <Card className="border bg-card/65">
        <CardContent>
          {analytics?.top_suppliers && analytics.top_suppliers.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
              {analytics.top_suppliers.slice(0, 4).map((s, i) => (
                <div key={i} className="p-3 rounded-lg border bg-card/50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium truncate">{s.supplier_name}</p>
                    <span className="text-lg font-bold" style={{
                      color: s.performance_score >= 80 ? '#10b981' : s.performance_score >= 50 ? '#f59e0b' : '#ef4444'
                    }}>{s.performance_score}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <span>Fulfillment: {s.fulfillment_rate}%</span>
                    <span>Lead time: {s.average_lead_time_days}d</span>
                    <span>Orders: {s.orders_count}</span>
                    <span>Spend: {formatCurrency(s.total_purchase_amount, currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No supplier performance data available</p>
          )}
          {analytics?.top_suppliers && analytics.top_suppliers.length > 4 && (
            <ReportTable
              title="Supplier Performance"
              loading={isLoading}
              headers={["Supplier", "Code", "Fulfillment %", "Lead Time (days)", "Total Spend", "Orders", "Score"]}
              keys={["supplier_name", "supplier_code", "fulfillment_rate", "average_lead_time_days", "total_purchase_amount", "orders_count", "performance_score"]}
              data={analytics.top_suppliers.slice(4)}
              currency={currency}
            />
          )}
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/*  SECTION: MOVEMENT, TRANSFERS, ALERTS, POS — 4-col grid          */}
      {/* ================================================================ */}
      <h2 className="text-lg font-semibold mt-2 mb-3 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-indigo-500" /> Operations Overview
      </h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Movement by Type */}
        <Card className="border bg-card/65">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Movement by Type</CardTitle></CardHeader>
          <CardContent className="max-h-72 overflow-y-auto">
            {analytics?.movement_by_type && analytics.movement_by_type.length > 0 ? (
              <div className="space-y-2">
                {analytics.movement_by_type.map((m, i) => (
                  <div key={i} className="flex justify-between items-center text-sm py-1">
                    <span className="text-muted-foreground text-xs">{m.transaction_type.replace(/_/g, " ")}</span>
                    <span className="font-medium">{m.total_qty.toLocaleString()} <span className="text-xs text-muted-foreground">({m.total_count} tx)</span></span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">No movement in period</p>
            )}
          </CardContent>
        </Card>

        {/* Transfers by Status */}
        <Card className="border bg-card/65">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Transfers by Status</CardTitle></CardHeader>
          <CardContent className="max-h-72 overflow-y-auto">
            {analytics?.transfers && analytics.transfers.length > 0 ? (
              <div className="space-y-2">
                {analytics.transfers.map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">{t.total_count}</p>
                      <p className="text-xs text-muted-foreground">{t.total_quantity} units</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">No transfers</p>
            )}
          </CardContent>
        </Card>

        {/* Alerts Summary */}
        <Card className="border bg-card/65">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Alerts Summary</CardTitle></CardHeader>
          <CardContent className="max-h-72 overflow-y-auto">
            {analytics?.alerts && analytics.alerts.length > 0 ? (
              <div className="space-y-2">
                {analytics.alerts.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1">
                    <div className="flex items-center gap-2">
                      <BellRing className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs">{a.type.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={a.severity} />
                      <span className="font-medium text-xs">{a.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">No alerts</p>
            )}
          </CardContent>
        </Card>

        {/* POS / Order Source */}
        <Card className="border bg-card/65">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Order Sources</CardTitle></CardHeader>
          <CardContent className="max-h-72 overflow-y-auto">
            {analytics?.pos_summary && analytics.pos_summary.length > 0 ? (
              <div className="space-y-2">
                {analytics.pos_summary.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{p.source.replace(/_/g, " ")}</span>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{formatCurrency(p.total_revenue, currency)}</p>
                      <p className="text-xs text-muted-foreground">{p.total_orders} orders</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">No order data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/*  SECTION: MARGIN CHART (top products by margin %)                */}
      {/* ================================================================ */}
      <Card className="border bg-card/65">
        <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Top Products by Profit Margin %
        </CardTitle></CardHeader>
        <CardContent>
          {analytics?.top_products_by_sales && analytics.top_products_by_sales.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.top_products_by_sales.slice(0, 10).map(p => ({
                    name: p.product_name.length > 15 ? p.product_name.substring(0, 15) + "…" : p.product_name,
                    margin: p.margin_percent,
                    revenue: p.total_sales_revenue,
                  }))}
                  layout="vertical" margin={{ left: 20, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" unit="%" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number, name: string) => name === "margin" ? `${v}%` : formatCurrency(v, currency)} />
                  <Bar dataKey="margin" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No sales data for margin analysis</p>
          )}
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/*  SECTION: BRAND DISTRIBUTION PIE CHART                           */}
      {/* ================================================================ */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border bg-card/65">
          <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Brand Sales Distribution</CardTitle></CardHeader>
          <CardContent>
            {analytics?.brands && analytics.brands.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.brands.slice(0, 8)}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={100}
                      dataKey="total_sales_revenue" nameKey="brand_name"
                      label={({ brand_name, percent }) => `${brand_name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {analytics.brands.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No brand data</p>
            )}
          </CardContent>
        </Card>

        <Card className="border bg-card/65">
          <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Warehouse Stock Value Distribution</CardTitle></CardHeader>
          <CardContent>
            {analytics?.warehouses && analytics.warehouses.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.warehouses}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={100}
                      dataKey="total_stock_value" nameKey="warehouse_name"
                      label={({ warehouse_name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {analytics.warehouses.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No warehouse data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/*  SECTION: LOW STOCK ALERTS                                       */}
      {/* ================================================================ */}
      <Card className="border bg-card/65">
        <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" /> Low Stock Products (Below Min Level)
        </CardTitle></CardHeader>
        <CardContent>
          <ReportTable
            title="Low Stock Products"
            loading={isLoading}
            headers={["Product", "SKU", "Stock Value", "Category", "Brand"]}
            keys={["product_name", "variant_sku", "total_stock_value", "category_name", "brand_name"]}
            data={analytics?.low_stock_products || []}
            currency={currency}
          />
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/*  SECTION: MOVEMENT TREND (simple chart from by-type data)        */}
      {/* ================================================================ */}
      <Card className="border bg-card/65">
        <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Transaction Type Volume</CardTitle></CardHeader>
        <CardContent>
          {analytics?.movement_by_type && analytics.movement_by_type.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.movement_by_type}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="transaction_type" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total_qty" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Total Quantity" />
                  <Bar dataKey="total_count" fill="#10b981" radius={[3, 3, 0, 0]} name="Transaction Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No transaction data in selected period</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
