"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCustomers, useDeleteCustomer, Customer, useCreateCustomer, useUpdateCustomer } from "@/hooks/useCustomers";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { StatsCards } from "@/components/reuseable/StatsCards";
import PageHeader from "@/components/PageHeader";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { Plus, Eye, Edit, Trash2 } from "lucide-react";
import CustomerForm from "@/components/inventory/customers/CustomerForm";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { usePagination } from "@/hooks/usePagination";

interface CustomersPanelProps {
  moduleCode: "INVENTORY" | "SALES";
}

export default function CustomersPanel({ moduleCode }: CustomersPanelProps) {
  const permissions = useFeaturePermissions(moduleCode, moduleCode === "SALES" ? "sales_customer" : "customer");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const pagination = usePagination();

  const customerFilters = useMemo(() => {
    const f: Record<string, string> = { page: String(pagination.page) };
    if (search) f.search = search;
    return f;
  }, [search, pagination.page]);

  const { data: customers = [], isLoading, refetch, totalCount } = useCustomers(customerFilters);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const { confirm, Modal: ConfirmModal } = useConfirmationModal();

  // Stats
  const activeCount = customers.filter(c => c.is_active).length;
  const stats = [
    { id: "total", label: "Total Customers", value: customers.length },
    { id: "active", label: "Active", value: activeCount, valueClassName: "text-success" },
    { id: "inactive", label: "Inactive", value: customers.length - activeCount, valueClassName: "text-muted-foreground" },
  ];

  const columns: Column<Customer>[] = [
    { key: "customer_code", label: "Code", sortable: true },
    { key: "name", label: "Name", sortable: true },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "city", label: "City" },
    {
      key: "is_active",
      label: "Status",
      render: (_, row) => (
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            row.is_active
              ? "bg-success/20 text-success"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {row.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  const handleCreate = async (data: any) => {
    await createCustomer.mutateAsync(data);
    setShowForm(false);
    refetch();
  };

  const handleUpdate = async (data: any) => {
    if (editingCustomer) {
      await updateCustomer.mutateAsync({ id: editingCustomer.id, data });
      setEditingCustomer(null);
      setShowForm(false);
      refetch();
    }
  };

  const handleDelete = (id: string, name: string) => {
    confirm({
      title: "Delete Customer",
      message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      onConfirm: async () => {
        await deleteCustomer.mutateAsync(id);
        refetch();
      },
    });
  };

  const detailPathPrefix = moduleCode === "INVENTORY" ? "/inventory/customers" : "/sales/customers";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        subtitle="Manage your customer base"
        actions={
          permissions.create && (
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm">
              <Plus className="w-4 h-4" /> Add Customer
            </button>
          )
        }
      />

      <StatsCards stats={stats} />

      <div className="flex justify-between items-center gap-3">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); pagination.resetPage(); }}
          className="max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <TableView<Customer>
        columns={columns}
        data={customers}
        loading={isLoading}
        onRowClick={(row) => router.push(`${detailPathPrefix}/${row.id}`)}
        totalCount={totalCount}
        currentPage={pagination.page}
        onPageChange={pagination.setPage}
        actions={(row) => (
          <>
            <button onClick={(e) => { e.stopPropagation(); router.push(`${detailPathPrefix}/${row.id}`); }} className="p-1 rounded hover:bg-muted">
              <Eye className="w-4 h-4" />
            </button>
            {permissions.update && (
              <button onClick={(e) => { e.stopPropagation(); setEditingCustomer(row); setShowForm(true); }} className="p-1 rounded hover:bg-muted">
                <Edit className="w-4 h-4" />
              </button>
            )}
            {permissions.delete && (
              <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id, row.name); }} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      />

      {/* Modal Form */}
      {showForm && (editingCustomer ? permissions.update : permissions.create) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-semibold mb-4">{editingCustomer ? "Edit Customer" : "New Customer"}</h2>
            <CustomerForm
              initialData={editingCustomer || undefined}
              onSubmit={editingCustomer ? handleUpdate : handleCreate}
              onCancel={() => { setShowForm(false); setEditingCustomer(null); }}
              isLoading={createCustomer.isPending || updateCustomer.isPending}
            />
          </div>
        </div>
      )}

      <ConfirmModal />
    </div>
  );
}
