// @ts-nocheck
"use client";

import { ls } from "@/services/localStorageService";
import StatCard from "@/components/cards/StatCard";
import PageHeader from "@/components/PageHeader";
import { Boxes, Layers, AlertTriangle, ShoppingCart, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default InventoryDashboard;

function InventoryDashboard() {
  const products = ls.get("products", []) || [];
  const stockValue = products.reduce((s, p) => s + (Number(p.cost || 0) * Number(p.stock || 0)), 0);
  const lowStock = products.filter((p) => Number(p.stock) <= Number(p.reorder)).length;
  const purchases = ls.get("purchaseOrders", []) || [];
  const sales = ls.get("salesOrders", []) || [];

  return (
    <div>
      <PageHeader title="Inventory Dashboard" subtitle="Live overview of stock and operations" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Products" value={products.length} icon={Boxes} accent="primary" />
        <StatCard label="Stock Value" value={"PKR " + stockValue.toLocaleString()} icon={Layers} accent="success" />
        <StatCard label="Low Stock" value={lowStock} icon={AlertTriangle} accent="warning" />
        <StatCard label="Purchase Orders" value={purchases.length} icon={ShoppingCart} accent="info" />
      </div>
      <div className="bg-card border border-border rounded-2xl p-4 mt-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4"/> Top Products by Stock</h3>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={products.map(p => ({ name: p.name, stock: p.stock, value: p.stock * p.cost }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
              <Bar dataKey="stock" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mt-5">
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3">Recent Purchases</h3>
          <ul className="text-sm divide-y divide-border">
            {purchases.slice(0, 6).map(p => (
              <li key={p.id} className="py-2 flex justify-between"><span>{p.code} · {p.supplier}</span><span className="text-muted-foreground">PKR {Number(p.total).toLocaleString()}</span></li>
            ))}
          </ul>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-semibold mb-3">Sales Summary</h3>
          <ul className="text-sm divide-y divide-border">
            {sales.slice(0, 6).map(s => (
              <li key={s.id} className="py-2 flex justify-between"><span>{s.code} · {s.customer}</span><span className="text-muted-foreground">PKR {Number(s.total).toLocaleString()}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
