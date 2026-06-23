// components/HRAssets/AssetsPanel.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useAssets, useAssetStats, useCreateAsset, useUpdateAsset, useDeleteAsset } from "@/hooks/useAssets";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Package,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit, Trash2, MoreVertical, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { AssetRequestFormModal } from "./AssetRequestFormModal";
import { AssetForm } from "./AssetForm";

export default function AssetsPanel() {
  const formatCurrency = useFormatCurrency();
  const permissions = useFeaturePermissions("HR", "emp_asset");

  const [searchQuery, setSearchQuery] = useState("");
  const { data: assets = [], isLoading } = useAssets(
    searchQuery ? { search: searchQuery } : undefined
  );
  const { data: stats } = useAssetStats();
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [requestForAsset, setRequestForAsset] = useState<any>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => { setPage(1); }, [searchQuery]);

  // Parse category from description
  const parseCategory = (description?: string) => {
    if (!description || !description.startsWith("Category: ")) return "";
    const lines = description.split("\n");
    return lines[0].replace("Category: ", "");
  };

  const stripCategoryFromDescription = (description?: string) => {
    if (!description || !description.startsWith("Category: ")) return description || "";
    const lines = description.split("\n");
    return lines.slice(1).join("\n");
  };

  const handleSubmit = async (formData: any) => {
    const finalDescription = formData.category
      ? `Category: ${formData.category}\n${formData.description || ""}`
      : formData.description || "";

    try {
      if (editing) {
        await updateAsset.mutateAsync({
          id: editing.id,
          name: formData.name,
          brand: formData.brand,
          serialNumber: formData.sku,
          description: finalDescription,
          isActive: true,
        });
      } else {
        await createAsset.mutateAsync({
          name: formData.name,
          brand: formData.brand || undefined,
          serial_number: formData.sku || undefined,
          total_quantity: formData.initialStock,
          available_quantity: formData.initialStock,
          description: finalDescription,
          is_active: true,
          purchase_date: new Date().toISOString().split("T")[0],
          purchase_price: 0,
        });
      }
      setShowForm(false);
      setEditing(null);
    } catch (error: any) {
      // apiFetch handles toast
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAsset.mutateAsync(id);
    } catch (error: any) {
      // apiFetch handles toast
    }
  };

  const openEditModal = (asset: any) => {
    setEditing(asset);
    setShowForm(true);
  };

  const openCreateModal = () => {
    setEditing(null);
    setShowForm(true);
  };

  const getInitialFormData = (asset: any) => {
    if (!asset) return undefined;
    return {
      id: asset.id,
      name: asset.name || "",
      brand: asset.brand || "",
      category: parseCategory(asset.description),
      sku: asset.serial_number || "",
      description: stripCategoryFromDescription(asset.description),
      initialStock: asset.total_quantity || 0,
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  // Stats cards data
  const statsCards = [
    { label: "Total Assets", value: stats?.totalAssets || assets.length },
    { label: "With Serial Numbers", value: stats?.withSerialNumbers || assets.filter(a => a.serial_number).length },
    { label: "Total Value", value: formatCurrency(stats?.totalValue ?? 0) },
    { label: "Active Warranty", value: stats?.activeWarranty || 0 },
  ];

  const totalPages = Math.max(1, Math.ceil(assets.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedAssets = assets.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Library"
        subtitle="Manage hardware inventory – laptops, monitors, peripherals, and more"
        actions={
          permissions.create && (
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add Asset
            </Button>
          )
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{stat.label}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg">Assets Inventory</CardTitle>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No assets found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery ? "Try a different search term" : "Click 'Add Asset' to create your first asset"}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAssets.map((asset) => {
                    const category = parseCategory(asset.description);
                    const totalQty = asset.total_quantity ?? 0;
                    const availableQty = asset.available_quantity ?? 0;
                    const assignedQty = totalQty - availableQty;

                    return (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-muted-foreground" />
                            {asset.name}
                          </div>
                        </TableCell>
                        <TableCell>{asset.brand || "—"}</TableCell>
                        <TableCell>{category || "—"}</TableCell>
                        <TableCell>
                          {asset.serial_number ? (
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{asset.serial_number}</code>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{totalQty}</TableCell>
                        <TableCell>
                          <span className={availableQty > 0 ? "text-success font-medium" : "text-destructive"}>
                            {availableQty}
                          </span>
                          {assignedQty > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({assignedQty} assigned)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {permissions.update && (
                                <DropdownMenuItem onClick={() => openEditModal(asset)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => setRequestForAsset(asset)}>
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                Request
                              </DropdownMenuItem>
                              {permissions.update && permissions.delete && <DropdownMenuSeparator />}
                              {permissions.delete && (
                                <DropdownMenuItem
                                  onClick={() => handleDelete(asset.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {assets.length > pageSize && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border text-xs text-muted-foreground">
            <span>
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, assets.length)} of {assets.length}
            </span>
            <div className="flex items-center gap-2">
              <span>Page {safePage} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={safePage >= totalPages}
                className="p-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Asset Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">{editing ? "Edit Asset" : "Add New Asset"}</h2>
            </div>
            <div className="p-6">
              <AssetForm
                initialData={getInitialFormData(editing)}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                isLoading={createAsset.isPending || updateAsset.isPending}
              />
            </div>
          </div>
        </div>
      )}

      {/* Asset Request Form Modal */}
      {requestForAsset && (
        <AssetRequestFormModal
          isOpen={!!requestForAsset}
          onClose={() => setRequestForAsset(null)}
          asset={{
            id: requestForAsset.id,
            name: requestForAsset.name,
            brand: requestForAsset.brand,
            serial_number: requestForAsset.serial_number,
          }}
        />
      )}
    </div>
  );
}
