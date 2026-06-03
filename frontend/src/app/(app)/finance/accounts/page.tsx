"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useAccounts } from "@/hooks/finance/useAccounts";
import { useTrialBalance } from "@/hooks/finance/useTrialBalance";
import { formatCurrency } from "@/lib/currency";
import { PageHeader, Card, ToolbarButton } from "@/components/finance/ui";
import { Plus, Download, Upload, ChevronRight, ChevronDown } from "lucide-react";
import AccountFormModal from "@/components/finance/accounts/AccountFormModal";

interface AccountNode {
  id: string;
  code: string;
  name: string;
  account_type: string;
  parent: string | null;
  is_active: boolean;
  description: string;
  balance: number;
  children: AccountNode[];
}

const typeColor: Record<string, string> = {
  ASSET: "text-info bg-info/10 border-info/20",
  LIABILITY: "text-warning bg-warning/10 border-warning/20",
  EQUITY: "text-primary bg-primary/10 border-primary/20",
  INCOME: "text-success bg-success/10 border-success/20",
  EXPENSE: "text-destructive bg-destructive/10 border-destructive/20",
};

const typeLabels: Record<string, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  INCOME: "Revenue",
  EXPENSE: "Expense",
};

function buildTree(accounts: any[], balances: Record<string, number>): AccountNode[] {
  const map = new Map<string, AccountNode>();
  const roots: AccountNode[] = [];

  accounts.forEach(acc => {
    const node: AccountNode = {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      account_type: acc.account_type,
      parent: acc.parent,
      is_active: acc.is_active,
      description: acc.description,
      balance: balances[acc.id] || 0,
      children: [],
    };
    map.set(acc.id, node);
  });

  accounts.forEach(acc => {
    const node = map.get(acc.id)!;
    if (acc.parent && map.has(acc.parent)) {
      map.get(acc.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortByCode = (nodes: AccountNode[]) => nodes.sort((a, b) => a.code.localeCompare(b.code));
  sortByCode(roots);
  roots.forEach(root => sortByCode(root.children));
  return roots;
}

function AccountRow({ node, depth = 0, filterType, searchTerm, onRowClick }: { 
  node: AccountNode; 
  depth: number; 
  filterType: string; 
  searchTerm: string;
  onRowClick: (account: AccountNode) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const matchesFilter = filterType === "All" || node.account_type === filterType;
  const matchesSearch = searchTerm === "" || node.code.toLowerCase().includes(searchTerm.toLowerCase()) || node.name.toLowerCase().includes(searchTerm.toLowerCase());
  const showRow = matchesFilter && matchesSearch;
  if (!showRow) return null;

  return (
    <>
      <tr 
        className="border-b border-border/60 hover:bg-surface-2/50 cursor-pointer"
        onClick={() => onRowClick(node)}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center" style={{ paddingLeft: depth * 20 }}>
            {hasChildren ? (
              <button 
                onClick={(e) => { e.stopPropagation(); setOpen(!open); }} 
                className="mr-1 text-muted-foreground hover:text-foreground"
              >
                {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : <span className="w-4 mr-1" />}
            <span className="font-mono text-xs text-primary mr-3">{node.code}</span>
            <span className={depth === 0 ? "font-semibold" : depth === 1 ? "font-medium" : ""}>{node.name}</span>
          </div>
        </td>
        <td className="px-4 py-2.5">
          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${typeColor[node.account_type]}`}>
            {typeLabels[node.account_type]}
          </span>
        </td>
        <td className="px-4 py-2.5 text-right num font-medium">{formatCurrency(node.balance)}</td>
        <td className="px-4 py-2.5">{node.is_active ? <span className="text-xs text-success">● Active</span> : <span className="text-xs text-muted-foreground">Inactive</span>}</td>
        <td className="px-4 py-2.5 text-xs text-muted-foreground">USD</td>
      </tr>
      {open && hasChildren && node.children.map(child => (
        <AccountRow 
          key={child.id} 
          node={child} 
          depth={depth + 1} 
          filterType={filterType} 
          searchTerm={searchTerm}
          onRowClick={onRowClick}
        />
      ))}
    </>
  );
}

export default function ChartOfAccountsPage() {
  const router = useRouter();
  const permissions = useFeaturePermissions("FINANCE", "account");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: trialBalance, isLoading: balanceLoading } = useTrialBalance();

  const balanceMap = useMemo(() => {
    if (!trialBalance?.data) return {};
    return trialBalance.data.reduce((acc, item) => {
      acc[item.account_id] = Number(item.balance);
      return acc;
    }, {} as Record<number, number>);
  }, [trialBalance]);

  const tree = useMemo(() => {
    if (!accounts) return [];
    return buildTree(accounts, balanceMap);
  }, [accounts, balanceMap]);

  const summary = useMemo(() => {
    if (!trialBalance?.data) return [];
    const totals: Record<string, number> = {};
    trialBalance.data.forEach(item => {
      const type = item.account_type;
      totals[type] = (totals[type] || 0) + Number(item.balance);
    });
    return [
      { type: "ASSET", label: "Assets", balance: totals.ASSET || 0 },
      { type: "LIABILITY", label: "Liabilities", balance: totals.LIABILITY || 0 },
      { type: "EQUITY", label: "Equity", balance: totals.EQUITY || 0 },
      { type: "INCOME", label: "Revenue", balance: totals.INCOME || 0 },
      { type: "EXPENSE", label: "Expenses", balance: totals.EXPENSE || 0 },
    ];
  }, [trialBalance]);

  const handleRowClick = (account: AccountNode) => {
    router.push(`/finance/accounts/${account.id}`);
  };

  return (
    <>
      <PageHeader
        breadcrumbs={["General Ledger", "Chart of Accounts"]}
        title="Chart of Accounts"
        description="Hierarchical account structure across Assets, Liabilities, Equity, Revenue, and Expense."
        actions={
          <>
            <ToolbarButton icon={Upload} variant="ghost">Import</ToolbarButton>
            <ToolbarButton icon={Download} variant="ghost">Export</ToolbarButton>
            {permissions.create && (
              <ToolbarButton icon={Plus} variant="primary" onClick={() => { setEditingAccount(null); setModalOpen(true); }}>
                New Account
              </ToolbarButton>
            )}
          </>
        }
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {summary.map(s => (
            <Card key={s.type} className="px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{s.label}</div>
              <div className="text-sm font-semibold mt-1">{s.label}</div>
              <div className="text-lg num font-semibold mt-1">{formatCurrency(s.balance)}</div>
            </Card>
          ))}
        </div>

        <Card>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <input
              placeholder="Search accounts…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-64 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary/60"
            />
            <div className="flex gap-2 text-xs">
              {["All", "ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-2.5 py-1 rounded-md border ${filterType === t ? "bg-surface-2 border-border-strong" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {t === "All" ? "All" : typeLabels[t as keyof typeof typeLabels]}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium text-right">Balance</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Curr</th>
                </tr>
              </thead>
              <tbody>
                {accountsLoading || balanceLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : tree.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No accounts found</td></tr>
                ) : (
                  tree.map(root => (
                    <AccountRow
                      key={root.id}
                      node={root}
                      depth={0}
                      filterType={filterType}
                      searchTerm={searchTerm}
                      onRowClick={handleRowClick}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <AccountFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialData={editingAccount}
      />
    </>
  );
}