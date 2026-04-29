// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { ls } from "../services/localStorageService";
import StatCard from "../components/cards/StatCard";
import PageHeader from "../components/PageHeader";
import Sidebar from "../components/sidebar/Sidebar";
import { Building2, Users, Settings, Globe } from "lucide-react";

export const Route = createFileRoute("/_app/settings/company")({
  component: CompanyProfile,
});

function CompanyProfile() {
  const company = ls.get("company", {}) || {};
  const users = ls.get("users", []) || [];
  return (
    <div>
      <PageHeader title="Company Profile" subtitle="Master company information" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Company" value={company.name} icon={Building2} accent="primary" />
        <StatCard label="System" value={company.system} icon={Settings} accent="info" />
        <StatCard label="Currency" value={company.currency} icon={Globe} accent="success" />
        <StatCard label="Users" value={users.length} icon={Users} accent="warning" />
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 mt-5">
        <h3 className="font-semibold mb-3">Details</h3>
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          {Object.entries(company).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-border py-2">
              <dt className="text-muted-foreground capitalize">{k}</dt>
              <dd className="font-medium">{String(v)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
