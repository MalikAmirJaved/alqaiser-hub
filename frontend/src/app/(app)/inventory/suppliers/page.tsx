"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/PageHeader";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { DetailPanel } from "@/components/inventory/supplier/DetailPanel";
import { FormModal } from "@/components/inventory/supplier/FormModal";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier, type Supplier } from "@/hooks/useSuppliers";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useRouter } from 'next/navigation';
import { useAutoCode } from "@/hooks/useAutoCode";

// Helper to render status badge
const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    active: "bg-success/15 text-success",
    inactive: "bg-muted/40 text-muted-foreground",
    suspended: "bg-destructive/15 text-destructive",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${colors[status] || "bg-muted/40 text-muted-foreground"}`}>
      {status}
    </span>
  );
};

// Form fields configuration (only supplier-specific)
const formFields = [
  { name: "code", label: "Code", type: "code", required: true, placeholder: "e.g., SUP-001" },
  { name: "name", label: "Name", type: "text", required: true, placeholder: "Company name" },
  { name: "contact_person", label: "Contact Person", type: "text", placeholder: "Full name" },
  { name: "email", label: "Email", type: "email", placeholder: "contact@company.com" },
  { name: "phone", label: "Phone", type: "tel", minLength: 7, maxLength: 20, placeholder: "+1 234 567 8900" },
  { name: "address_line", label: "Address Line", type: "textarea", placeholder: "Street address" },
  { name: "country", label: "Country", type: "text", placeholder: "Country" },
  { name: "state", label: "State", type: "text", placeholder: "State/Province" },
  { name: "city", label: "City", type: "text", placeholder: "City" },
  { name: "postal_code", label: "Postal Code", type: "text", placeholder: "Postal code" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
      { value: "suspended", label: "Suspended" },
    ],
  },
];

export default function SuppliersPage() {
    const permissions = useFeaturePermissions("INVENTORY", "supplier");
  const [selectedItem, setSelectedItem] = useState<Supplier | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);
  const { confirm, Modal: ConfirmationModal } = useConfirmationModal();
  const router = useRouter();

  const { generateCode, validateCode } = useAutoCode("supplier");

  // Suppliers hooks
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const handleView = (supplier: Supplier) => router.push(`suppliers/${supplier.id}`);

  // Calculate stats from current data
  const stats = useMemo(() => {
    if (!suppliers || suppliers.length === 0) {
      return [
        { id: "total", label: "Total", value: 0 },
        { id: "active", label: "Active", value: 0 },
      ];
    }

    const total = suppliers.length;
    const active = suppliers.filter((item) => item.status === "active").length;

    return [
      { id: "total", label: "Total", value: total, valueClassName: "text-2xl font-bold" },
      { id: "active", label: "Active", value: active, valueClassName: "text-green-600 dark:text-green-400" },
    ];
  }, [suppliers]);

  // Define columns for TableView
  const getTableColumns = (): Column<Supplier>[] => [
    { key: "code", label: "Code", sortable: true },
    { key: "name", label: "Name", sortable: true },
    { key: "contact_person", label: "Contact Person", sortable: true },
    { key: "email", label: "Email", sortable: true },
    { key: "phone", label: "Phone", sortable: true },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => <StatusBadge status={value as string} />,
      sortAccessor: (row) => row.status,
    },
  ];

  // Detail fields configuration
  const detailFields = [
    { label: "Code", key: "code" },
    { label: "Name", key: "name" },
    { label: "Contact Person", key: "contact_person" },
    { label: "Email", key: "email" },
    { label: "Phone", key: "phone" },
    { label: "Address", key: "address_line" },
    { label: "Location", key: (row: Supplier) => `${row.city}, ${row.state}, ${row.country}` },
    { label: "Postal Code", key: "postal_code" },
    { label: "Status", key: "status", formatter: (val: string) => <StatusBadge status={val} /> },
    { label: "Created", key: "created_at", formatter: (val: string) => new Date(val).toLocaleDateString() },
    { label: "Last Updated", key: "updated_at", formatter: (val: string) => new Date(val).toLocaleString() },
  ];

  const handleAdd = () => {
    setEditingItem(null);
    generateCode().then(code => {
      setEditingItem({ code } as any);
      setModalOpen(true);
    }).catch(() => setModalOpen(true));
  };

  const handleEdit = (item: Supplier) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = async (item: Supplier) => {
    confirm({
      title: "Delete Supplier",
      message: `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
      type: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        await deleteSupplier.mutateAsync(item.id);
        if (selectedItem?.id === item.id) setSelectedItem(null);
      },
    });
  };

  const handleFormSubmit = async (data: any) => {
    if (editingItem) {
      await updateSupplier.mutateAsync({ id: editingItem.id, ...data });
    } else {
      await createSupplier.mutateAsync(data);
    }
    setModalOpen(false);
    setEditingItem(null);
  };

  const tableColumns = getTableColumns();

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        <div>
          <PageHeader
            title="Suppliers"
            subtitle="Manage your business suppliers"
            actions={
              permissions.create && (
                <Button onClick={handleAdd} className="shadow-sm">
                  Add Supplier
                </Button>
              )
            }
          />

          {/* Stats Cards */}
          <StatsCards stats={stats} className="mt-6" />

          <div className="mt-6">
            <TableView
              columns={tableColumns}
              data={suppliers || []}
              loading={suppliersLoading}
              onRowClick={handleView}
              actions={(row) => (
                <>
                  {permissions.update && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(row);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {permissions.delete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(row);
                      }}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            />
          </div>
        </div>
      </div>

      {/* Right side detail panel */}
      {selectedItem && (
        <DetailPanel
          data={selectedItem}
          fields={detailFields}
          onClose={() => setSelectedItem(null)}
          onEdit={permissions.update ? () => handleEdit(selectedItem) : undefined}
          onDelete={permissions.delete ? () => handleDelete(selectedItem) : undefined}
        />
      )}

      {/* Form Modal */}
      <FormModal
        open={modalOpen && (editingItem ? permissions.update : permissions.create)}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        title={editingItem ? "Edit Supplier" : "Add New Supplier"}
        fields={formFields}
        initialData={editingItem || {}}
        onSubmit={handleFormSubmit}
        isSubmitting={createSupplier.isPending || updateSupplier.isPending}
        onGenerateCode={generateCode}
        onValidateCode={validateCode}
      />
      
      <ConfirmationModal />
    </div>
  );
}