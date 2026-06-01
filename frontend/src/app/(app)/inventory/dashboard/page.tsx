"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Boxes, Layers, AlertTriangle, ShoppingCart, TrendingUp,
  Package, ArrowRightLeft, Bell, RefreshCw, Loader2
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";
import { formatCurrency } from "@/lib/currency";
import StatCard from "@/components/cards/StatCard";
import PageHeader from "@/components/PageHeader";
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

export default function InventoryDashboard() {
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const queryClient = useQueryClient();

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
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Prepare chart data
  const movementData = stockMovement?.map(item => ({
    date: item.period,
    Incoming: item.transaction_type === "PURCHASE_RECEIPT" || item.transaction_type === "TRANSFER_IN" || item.transaction_type === "RETURN_IN" ? item.total_quantity : 0,
    Outgoing: item.transaction_type === "SALE" || item.transaction_type === "TRANSFER_OUT" ? item.total_quantity : 0,
  })) || [];

  const svpData = salesVsPurchase?.map(item => ({
    date: item.period,
    Sales: item.sales_amount,
    Purchases: item.purchase_amount,
  })) || [];

  const profitColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec489a", "#06b6d4", "#84cc16"];

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Inventory Dashboard" subtitle="Live overview of stock and operations" />
        <button onClick={refreshAll} className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-secondary hover:bg-accent transition">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Variants" value={summary?.total_variants ?? 0} icon={Boxes} accent="primary" />
        <StatCard label="Stock Value" value={formatCurrency(summary?.total_stock_value)} icon={Layers} accent="success" />
        <StatCard label="Low Stock Items" value={summary?.low_stock_count ?? 0} icon={AlertTriangle} accent="warning" />
        <StatCard label="Warehouses" value={summary?.total_warehouses ?? 0} icon={Package} accent="info" />
      </div>

      {/* Alerts Panel */}
      {alerts && alerts.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-warning" />
            <h3 className="font-semibold">Notifications & Alerts</h3>
            <span className="text-xs text-muted-foreground">{alerts.length} unread</span>
          </div>
          <div className="space-y-2">
            {alerts.map(alert => (
              <div key={alert.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                <div className={`w-2 h-2 mt-2 rounded-full ${alert.severity === "critical" ? "bg-destructive" : alert.severity === "warning" ? "bg-warning" : "bg-info"}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(alert.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Stock Movement (Daily)</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={movementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                <Legend />
                <Line type="monotone" dataKey="Incoming" stroke="var(--color-success)" strokeWidth={2} />
                <Line type="monotone" dataKey="Outgoing" stroke="var(--color-destructive)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Sales vs Purchase</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={svpData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} formatter={(v: any) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="Sales" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Purchases" fill="var(--color-warning)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Profit by Product & Reorder Planning */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3">Top 10 Products by Gross Profit</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={profitLoss} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                <YAxis type="category" dataKey="product_name" width={70} fontSize={11} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Bar dataKey="gross_profit" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3">Urgent Reorder Planning</h3>
          {reorderPlan && reorderPlan.length > 0 ? (
            <div className="space-y-3">
              {reorderPlan.map(item => (
                <div key={item.variant_sku} className="flex justify-between items-center border-b border-border pb-2">
                  <div>
                    <p className="font-medium text-sm">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">SKU: {item.variant_sku} | On Hand: {item.quantity_on_hand} | Min: {item.min_stock_level}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-warning">Reorder {item.recommended_reorder_qty}</p>
                    <p className="text-xs text-muted-foreground">Urgency: {item.urgency_score}%</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No items below reorder level.</p>
          )}
        </div>
      </div>

      {/* Low Stock Table */}
      {lowStockItems && lowStockItems.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> Low Stock Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2">Product</th>
                  <th className="text-left py-2">SKU</th>
                  <th className="text-left py-2">Warehouse</th>
                  <th className="text-right py-2">On Hand</th>
                  <th className="text-right py-2">Available</th>
                  <th className="text-right py-2">Unit Cost</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map(item => (
                  <tr key={item.variant_sku + item.warehouse_name} className="border-b border-border/50">
                    <td className="py-2">{item.variant_name}</td>
                    <td className="py-2">{item.variant_sku}</td>
                    <td className="py-2">{item.warehouse_name}</td>
                    <td className="py-2 text-right">{item.quantity_on_hand}</td>
                    <td className="py-2 text-right">{item.quantity_available}</td>
                    <td className="py-2 text-right">{formatCurrency(item.unit_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Transactions & Pending Orders */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3">Recent Stock Movements</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {recentTx?.map(tx => (
              <div key={tx.id} className="flex justify-between items-center text-sm border-b border-border/50 py-2">
                <div>
                  <p className="font-medium">{tx.variant_sku}</p>
                  <p className="text-xs text-muted-foreground">{tx.transaction_type_display} · {tx.reason_text}</p>
                </div>
                <div className={`text-right ${tx.quantity_change > 0 ? "text-success" : "text-destructive"}`}>
                  {tx.quantity_change > 0 ? `+${tx.quantity_change}` : `${tx.quantity_change}`}
                  <div className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3">Pending Purchase Orders</h3>
          <div className="space-y-2">
            {pendingPO?.map(po => (
              <div key={po._id} className="flex justify-between items-center text-sm border-b border-border/50 py-2">
                <div>
                  <p className="font-medium">{po.order_number}</p>
                  <p className="text-xs text-muted-foreground">{po.supplier_name}</p>
                </div>
                <div className="text-right">
                  <p>{formatCurrency(po.total_amount)}</p>
                  <p className="text-xs text-muted-foreground">Expected: {po.expected_delivery_date || "—"}</p>
                </div>
              </div>
            ))}
            {(!pendingPO || pendingPO.length === 0) && <p className="text-muted-foreground text-sm">No pending purchase orders.</p>}
          </div>
        </div>
      </div>

      {/* Active Transfers & Sales Orders */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Active Stock Transfers</h3>
          <div className="space-y-2">
            {transfers?.map(t => (
              <div key={t._id} className="flex justify-between items-center text-sm border-b border-border/50 py-2">
                <div>
                  <p className="font-medium">{t.transfer_number}</p>
                  <p className="text-xs text-muted-foreground">{t.variant_sku} · {t.source_warehouse_name} → {t.destination_warehouse_name}</p>
                </div>
                <div className="text-right">
                  <p>{t.quantity} units</p>
                  <p className="text-xs text-muted-foreground">{t.planned_date || "No date"}</p>
                </div>
              </div>
            ))}
            {(!transfers || transfers.length === 0) && <p className="text-muted-foreground text-sm">No active transfers.</p>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3">Pending Sales Orders</h3>
          <div className="space-y-2">
            {pendingSO?.map(so => (
              <div key={so._id} className="flex justify-between items-center text-sm border-b border-border/50 py-2">
                <div>
                  <p className="font-medium">{so.order_number}</p>
                  <p className="text-xs text-muted-foreground">{so.customer_name || "Walk-in Customer"}</p>
                </div>
                <div className="text-right">
                  <p>{formatCurrency(so.total_amount)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(so.order_date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {(!pendingSO || pendingSO.length === 0) && <p className="text-muted-foreground text-sm">No pending sales orders.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}