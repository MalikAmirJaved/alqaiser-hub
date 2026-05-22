// components/hr/AssetsList.tsx
"use client";
import { useState, useEffect } from "react";
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
  DollarSign,
  Building2,
  Hash,
  Calendar as CalendarIcon,
  X
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
import { DatePicker } from "@/components/reuseable/DatePicker";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";

export default function AssetsList() {
const { formatCurrency } = useCompanySettings();
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
  
  const [form, setForm] = useState({ 
    name: "", 
    brand: "", 
    model: "", 
    serialNumber: "",
    description: "",
    purchaseDate: "",
    purchasePrice: "",
    warrantyUntil: "",
    vendor: ""
  });

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Asset name is required");
      return;
    }

    try {
      if (editing) {
        await updateAsset.mutateAsync({
          id: editing.id,
          name: form.name,
          brand: form.brand || undefined,
          model: form.model || undefined,
          serialNumber: form.serialNumber || undefined,
          description: form.description || undefined,
          purchaseDate: form.purchaseDate || undefined,
          purchasePrice: form.purchasePrice || undefined,
          warrantyUntil: form.warrantyUntil || undefined,
          vendor: form.vendor || undefined,
        });
      } else {
        await createAsset.mutateAsync({
          name: form.name,
          brand: form.brand || undefined,
          model: form.model || undefined,
          serialNumber: form.serialNumber || undefined,
          description: form.description || undefined,
          purchaseDate: form.purchaseDate || undefined,
          purchasePrice: form.purchasePrice || undefined,
          warrantyUntil: form.warrantyUntil || undefined,
          vendor: form.vendor || undefined,
          isActive: true,
        });
      }
      
      setShowModal(false);
      setEditing(null);
      setForm({ 
        name: "", brand: "", model: "", serialNumber: "",
        description: "", purchaseDate: "", purchasePrice: "", 
        warrantyUntil: "", vendor: "" 
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to save asset");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAsset.mutateAsync(id);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete asset");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 ">
      <PageHeader 
        title="Asset Library" 
        subtitle="Manage your hardware inventory - laptops, monitors, peripherals, and more"
        actions={
          <Button onClick={() => { 
            setEditing(null); 
            setForm({ 
              name: "", brand: "", model: "", serialNumber: "",
              description: "", purchaseDate: "", purchasePrice: "", 
              warrantyUntil: "", vendor: "" 
            }); 
            setShowModal(true); 
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Asset
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold">{stats?.totalAssets || assets.length}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Package className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">With Serial Numbers</p>
                <p className="text-2xl font-bold">{stats?.withSerialNumbers || assets.filter(a => a.serialNumber).length}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Hash className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats?.totalValue ?? 0) }
                </p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <DollarSign className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Vendors</p>
                <p className="text-2xl font-bold">{stats?.uniqueVendors || new Set(assets.map(a => a.vendor).filter(Boolean)).size}</p>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Building2 className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg">Asset Inventory</CardTitle>
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
                    <TableHead>Brand / Model</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Purchase Info</TableHead>
                    <TableHead>Warranty</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map(asset => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          {asset.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {asset.brand || "-"} {asset.model ? `/ ${asset.model}` : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        {asset.serialNumber ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{asset.serialNumber}</code>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          {asset.purchaseDate && <div>📅 {asset.purchaseDate}</div>}
                          {asset.purchasePrice && <div>💰 ${parseFloat(asset.purchasePrice)}</div>}
                          {asset.vendor && <div>🏢 {asset.vendor}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {asset.warrantyUntil ? (
                          <Badge variant={asset.warrantyStatus === true ? "default" : "destructive"} className="text-xs">
                            {asset.warrantyStatus === true ? "Active" : "Expired"}
                            <br />
                            <span className="text-[10px]">{asset.warrantyUntil}</span>
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
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
                            <DropdownMenuItem onClick={() => { 
                              setEditing(asset); 
                              setForm({
                                name: asset.name || "",
                                brand: asset.brand || "",
                                model: asset.model || "",
                                serialNumber: asset.serialNumber || "",
                                description: asset.description || "",
                                purchaseDate: asset.purchaseDate || "",
                                purchasePrice: asset.purchasePrice || "",
                                warrantyUntil: asset.warrantyUntil || "",
                                vendor: asset.vendor || "",
                              }); 
                              setShowModal(true); 
                            }}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(asset.id)} 
                              className="text-destructive"
                              disabled={asset.isAssigned}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Asset Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Asset" : "Add New Asset"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update asset details below" : "Enter the asset information below"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Asset Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Dell XPS 15, Logitech MX Master"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Brand</Label>
                <Input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="e.g., Dell, Apple, Logitech"
                />
              </div>
              <div className="grid gap-2">
                <Label>Model</Label>
                <Input
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="e.g., XPS 15, MacBook Pro"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Serial Number</Label>
              <Input
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                placeholder="Unique serial number for tracking"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Purchase Date</Label>
                <DatePicker
                  value={form.purchaseDate}
                  onChange={(val) => setForm({ ...form, purchaseDate: val || "" })}
                  placeholder="Select date"
                />
              </div>
              <div className="grid gap-2">
                <Label>Purchase Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Warranty Until</Label>
                <DatePicker
                  value={form.warrantyUntil}
                  onChange={(val) => setForm({ ...form, warrantyUntil: val || "" })}
                  placeholder="Warranty expiry date"
                />
              </div>
              <div className="grid gap-2">
                <Label>Vendor</Label>
                <Input
                  value={form.vendor}
                  onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                  placeholder="Supplier name"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Additional notes about this asset"
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