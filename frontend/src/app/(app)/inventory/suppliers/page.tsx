"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/PageHeader";
import { TableView, type Column } from "@/components/reuseable/TableGridView";
import { StatsCards } from "@/components/reuseable/StatsCards";
import { DetailPanel } from "@/components/inventory/supplier&vendor/DetailPanel";
import { FormModal } from "@/components/inventory/supplier&vendor/FormModal";
import { useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier, type Supplier } from "@/hooks/useSuppliers";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor, type Vendor } from "@/hooks/useVendors";

// Helper to render status badge
const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, string> = {
    active: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    inactive: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
    suspended: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  };
  return (
    <Badge variant="outline" className={variants[status] || ""}>
      {status}
    </Badge>
  );
};

// Rating display with stars
const RatingStars = ({ rating }: { rating: number }) => {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rating ? "text-yellow-500" : "text-gray-300 dark:text-gray-600"}>
          ★
        </span>
      ))}
      <span className="ml-1 text-xs text-muted-foreground">({rating})</span>
    </div>
  );
};



// Form fields configuration
const formFields = [
  { name: "code", label: "Code", type: "text", required: true, placeholder: "e.g., SUP-001" },
  { name: "name", label: "Name", type: "text", required: true, placeholder: "Company name" },
  { name: "contact_person", label: "Contact Person", type: "text", placeholder: "Full name" },
  { name: "email", label: "Email", type: "email", placeholder: "contact@company.com" },
  { name: "phone", label: "Phone", type: "tel", placeholder: "+1 234 567 8900" },
  { name: "address_line", label: "Address Line", type: "textarea", placeholder: "Street address" },
  { name: "country", label: "Country", type: "text", placeholder: "Country" },
  { name: "state", label: "State", type: "text", placeholder: "State/Province" },
  { name: "city", label: "City", type: "text", placeholder: "City" },
  { name: "postal_code", label: "Postal Code", type: "text", placeholder: "Postal code" },
  { name: "payment_terms", label: "Payment Terms", type: "text", placeholder: "Net 30" },
  { name: "credit_limit", label: "Credit Limit", type: "number", step: "0.01", placeholder: "0.00" },
  { name: "balance", label: "Balance", type: "number", step: "0.01", placeholder: "0.00" },
  { name: "rating", label: "Rating (1-5)", type: "number", min: 1, max: 5, placeholder: "5" },
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



export default function SuppliersVendorsPage() {
  const [activeTab, setActiveTab] = useState<"suppliers" | "vendors">("suppliers");
  const [selectedItem, setSelectedItem] = useState<Supplier | Vendor | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Supplier | Vendor | null>(null);
  const { formatCurrency } = useCompanySettings();
  const { confirm, Modal: ConfirmationModal } = useConfirmationModal();

  // Suppliers hooks
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  // Vendors hooks
  const { data: vendors, isLoading: vendorsLoading } = useVendors();
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();
  const currentData = activeTab === "suppliers" ? suppliers : vendors;
  const isLoading = activeTab === "suppliers" ? suppliersLoading : vendorsLoading;
  const createMutation = activeTab === "suppliers" ? createSupplier : createVendor;
  const updateMutation = activeTab === "suppliers" ? updateSupplier : updateVendor;
  const deleteMutation = activeTab === "suppliers" ? deleteSupplier : deleteVendor;

  // Calculate stats from current data
  const stats = useMemo(() => {
    if (!currentData || currentData.length === 0) {
      return [
        { id: "total", label: "Total", value: 0 },
        { id: "active", label: "Active", value: 0 },
        { id: "credit", label: "Total Credit Limit", value: "$0" },
        { id: "rating", label: "Average Rating", value: "0.0" },
      ];
    }

    const total = currentData.length;
    const active = currentData.filter((item) => item.status === "active").length;
    const totalCredit = currentData.reduce((sum, item) => sum + (item.credit_limit || 0), 0);
    const avgRating = currentData.reduce((sum, item) => sum + (item.rating || 0), 0) / total;

    return [
      { id: "total", label: "Total", value: total, valueClassName: "text-2xl font-bold" },
      { id: "active", label: "Active", value: active, valueClassName: "text-green-600 dark:text-green-400" },
      { id: "credit", label: "Total Credit Limit", value: formatCurrency(totalCredit), valueClassName: "text-blue-600 dark:text-blue-400" },
      { id: "rating", label: "Average Rating", value: avgRating, valueClassName: "text-yellow-600 dark:text-yellow-400" },
    ];
  }, [currentData]);

// Define columns for TableView
  const getTableColumns = (): Column<Supplier>[] => [
  { key: "code", label: "Code", sortable: true },
  { key: "name", label: "Name", sortable: true },
  { key: "contact_person", label: "Contact Person", sortable: true },
  { key: "email", label: "Email", sortable: true },
  { key: "phone", label: "Phone", sortable: true },
  { key: "payment_terms", label: "Payment Terms", sortable: true },
  {
    key: "credit_limit",
    label: "Credit Limit",
    sortable: true,
    render: (value) => <span className="font-medium">{formatCurrency(value as number)}</span>,
    sortAccessor: (row) => row.credit_limit,
  },
  {
    key: "balance",
    label: "Balance",
    sortable: true,
    render: (value) => <span className={Number(value) > 0 ? "text-yellow-600" : "text-green-600"}>{formatCurrency(value as number)}</span>,
    sortAccessor: (row) => row.balance,
  },
  {
    key: "rating",
    label: "Rating",
    sortable: true,
    render: (value) => <RatingStars rating={value as number} />,
    sortAccessor: (row) => row.rating,
  },
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
  { label: "Payment Terms", key: "payment_terms" },
  { label: "Credit Limit", key: "credit_limit", formatter: (val: number) => formatCurrency(val) },
  { label: "Current Balance", key: "balance", formatter: (val: number) => formatCurrency(val) },
  { label: "Rating", key: "rating", formatter: (val: number) => <RatingStars rating={val} /> },
  { label: "Status", key: "status", formatter: (val: string) => <StatusBadge status={val} /> },
  { label: "Created", key: "created_at", formatter: (val: string) => new Date(val).toLocaleDateString() },
  { label: "Last Updated", key: "updated_at", formatter: (val: string) => new Date(val).toLocaleString() },
];
  const handleAdd = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleEdit = (item: Supplier | Vendor) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = async (item: Supplier | Vendor) => {
    confirm({
      title: `Delete ${activeTab === "suppliers" ? "Supplier" : "vendor"}`,
      message: `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
      type: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        await deleteMutation.mutateAsync(item.id);
        if (selectedItem?.id === item.id) setSelectedItem(null);
      },
    });
  };

  const handleFormSubmit = async (data: any) => {
    if (editingItem) {
      await updateMutation.mutateAsync({ id: editingItem.id, ...data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setModalOpen(false);
    setEditingItem(null);
  };

  const tableColumns = getTableColumns();

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="">
          <PageHeader
            title="Suppliers & Vendors"
            subtitle="Manage your business partners"
            actions={
              <Button onClick={handleAdd} className="shadow-sm">
                Add {activeTab === "suppliers" ? "Supplier" : "Vendor"}
              </Button>
            }
          />

          {/* Stats Cards */}
          <StatsCards stats={stats} className="mt-6" />

          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v as any);
            setSelectedItem(null);
          }} className="mt-6">
            <TabsList className="grid w-[300px] grid-cols-2">
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
              <TabsTrigger value="vendors">Vendors</TabsTrigger>
            </TabsList>

            <TabsContent value="suppliers" className="mt-4">
              <TableView
                columns={tableColumns}
                data={suppliers || []}
                loading={suppliersLoading}
                onRowClick={(row) => setSelectedItem(row)}
                actions={(row) => (
                  <>
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
                  </>
                )}
              />
            </TabsContent>

            <TabsContent value="vendors" className="mt-4">
              <TableView
                columns={tableColumns}
                data={vendors || []}
                loading={vendorsLoading}
                onRowClick={(row) => setSelectedItem(row)}
                actions={(row) => (
                  <>
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
                  </>
                )}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right side detail panel */}
      {selectedItem && (
        <DetailPanel
          data={selectedItem}
          fields={detailFields}
          onClose={() => setSelectedItem(null)}
          onEdit={() => handleEdit(selectedItem)}
          onDelete={() => handleDelete(selectedItem)}
        />
      )}

      {/* Modals */}
      <FormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        title={editingItem ? `Edit ${activeTab === "suppliers" ? "Supplier" : "Vendor"}` : `Add New ${activeTab === "suppliers" ? "Supplier" : "Vendor"}`}
        fields={formFields}
        initialData={editingItem || {}}
        onSubmit={handleFormSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
      
      <ConfirmationModal />
    </div>
  );
}