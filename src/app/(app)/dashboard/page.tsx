// @ts-nocheck
"use client";

import { ls } from "@/services/localStorageService";
import StatCard from "@/components/cards/StatCard";
import PageHeader from "@/components/PageHeader";
import { Boxes, Users, Wallet, ShoppingCart, AlertTriangle, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useCompanySettings } from "@/context/CompanySettingsContext";

export default Dashboard;

function Dashboard() {
  const products = (ls.get("products") || []) || [];
  const employees = (ls.get("employees") || []) || [];
  const invoices = (ls.get("invoices") || []) || [];
  const expenses = (ls.get("expenses") || []) || [];
  const alerts = (ls.get("alerts") || []) || [];
  const sales = (ls.get("salesOrders") || []) || [];
const { formatCurrency, isReady } = useCompanySettings();

  const revenue = invoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const expenseTotal = expenses.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const stockValue = products.reduce((s, p) => s + (Number(p.cost || 0) * Number(p.stock || 0)), 0);

  const series = [
    { m: "Jan", revenue: 6.2, expense: 3.1 },
    { m: "Feb", revenue: 7.4, expense: 3.6 },
    { m: "Mar", revenue: 8.1, expense: 4.0 },
    { m: "Apr", revenue: revenue / 1_000_000, expense: expenseTotal / 1_000_000 },
    { m: "May", revenue: 9.2, expense: 4.5 },
    { m: "Jun", revenue: 10.1, expense: 4.8 },
  ];
  const byCat = Object.entries(
    products.reduce((acc, p) => ((acc[p.category] = (acc[p.category] || 0) + Number(p.stock || 0)), acc), {})
  ).map(([name, value]) => ({ name, value }));
  const colors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];


  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        subtitle="Overview of operations across Inventory, HR & Finance"
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Revenue" value={formatCurrency(revenue)} hint={`${invoices.length} invoices`} icon={TrendingUp} accent="success" />
        <StatCard label="Expenses" value={formatCurrency(expenseTotal)} hint={`${expenses.length} entries`} icon={Wallet} accent="warning" />
        <StatCard label="Stock Value" value={formatCurrency(stockValue)} hint={`${products.length} products`} icon={Boxes} accent="info" />
        <StatCard label="Employees" value={employees.length} hint="Active workforce" icon={Users} accent="primary" />
        <StatCard label="Sales Orders" value={sales.length} icon={ShoppingCart} accent="info" />
        <StatCard label="Alerts" value={alerts.length} hint="Requires attention" icon={AlertTriangle} accent="destructive" />
        <StatCard label="Profit (est.)" value={formatCurrency(revenue - expenseTotal)} accent="success" icon={TrendingUp} />
        <StatCard label="Avg Salary" value={formatCurrency(employees.reduce((s, e) => s + Number(e.salary || 0), 0) / Math.max(1, employees.length))} icon={Users} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-5">
        <div className="bg-card border border-border rounded-2xl p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Revenue vs Expenses</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="r" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="e" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-4)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="var(--color-chart-4)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-chart-1)" fill="url(#r)" />
                <Area type="monotone" dataKey="expense" stroke="var(--color-chart-4)" fill="url(#e)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3">Stock by Category</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCat} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50}>
                  {byCat.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-5">
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3">Top Products by Stock</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={products.slice(0, 6).map(p => ({ name: p.name, stock: p.stock }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                <Bar dataKey="stock" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3">Recent Alerts</h3>
          <ul className="divide-y divide-border">
            {alerts.length === 0 && <li className="py-6 text-sm text-muted-foreground">No alerts.</li>}
            {alerts.map((a) => (
              <li key={a.id} className="py-3 flex items-start gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-destructive" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{a.type}</div>
                  <div className="text-xs text-muted-foreground">{a.message}</div>
                </div>
                <span className="text-[11px] text-muted-foreground">{a.date}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
