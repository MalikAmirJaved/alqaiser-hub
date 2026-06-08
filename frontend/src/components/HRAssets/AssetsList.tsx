// components/HRAssets/AssetsList.tsx
"use client";
import { useState } from "react";
import { useAssets, useAssetStats, useCreateAsset, useUpdateAsset, useDeleteAsset } from "@/hooks/useAssets";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  Save,
  MoreVertical,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

// Helper to format date
const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString();
};

export default function AssetsList() {
  const permissions = useFeaturePermissions("HR", "emp_asset");
  const [searchQuery, setSearchQuery] = useState("");
  const { data: assets = [], isLoading } = useAssets(
    searchQuery ? { search: searchQuery } : undefined
  );
  const { data: stats } = useAssetStats();
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  // Simplified form state (no warranty field)
  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    sku: "",
    initialStock: 1,
    description: "",
  });

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Asset name is required");
      return;
    }

    // Store category in description (prepend with "Category: ...")
    const finalDescription = form.category
      ? `Category: ${form.category}\n${form.description || ""}`
      : form.description || "";

    try {
      if (editing) {
        await updateAsset.mutateAsync({
          id: editing.id,
          name: form.name,
          brand: form.brand || undefined,
          serial_number: form.sku || undefined,
          total_quantity: form.initialStock,
          available_quantity: form.initialStock,
          description: finalDescription,
          is_active: true,
        });
      } else {
        await createAsset.mutateAsync({
          name: form.name,
          brand: form.brand || undefined,
          serial_number: form.sku || undefined,
          total_quantity: form.initialStock,
          available_quantity: form.initialStock,
          description: finalDescription,
          is_active: true,
          purchase_date: new Date().toISOString().split("T")[0],
          purchase_price: 0,
        });
      }

      setShowModal(false);
      setEditing(null);
      setForm({
        name: "",
        brand: "",
        category: "",
        sku: "",
        initialStock: 1,
        description: "",
      });
      toast.success(editing ? "Asset updated" : "Asset created");
    } catch (error: any) {
      toast.error(error.message || "Failed to save asset");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAsset.mutateAsync(id);
      toast.success("Asset deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete asset");
    }
  };

  const openEditModal = (asset: any) => {
    // Parse category from description if stored as "Category: ..."
    let category = "";
    let description = asset.description || "";
    if (description.startsWith("Category: ")) {
      const lines = description.split("\n");
      category = lines[0].replace("Category: ", "");
      description = lines.slice(1).join("\n");
    }

    setEditing(asset);
    setForm({
      name: asset.name || "",
      brand: asset.brand || "",
      category: category,
      sku: asset.serial_number || "",
      initialStock: asset.total_quantity || 1,
      description: description,
    });
    setShowModal(true);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Library"
        subtitle="Manage hardware inventory – laptops, monitors, peripherals, and more"
        actions={
          permissions.create && (
            <Button
              onClick={() => {
                setEditing(null);
                setForm({
                  name: "",
                  brand: "",
                  category: "",
                  sku: "",
                  initialStock: 1,
                  description: "",
                });
                setShowModal(true);
              }}
            >
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
                  {assets.map((asset) => {
                    // Extract category from description if stored
                    let category = "";
                    let description = asset.description || "";
                    if (description.startsWith("Category: ")) {
                      const lines = description.split("\n");
                      category = lines[0].replace("Category: ", "");
                    }
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
                        <TableCell className="text-right">{totalQty}</TableCell>
                        <TableCell className="text-right">
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
      </Card>

      {/* Asset Form Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Asset" : "Add New Asset"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update asset details" : "Enter basic asset information"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Asset Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Dell XPS 15, Logitech MX Master"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="e.g., Dell, Logitech"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g., Laptop, Monitor, Peripherals"
              />
              <p className="text-xs text-muted-foreground">Used for grouping (e.g., Electronics, Furniture)</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sku">SKU / Serial Number</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="Unique identifier"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="initialStock">Initial Stock</Label>
              <Input
                id="initialStock"
                type="number"
                min="1"
                value={form.initialStock}
                onChange={(e) => setForm({ ...form, initialStock: parseInt(e.target.value) || 1 })}
                placeholder="Quantity"
              />
              <p className="text-xs text-muted-foreground">Number of identical units (e.g., 5 monitors)</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Additional notes, specifications, etc."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createAsset.isPending || updateAsset.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {createAsset.isPending || updateAsset.isPending ? "Saving..." : editing ? "Update" : "Save"} Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}