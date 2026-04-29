// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { ls } from "../services/localStorageService";
import StatCard from "../components/cards/StatCard";
import PageHeader from "../components/PageHeader";
import { Wallet, TrendingUp, Receipt, Landmark } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export const Route = createFileRoute("/_app/finance/")({
  component: FinanceDashboard,
});

function FinanceDashboard() {
  const invoices = ls.get("invoices", []) || [];
  const expenses = ls.get("expenses", []) || [];
  const banks = ls.get("bankAccounts", []) || [];
  const forecasts = ls.get("forecasts", []) || [];
  const revenue = invoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const expenseTotal = expenses.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const cash = banks.reduce((s, i) => s + (Number(i.balance) || 0), 0);

  return (
    <div>
      <PageHeader title="Finance Dashboard" subtitle="Revenue, expenses & cash flow at a glance" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Revenue" value={"PKR " + revenue.toLocaleString()} icon={TrendingUp} accent="success" />
        <StatCard label="Expenses" value={"PKR " + expenseTotal.toLocaleString()} icon={Wallet} accent="warning" />
        <StatCard label="Profit" value={"PKR " + (revenue - expenseTotal).toLocaleString()} icon={Receipt} accent="primary" />
        <StatCard label="Cash" value={"PKR " + cash.toLocaleString()} icon={Landmark} accent="info" />
      </div>
      <div className="bg-card border border-border rounded-2xl p-4 mt-5">
        <h3 className="font-semibold mb-3">Forecasted Profit</h3>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={forecasts}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="period" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-chart-1)" strokeWidth={2} />
              <Line type="monotone" dataKey="expense" stroke="var(--color-chart-4)" strokeWidth={2} />
              <Line type="monotone" dataKey="profit" stroke="var(--color-chart-2)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
