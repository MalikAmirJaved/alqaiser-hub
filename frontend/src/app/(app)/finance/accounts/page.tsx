"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import {
  useAccounts,
  useAccountBalances,
  accountTypeOptions,
  type AccountBalance,
} from "@/hooks/finance/useAccounts";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { PageHeader, Card, ToolbarButton } from "@/components/finance/ui";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import { Plus, Download, Upload, ChevronRight, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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

/** Build the account tree and merge live balances keyed by account code */
function buildTree(
  accounts: any[],
  balanceMap: Record<string, number>,
): AccountNode[] {
  const map = new Map<string, AccountNode>();
  const roots: AccountNode[] = [];

  accounts.forEach((acc) => {
    // Look up balance by account code from the live balances endpoint
    const balance = balanceMap[acc.code] ?? 0;
    const node: AccountNode = {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      account_type: acc.account_type,
      parent: acc.parent,
      is_active: acc.is_active,
      description: acc.description,
      balance,
      children: [],
    };
    map.set(acc.id, node);
  });

  accounts.forEach((acc) => {
    const node = map.get(acc.id)!;
    if (acc.parent && map.has(acc.parent)) {
      map.get(acc.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortByCode = (nodes: AccountNode[]) =>
    nodes.sort((a, b) => a.code.localeCompare(b.code));
  sortByCode(roots);
  roots.forEach((root) => sortByCode(root.children));
  return roots;
}

/** Aggregated totals by account_type from the live balance map */
function computeSummary(
  accounts: any[],
  balanceMap: Record<string, number>,
): { type: string; label: string; balance: number }[] {
  const totals: Record<string, number> = {};
  accounts.forEach((acc) => {
    const b = balanceMap[acc.code] ?? 0;
    totals[acc.account_type] = (totals[acc.account_type] || 0) + b;
  });
  return [
    { type: "ASSET", label: "Assets", balance: totals.ASSET || 0 },
    { type: "LIABILITY", label: "Liabilities", balance: totals.LIABILITY || 0 },
    { type: "EQUITY", label: "Equity", balance: totals.EQUITY || 0 },
    { type: "INCOME", label: "Revenue", balance: totals.INCOME || 0 },
    { type: "EXPENSE", label: "Expenses", balance: totals.EXPENSE || 0 },
  ];
}

function AccountRow({
  node,
  depth = 0,
  filterType,
  searchTerm,
  onRowClick,
}: {
  node: AccountNode;
  depth: number;
  filterType: string;
  searchTerm: string;
  onRowClick: (account: AccountNode) => void;
}) {
  const formatCurrency = useFormatCurrency();
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const matchesFilter =
    filterType === "All" || node.account_type === filterType;
  const matchesSearch =
    searchTerm === "" ||
    node.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.name.toLowerCase().includes(searchTerm.toLowerCase());
  if (!matchesFilter || !matchesSearch) return null;

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
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(!open);
                }}
                className="mr-1 text-muted-foreground hover:text-foreground"
              >
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="w-4 mr-1" />
            )}
            <span className="font-mono text-xs text-primary mr-3">
              {node.code}
            </span>
            <span
              className={
                depth === 0
                  ? "font-semibold"
                  : depth === 1
                    ? "font-medium"
                    : ""
              }
            >
              {node.name}
            </span>
          </div>
        </td>
        <td className="px-4 py-2.5">
          <span
            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${typeColor[node.account_type]}`}
          >
            {typeLabels[node.account_type]}
          </span>
        </td>
        <td className="px-4 py-2.5 num font-medium">
          {formatCurrency(node.balance)}
        </td>
        <td className="px-4 py-2.5">
          {node.is_active ? (
            <span className="text-xs text-success">● Active</span>
          ) : (
            <span className="text-xs text-muted-foreground">Inactive</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-xs text-muted-foreground">USD</td>
      </tr>
      {open &&
        hasChildren &&
        node.children.map((child) => (
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
  const formatCurrency = useFormatCurrency();
  const router = useRouter();
  const permissions = useFeaturePermissions("FINANCE", "account");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  // Extract filter values
  const searchTerm = filters.search || "";
  const filterType = filters.account_type || "All";
  const startDate = filters.start_date || "";
  const endDate = filters.end_date || "";

  // Filter fields including date range
  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
    {
      name: "account_type",
      label: "Type",
      type: "select",
      options: [
        { value: "All", label: "All Types" },
        ...accountTypeOptions,
      ],
    },
    { name: "start_date", label: "From", type: "date" },
    { name: "end_date", label: "To", type: "date" },
  ];

  // Fetch accounts list
  const { data: accounts, isLoading: accountsLoading } = useAccounts(
    filters.account_type && filters.account_type !== "All"
      ? { account_type: filters.account_type }
      : undefined,
  );

  // Fetch LIVE balances from the balances endpoint (with optional date range)
  const dateRangeParams =
    startDate || endDate
      ? {
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        }
      : undefined;
  const { data: balancesData, isLoading: balancesLoading } =
    useAccountBalances(dateRangeParams);

  // Build a balance map keyed by account CODE (from the live balances endpoint)
  const balanceMap = useMemo(() => {
    if (!balancesData) return {};
    const map: Record<string, number> = {};
    Object.values(balancesData).forEach((entry: AccountBalance) => {
      map[entry.code] = Number(entry.balance);
    });
    return map;
  }, [balancesData]);

  // Build the hierarchical tree
  const tree = useMemo(() => {
    if (!accounts) return [];
    return buildTree(accounts, balanceMap);
  }, [accounts, balanceMap]);

  // Compute summary totals per account type
  const summary = useMemo(() => {
    if (!accounts) return [];
    return computeSummary(accounts, balanceMap);
  }, [accounts, balanceMap]);

  const handleRowClick = (account: AccountNode) => {
    router.push(`/finance/accounts/${account.id}`);
  };

  return (
    <>
      <PageHeader
        breadcrumbs={["General Ledger", "Chart of Accounts"]}
        title="Chart of Accounts"
        description="Hierarchical account structure across Assets, Liabilities, Equity, Revenue, and Expense."
      />
      <div className="p-6 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {summary.map((s) => (
            <Card key={s.type} className="px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                {s.label}
              </div>
              <div className="text-sm font-semibold mt-1">{s.label}</div>
              <div className="text-lg num font-semibold mt-1">
                {formatCurrency(s.balance)}
              </div>
            </Card>
          ))}
        </div>

        {/* Accounts table with filters */}
        <Card>
          <div className="px-4 py-3 border-b border-border">
            <FilterBar
              fields={filterFields}
              filters={filters}
              onChange={setFilters}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border bg-surface/40">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium ">
                    Balance
                  </th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Curr</th>
                </tr>
              </thead>
              <tbody>
                {accountsLoading || balancesLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/60">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3.5 w-3.5 rounded" />
                          <Skeleton className="h-3.5 w-16" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </td>
                      <td className="px-4 py-2.5"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-4 py-2.5"><Skeleton className="h-4 w-20 ml-auto" /></td>
                      <td className="px-4 py-2.5"><Skeleton className="h-4 w-14" /></td>
                      <td className="px-4 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    </tr>
                  ))
                ) : tree.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No accounts found. Run the seed script first.
                    </td>
                  </tr>
                ) : (
                  tree.map((root) => (
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
