"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import debounce from "lodash/debounce";
import { DetailLayout, StandardSidebar } from "@/components/reuseable/final/DetailLayout";
import { useWarehouse, useUpdateWarehouse, useDeleteWarehouse } from "@/hooks/useWarehouses";
import { useCurrentStock, useStockHistory } from "@/hooks/useStockManagement";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { WarehouseForm } from "@/components/inventory/warehouse/WarehouseForm";
import { ConfirmationModal, useConfirmationModal } from "@/components/reuseable/ConfirmationModal";
import { usePagination } from "@/hooks/usePagination";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { format } from "date-fns";

export default function WarehouseDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: warehouse, isLoading: warehouseLoading } = useWarehouse(id);
  const permissions = useFeaturePermissions("INVENTORY", "warehouse");
  const updateWarehouse = useUpdateWarehouse();
  const deleteWarehouse = useDeleteWarehouse();
  const deleteConfirm = useConfirmationModal();
  const { confirm, Modal: ConfirmationModal } = deleteConfirm;

  const [editing, setEditing] = useState(false);
  const stockPagination = usePagination();
  const historyPagination = usePagination();

  // Stock tab search
  const [stockSearchTerm, setStockSearchTerm] = useState("");
  const [debouncedStockSearch, setDebouncedStockSearch] = useState("");

  const debouncedSetStockSearch = useCallback(
    debounce((value: string) => setDebouncedStockSearch(value), 300),
    []
  );

  useEffect(() => {
    return () => { debouncedSetStockSearch.cancel(); };
  }, [debouncedSetStockSearch]);

  // Reset pages when warehouse changes
  useEffect(() => {
    stockPagination.resetPage();
    historyPagination.resetPage();
    setDebouncedStockSearch("");
    setStockSearchTerm("");
  }, [id]);

  // Reset stock page when search changes
  useEffect(() => {
    stockPagination.resetPage();
  }, [debouncedStockSearch]);

  const { data: stockData, isLoading: stockLoading } = useCurrentStock({
    warehouse_id: id,
    page: stockPagination.page,
    page_size: 20,
    search: debouncedStockSearch || undefined,
  });

  const { data: historyData, isLoading: historyLoading } = useStockHistory({
    warehouse_id: id,
    page: historyPagination.page,
    page_size: 20,
  });

  const totalStock = stockData?.count ?? 0;
  const stockPageSize = stockData?.page_size ?? 20;
  const totalPages = Math.ceil(totalStock / stockPageSize);
  const totalHistory = historyData?.count ?? 0;
  const historyPageSize = historyData?.page_size ?? 20;
  const historyTotalPages = Math.ceil(totalHistory / historyPageSize);

  const lowStockCount = (stockData?.results || []).filter(
    (item: any) => item.quantity_available <= 10
  ).length;

  if (warehouseLoading || !warehouse) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  const handleEdit = () => setEditing(true);

  const handleDelete = () => {
    deleteConfirm.confirm({
      title: "Delete Warehouse",
      message: `Are you sure you want to delete "${warehouse.warehouse_name}"? This action cannot be undone.`,
      onConfirm: async () => {
        await deleteWarehouse.mutateAsync(warehouse.id);
        router.push("/inventory/warehouses");
      },
    });
  };

  const handleSubmitForm = async (formData: any) => {
    await updateWarehouse.mutateAsync({ id: warehouse.id, ...formData });
    setEditing(false);
  };

  const locationStr = [warehouse.city, warehouse.state, warehouse.country].filter(Boolean).join(", ");

  return (
    <>
      <DetailLayout
        breadcrumbs={["Inventory", "Warehouses", warehouse.code]}
        entityId={warehouse.code}
        title={warehouse.warehouse_name}
        status={warehouse.is_active ? "Active" : "Inactive"}
        subtitle={locationStr || warehouse.email || undefined}
        data={warehouse}
        meta={[
          { label: "Responsible", value: warehouse.employee_name || "—" },
          { label: "Email", value: warehouse.email || "—" },
          { label: "Phone", value: warehouse.landline_number || "—" },
          { label: "Postal Code", value: warehouse.postal_code || "—" },
        ]}
        summary={[
          {
            label: "Stock Items",
            value: totalStock,
            sub: lowStockCount > 0 ? `${lowStockCount} low stock` : undefined,
          },
          {
            label: "Responsible",
            value: warehouse.employee_name || "Unassigned",
            tone: warehouse.employee_name ? "success" : "warning",
          },
          {
            label: "Status",
            value: warehouse.is_active ? "Active" : "Inactive",
            tone: warehouse.is_active ? "success" : "destructive",
          },
          {
            label: "Created",
            value: format(new Date(warehouse.created_at), "dd MMM yyyy"),
          },
        ]}
        onEdit={permissions.update ? handleEdit : undefined}
        permissions={{ edit: permissions.update }}
        tabs={[
          {
            id: "overview",
            label: "Overview",
            render: () => (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Address & Location</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      ["Address Line", warehouse.address_line || "—"],
                      ["City", warehouse.city || "—"],
                      ["State", warehouse.state || "—"],
                      ["Country", warehouse.country || "—"],
                      ["Postal Code", warehouse.postal_code || "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contact Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      ["Email", warehouse.email || "—"],
                      ["Landline", warehouse.landline_number || "—"],
                      ["Responsible Person", warehouse.employee_name || "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {warehouse.description && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Description</h4>
                    <p className="text-sm text-foreground">{warehouse.description}</p>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">System Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[
                      ["Created", format(new Date(warehouse.created_at), "dd MMM yyyy, HH:mm")],
                      ["Last Updated", format(new Date(warehouse.updated_at), "dd MMM yyyy, HH:mm")],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: "stock",
            label: "Stock Items",
            count: totalStock,
            render: () => (
              <div>
                {/* Search input */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by product name, SKU, or barcode..."
                    value={stockSearchTerm}
                    onChange={(e) => {
                      setStockSearchTerm(e.target.value);
                      debouncedSetStockSearch(e.target.value);
                    }}
                    className="pl-9 h-9"
                  />
                </div>

                {stockLoading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Loading stock...</div>
                ) : !stockData || stockData.results.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {debouncedStockSearch ? "No stock items match your search" : "No stock items"}
                  </div>
                ) : (
                  <div>
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b border-border">
                        <tr className="text-left">
                          <th className="py-2 pr-4">Variant</th>
                          <th className="py-2 pr-4">SKU</th>
                          <th className="py-2 pr-4 text-right">On Hand</th>
                          <th className="py-2 pr-4 text-right">Reserved</th>
                          <th className="py-2 pr-4 text-right">Available</th>
                          <th className="py-2 pr-4">Bin Location</th>
                          <th className="py-2">Last Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockData.results.map((item: any) => (
                          <tr key={item.id} className="border-b border-border/60 hover:bg-muted/30">
                            <td className="py-2 pr-4 font-medium">{item.variant_name}</td>
                            <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{item.variant_sku}</td>
                            <td className="py-2 pr-4 text-right num">{item.quantity_on_hand}</td>
                            <td className="py-2 pr-4 text-right num text-warning">{item.quantity_reserved}</td>
                            <td className="py-2 pr-4 text-right num font-semibold text-success">{item.quantity_available}</td>
                            <td className="py-2 pr-4">{item.bin_location || "—"}</td>
                            <td className="py-2 text-xs text-muted-foreground">
                              {format(new Date(item.updated_at), "dd MMM yy, HH:mm")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                      <span>Page {stockPagination.page} of {totalPages}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={stockPagination.prevPage}
                          disabled={stockPagination.page <= 1}
                          className="px-3 py-1 rounded-md bg-muted text-xs font-medium disabled:opacity-40 hover:bg-accent transition-colors"
                        >
                          Previous
                        </button>
                        <button
                          onClick={stockPagination.nextPage}
                          disabled={stockPagination.page >= totalPages}
                          className="px-3 py-1 rounded-md bg-muted text-xs font-medium disabled:opacity-40 hover:bg-accent transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ),
          },
          {
            id: "history",
            label: "Transaction History",
            count: totalHistory,
            render: () =>
              historyLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading history...</div>
              ) : !historyData || historyData.results.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No transactions</div>
              ) : (
                <div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b border-border">
                        <tr className="text-left">
                          <th className="py-2 pr-4">Date</th>
                          <th className="py-2 pr-4">Variant</th>
                          <th className="py-2 pr-4 text-right">Change</th>
                          <th className="py-2 pr-4">Type</th>
                          <th className="py-2 pr-4">Reason</th>
                          <th className="py-2 pr-4">Before → After</th>
                          <th className="py-2">By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.results.map((tx: any) => (
                          <tr key={tx.id} className="border-b border-border/60 hover:bg-muted/30">
                            <td className="py-2 pr-4 text-xs whitespace-nowrap text-muted-foreground">
                              {format(new Date(tx.created_at), "dd MMM yy, HH:mm")}
                            </td>
                            <td className="py-2 pr-4">
                              <div className="font-medium">{tx.variant_name || tx.variant_sku}</div>
                              <div className="text-xs text-muted-foreground font-mono">{tx.variant_sku}</div>
                            </td>
                            <td className={`py-2 pr-4 text-right num font-medium ${tx.quantity_change > 0 ? "text-success" : "text-destructive"}`}>
                              {tx.quantity_change > 0 ? `+${tx.quantity_change}` : tx.quantity_change}
                            </td>
                            <td className="py-2 pr-4">
                              <span className="inline-flex px-2 py-0.5 rounded text-xs bg-muted font-medium">
                                {tx.transaction_type_display}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-xs text-muted-foreground">{tx.reason_text || "—"}</td>
                            <td className="py-2 pr-4 text-xs font-mono">{tx.quantity_before} → {tx.quantity_after}</td>
                            <td className="py-2 text-xs">{tx.created_by_name || tx.created_by_email || "System"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {historyTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                      <span>Page {historyPagination.page} of {historyTotalPages}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={historyPagination.prevPage}
                          disabled={historyPagination.page <= 1}
                          className="px-3 py-1 rounded-md bg-muted text-xs font-medium disabled:opacity-40 hover:bg-accent transition-colors"
                        >
                          Previous
                        </button>
                        <button
                          onClick={historyPagination.nextPage}
                          disabled={historyPagination.page >= historyTotalPages}
                          className="px-3 py-1 rounded-md bg-muted text-xs font-medium disabled:opacity-40 hover:bg-accent transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ),
          },
          {
            id: "related",
            label: "Related",
            render: () => (
              <div className="text-sm text-muted-foreground">
                Related records will appear here (purchase orders, transfers, etc.)
              </div>
            ),
          },
        ]}
        sidebar={
          <StandardSidebar
            metadata={[
              ["Code", warehouse.code],
              ["Name", warehouse.warehouse_name],
              ["City", warehouse.city || "—"],
              ["Country", warehouse.country || "—"],
              ["Email", warehouse.email || "—"],
              ["Phone", warehouse.landline_number || "—"],
              ["Postal Code", warehouse.postal_code || "—"],
              ["Status", warehouse.is_active ? "Active" : "Inactive"],
              ["Created", format(new Date(warehouse.created_at), "dd MMM yyyy")],
              ["Updated", format(new Date(warehouse.updated_at), "dd MMM yyyy")],
            ]}
          />
        }
      />

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">Edit Warehouse</h2>
            </div>
            <div className="p-6">
              <WarehouseForm
                initialData={warehouse}
                onSubmit={handleSubmitForm}
                onCancel={() => setEditing(false)}
                isLoading={updateWarehouse.isPending}
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal />
    </>
  );
}