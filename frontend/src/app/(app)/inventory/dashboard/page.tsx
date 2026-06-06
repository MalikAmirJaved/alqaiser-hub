"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Boxes, Layers, AlertTriangle, ShoppingCart, TrendingUp,
  Package, ArrowRightLeft, Bell, RefreshCw, Loader2,
  MoreHorizontal, ArrowUpRight, ArrowDownRight, Warehouse,
  Truck, Clock, CheckCircle2, DollarSign
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { formatCurrency } from "@/lib/currency";
import { PageHeader, Card, CardHeader, StatusBadge, ToolbarButton } from "@/components/finance/ui";
import {
  useOverallSummary,
  useStockMovement,
  useSalesVsPurchase,
  useProfitLoss,
  useLowStockItems,
  useRecentTransactions,
  usePendingPurchaseOrders,
  usePendingSalesOrders,
  useActiveTransfers,
  useUnreadAlerts,
  useReorderPlanning
} from "@/hooks/useInventoryDashboard";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-info)",
];

function tooltipStyle() {
  return {
    contentStyle: {
      background: "var(--color-popover)",
      border: "1px solid var(--color-border)",
      borderRadius: 8,
      fontSize: 12,
      color: "var(--color-popover-foreground)",
    } as React.CSSProperties,
    labelStyle: { color: "var(--color-muted-foreground)" } as React.CSSProperties,
  };
}

function Kpi({
  label,
  value,
  delta,
  accent = "primary",
}: {
  label: string;
  value: string;
  delta?: number;
  accent?: "primary" | "info" | "warning" | "destructive" | "success";
}) {
  const up = delta !== undefined ? delta >= 0 : false;
  const accentBg: Record<string, string> = {
    primary: "from-primary/20 to-transparent",
    info: "from-info/20 to-transparent",
    warning: "from-warning/20 to-transparent",
    destructive: "from-destructive/20 to-transparent",
    success: "from-success/20 to-transparent",
  };
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${accentBg[accent]} opacity-60 pointer-events-none`} />
      <div className="relative px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div className="text-2xl font-semibold num tracking-tight">{value}</div>
          {delta !== undefined && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium num ${up ? "text-success" : "text-destructive"}`}>
              {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="mt-3 h-1 rounded-full bg-border overflow-hidden">
          <div className={`h-full ${up ? "bg-success" : "bg-destructive"}`} style={{ width: `${Math.min(100, 40 + (delta ? Math.abs(delta) * 3 : 0))}%` }} />
        </div>
      </div>
    </Card>
  );
}

export default function InventoryDashboard() {
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const queryClient = useQueryClient();
  const t = tooltipStyle();

  // Queries
  const { data: summary, isLoading: summaryLoading } = useOverallSummary(dateRange.start, dateRange.end);
  const { data: stockMovement, isLoading: movementLoading } = useStockMovement(dateRange.start, dateRange.end);
  const { data: salesVsPurchase, isLoading: svpLoading } = useSalesVsPurchase(dateRange.start, dateRange.end);
  const { data: profitLoss, isLoading: plLoading } = useProfitLoss();
  const { data: lowStockItems, isLoading: lowStockLoading } = useLowStockItems();
  const { data: recentTx, isLoading: txLoading } = useRecentTransactions();
  const { data: pendingPO, isLoading: poLoading } = usePendingPurchaseOrders();
  const { data: pendingSO, isLoading: soLoading } = usePendingSalesOrders();
  const { data: transfers, isLoading: transferLoading } = useActiveTransfers();
  const { data: alerts, isLoading: alertLoading } = useUnreadAlerts();
  const { data: reorderPlan, isLoading: reorderLoading } = useReorderPlanning();

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard_overall_summary"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_stock_movement"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_sales_vs_purchase"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_profit_loss"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_low_stock"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_recent_transactions"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_pending_po"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_pending_so"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_active_transfers"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_alerts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_reorder_planning"] });
  };

  const isLoading = summaryLoading || movementLoading || svpLoading || plLoading || lowStockLoading || txLoading || poLoading || soLoading || transferLoading || alertLoading || reorderLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Prepare chart data
  const movementData = stockMovement?.reduce((acc: any[], item) => {
    const existing = acc.find(d => d.date === item.period);
    if (existing) {
      if (item.transaction_type === "PURCHASE_RECEIPT" || item.transaction_type === "TRANSFER_IN" || item.transaction_type === "RETURN_IN") {
        existing.Incoming += item.total_quantity;
      } else if (item.transaction_type === "SALE" || item.transaction_type === "TRANSFER_OUT") {
        existing.Outgoing += item.total_quantity;
      }
    } else {
      acc.push({
        date: item.period,
        Incoming: (item.transaction_type === "PURCHASE_RECEIPT" || item.transaction_type === "TRANSFER_IN" || item.transaction_type === "RETURN_IN") ? item.total_quantity : 0,
        Outgoing: (item.transaction_type === "SALE" || item.transaction_type === "TRANSFER_OUT") ? item.total_quantity : 0,
      });
    }
    return acc;
  }, []) || [];

  const svpData = salesVsPurchase?.map(item => ({
    date: item.period,
    Sales: item.sales_amount,
    Purchases: item.purchase_amount,
  })) || [];

  // Stock turnover rate (mock - based on movement)
  const stockTurnoverData = movementData.slice(-6).map(item => ({
    month: item.date,
    turnover: item.Outgoing / (item.Incoming || 1),
  }));

  // Warehouse distribution (mock - replace with actual data)
  const warehouseData = [
    { name: "Main Warehouse", value: summary?.total_stock_value ? summary.total_stock_value * 0.6 : 0 },
    { name: "Secondary WH", value: summary?.total_stock_value ? summary.total_stock_value * 0.25 : 0 },
    { name: "Retail Store", value: summary?.total_stock_value ? summary.total_stock_value * 0.15 : 0 },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={["Inventory", "Dashboard"]}
        title="Inventory Dashboard"
        description="Live overview of stock levels, movements, and warehouse operations."
        actions={
          <>
            <ToolbarButton icon={RefreshCw} variant="ghost" onClick={refreshAll}>Refresh</ToolbarButton>
          </>
        }
      />

      <div className="pt-6 space-y-6">
        {/* KPIs row 1 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi
            label="Total Variants"
            value={String(summary?.total_variants ?? 0)}
            delta={8.2}
            accent="primary"
          />
          <Kpi
            label="Stock Value"
            value={formatCurrency(summary?.total_stock_value ?? 0)}
            delta={12.5}
            accent="success"
          />
          <Kpi
            label="Low Stock Items"
            value={String(summary?.low_stock_count ?? 0)}
            delta={-5.3}
            accent="warning"
          />
          <Kpi
            label="Warehouses"
            value={String(summary?.total_warehouses ?? 0)}
            delta={0}
            accent="info"
          />
        </div>

        {/* KPIs row 2 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi
            label="Total Sales (YTD)"
            value={formatCurrency(summary?.total_sales_amount ?? 0)}
            delta={18.7}
            accent="primary"
          />
          <Kpi
            label="Total Purchases (YTD)"
            value={formatCurrency(summary?.total_purchase_amount ?? 0)}
            delta={-2.4}
            accent="info"
          />
          <Kpi
            label="Gross Margin"
            value={`${summary?.total_sales_amount && summary?.total_purchase_amount ? (((summary.total_sales_amount - summary.total_purchase_amount) / summary.total_sales_amount) * 100).toFixed(1) : "0"}%`}
            delta={3.2}
            accent="success"
          />
          <Kpi
            label="Stock Turnover"
            value={`${stockTurnoverData.length > 0 ? (stockTurnoverData.reduce((sum, item) => sum + item.turnover, 0) / stockTurnoverData.length).toFixed(1) : "0"}`}
            delta={0.5}
            accent="warning"
          />
        </div>

        {/* Alerts Panel */}
        {alerts && alerts.length > 0 && (
          <Card>
            <CardHeader
              title="Notifications & Alerts"
              subtitle={`${alerts.length} unread items`}
            />
            <div className="divide-y divide-border">
              {alerts.map((alert) => (
                <div key={alert.id} className="px-5 py-3 flex items-start gap-3 hover:bg-surface-2/50 transition-colors">
                  <div className={`w-2 h-2 mt-2 rounded-full ${
                    alert.severity === "critical" ? "bg-destructive" : 
                    alert.severity === "warning" ? "bg-warning" : "bg-info"
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <span className="text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <StatusBadge status={alert.type_display} />
                      <span className="text-xs text-muted-foreground">Severity: {alert.severity}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Stock Movement"
              subtitle="Incoming vs Outgoing quantity"
              action={
                <div className="flex gap-1 rounded-md border border-border p-0.5 text-xs">
                  {["Daily", "Weekly", "Monthly"].map((p, i) => (
                    <button key={p} className={`px-2 py-1 rounded ${i === 0 ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      {p}
                    </button>
                  ))}
                </div>
              }
            />
            <div className="p-4 h-[300px]">
              <ResponsiveContainer>
                <AreaChart data={movementData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...t} />
                  <Area type="monotone" dataKey="Incoming" name="Incoming" stroke="var(--color-chart-1)" fill="url(#gIn)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Outgoing" name="Outgoing" stroke="var(--color-chart-3)" fill="url(#gOut)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Warehouse Distribution" subtitle="Stock value by location" />
            <div className="p-4 h-[300px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={warehouseData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {warehouseData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="var(--color-background)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip {...t} formatter={(v: any) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="px-5 pb-4 grid grid-cols-1 gap-2 text-xs">
              {warehouseData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-muted-foreground flex-1 truncate">{item.name}</span>
                  <span className="num font-medium">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card>
            <CardHeader title="Sales vs Purchases" subtitle="Revenue vs Cost" />
            <div className="p-4 h-[260px]">
              <ResponsiveContainer>
                <BarChart data={svpData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip {...t} formatter={(v: any) => formatCurrency(v)} />
                  <Bar dataKey="Sales" name="Sales" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Purchases" name="Purchases" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Stock Turnover Rate" subtitle="Times inventory sold per period" />
            <div className="p-4 h-[260px]">
              <ResponsiveContainer>
                <LineChart data={stockTurnoverData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...t} />
                  <Line type="monotone" dataKey="turnover" stroke="var(--color-chart-2)" strokeWidth={2} dot={{ fill: "var(--color-chart-2)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Top Products by Profit" subtitle="Gross margin leaders" />
            <div className="p-4 h-[260px]">
              <ResponsiveContainer>
                <BarChart data={profitLoss?.slice(0, 5)} layout="vertical" margin={{ top: 10, right: 10, left: 80, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                  <YAxis dataKey="product_name" type="category" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={70} />
                  <Tooltip {...t} formatter={(v: any) => formatCurrency(v)} />
                  <Bar dataKey="gross_profit" name="Gross Profit" fill="var(--color-chart-4)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Urgent Reorder Planning */}
        <Card>
          <CardHeader
            title="Urgent Reorder Planning"
            subtitle={`${reorderPlan?.length || 0} items below reorder level`}
            action={<StatusBadge status="Critical" />}
          />
          <div className="divide-y divide-border">
            {reorderPlan && reorderPlan.length > 0 ? (
              reorderPlan.map((item) => (
                <div key={item.variant_sku} className="px-5 py-4 flex items-center justify-between hover:bg-surface-2/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{item.product_name}</p>
                      <span className="text-xs text-muted-foreground font-mono">{item.variant_sku}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>On Hand: <span className="font-medium">{item.quantity_on_hand}</span></span>
                      <span>Min Level: <span className="font-medium">{item.min_stock_level}</span></span>
                      <span>Max Level: <span className="font-medium">{item.max_stock_level}</span></span>
                    </div>
                    {item.suggested_supplier_name && (
                      <p className="text-xs text-muted-foreground mt-1">Supplier: {item.suggested_supplier_name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-warning">Reorder {item.recommended_reorder_qty}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="h-1.5 w-20 rounded-full bg-border overflow-hidden">
                        <div className="h-full rounded-full bg-warning" style={{ width: `${item.urgency_score}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">Urgency: {item.urgency_score}%</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-6 text-sm text-muted-foreground text-center">No items below reorder level.</div>
            )}
          </div>
        </Card>

        {/* Low Stock Table */}
        {lowStockItems && lowStockItems.length > 0 && (
          <Card>
            <CardHeader
              title="Low Stock Items"
              subtitle="Items below minimum threshold"
              action={<AlertTriangle className="w-4 h-4 text-warning" />}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr className="text-left">
                    <th className="font-medium px-5 py-3">Product</th>
                    <th className="font-medium px-5 py-3">SKU</th>
                    <th className="font-medium px-5 py-3">Warehouse</th>
                    <th className="font-medium px-5 py-3 text-right">On Hand</th>
                    <th className="font-medium px-5 py-3 text-right">Available</th>
                    <th className="font-medium px-5 py-3 text-right">Unit Cost</th>
                    <th className="font-medium px-5 py-3 text-right">Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((item, idx) => (
                    <tr key={`${item.variant_sku}-${item.warehouse_name}`} className="border-b border-border/50 hover:bg-surface-2/50 transition-colors">
                      <td className="px-5 py-3 font-medium">{item.variant_name}</td>
                      <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{item.variant_sku}</td>
                      <td className="px-5 py-3">{item.warehouse_name}</td>
                      <td className="px-5 py-3 text-right font-mono">{item.quantity_on_hand}</td>
                      <td className="px-5 py-3 text-right font-mono">{item.quantity_available}</td>
                      <td className="px-5 py-3 text-right font-mono">{formatCurrency(item.unit_cost)}</td>
                      <td className="px-5 py-3 text-right font-mono">{formatCurrency(item.total_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Recent Transactions & Pending Orders */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader
              title="Recent Stock Movements"
              subtitle="Latest inventory changes"
              action={<button className="text-xs text-primary font-medium hover:underline">View all →</button>}
            />
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {recentTx?.map((tx) => (
                <div key={tx.id} className="px-5 py-3 flex items-center justify-between hover:bg-surface-2/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{tx.variant_sku}</span>
                      <StatusBadge status={tx.transaction_type_display} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{tx.reason_text || "No reason provided"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tx.created_by_name} · {new Date(tx.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${tx.quantity_change > 0 ? "text-success" : "text-destructive"}`}>
                      {tx.quantity_change > 0 ? `+${tx.quantity_change}` : `${tx.quantity_change}`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{formatCurrency(tx.unit_cost)}/unit</div>
                  </div>
                </div>
              ))}
              {(!recentTx || recentTx.length === 0) && (
                <div className="px-5 py-6 text-sm text-muted-foreground text-center">No recent transactions found.</div>
              )}
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader
                title="Pending Purchase Orders"
                subtitle="Awaiting fulfillment"
                action={<ShoppingCart className="w-4 h-4" />}
              />
              <div className="divide-y divide-border">
                {pendingPO?.map((po) => (
                  <div key={po._id} className="px-5 py-3 flex items-center justify-between hover:bg-surface-2/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium font-mono">{po.order_number}</p>
                      <p className="text-xs text-muted-foreground">{po.supplier_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(po.total_amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {po.expected_delivery_date ? `Expected: ${po.expected_delivery_date}` : "No ETA"}
                      </p>
                    </div>
                  </div>
                ))}
                {(!pendingPO || pendingPO.length === 0) && (
                  <div className="px-5 py-6 text-sm text-muted-foreground text-center">No pending purchase orders.</div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Pending Sales Orders"
                subtitle="Awaiting processing"
                action={<Truck className="w-4 h-4" />}
              />
              <div className="divide-y divide-border">
                {pendingSO?.map((so) => (
                  <div key={so._id} className="px-5 py-3 flex items-center justify-between hover:bg-surface-2/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium font-mono">{so.order_number}</p>
                      <p className="text-xs text-muted-foreground">{so.customer_name || "Walk-in Customer"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(so.total_amount)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(so.order_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
                {(!pendingSO || pendingSO.length === 0) && (
                  <div className="px-5 py-6 text-sm text-muted-foreground text-center">No pending sales orders.</div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Active Transfers */}
        <Card>
          <CardHeader
            title="Active Stock Transfers"
            subtitle="In-transit inventory"
            action={<ArrowRightLeft className="w-4 h-4" />}
          />
          <div className="divide-y divide-border">
            {transfers?.map((t) => (
              <div key={t._id} className="px-5 py-3 flex items-center justify-between hover:bg-surface-2/50 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium font-mono">{t.transfer_number}</p>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.variant_sku} · {t.source_warehouse_name} → {t.destination_warehouse_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{t.quantity} units</p>
                  <p className="text-xs text-muted-foreground">{t.planned_date || "No planned date"}</p>
                </div>
              </div>
            ))}
            {(!transfers || transfers.length === 0) && (
              <div className="px-5 py-6 text-sm text-muted-foreground text-center">No active transfers.</div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}