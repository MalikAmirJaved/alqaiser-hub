// components/hr/AssetsList.tsx
"use client";
import { useState, useEffect } from "react";
import { ls, uid } from "@/services/localStorageService";
import { companyContext } from "@/services/companyContextService";
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

export default function AssetsList() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  
  const [form, setForm] = useState({ 
    name: "", 
    brand: "", 
    model: "", 
    serial_number: "",
    description: "",
    purchase_date: "",
    purchase_price: "",
    warranty_until: "",
    vendor: ""
  });

  useEffect(() => {
    companyContext.init();
    loadData();
  }, []);

  const loadData = () => {
    setAssets(companyContext.filterByContext(ls.get<any[]>("hrAssets", [])));
    setLoading(false);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Asset name is required");
      return;
    }

    const newAsset = companyContext.addContextToRecord({ 
      id: editing?.id || uid("hrt_a"), 
      ...form,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const updated = editing 
      ? assets.map(a => a.id === editing.id ? newAsset : a) 
      : [newAsset, ...assets];
    
    setAssets(updated);
    ls.set("hrAssets", updated);
    setShowModal(false);
    setEditing(null);
    setForm({ 
      name: "", brand: "", model: "", serial_number: "",
      description: "", purchase_date: "", purchase_price: "", 
      warranty_until: "", vendor: "" 
    });
    toast.success(editing ? "Asset updated" : "Asset created");
  };

  const handleDelete = (id: string) => {
    const categories = companyContext.filterByContext(ls.get<any[]>("hrAssetCategories", []));
    const usedInCategories = categories.filter(c => {
      const assetIds = JSON.parse(c.asset_ids || "[]");
      return assetIds.includes(id);
    });
    
    if (usedInCategories.length > 0) {
      toast.error(`Cannot delete: Asset is used in ${usedInCategories.length} kit(s)`);
      return;
    }
    
    const assignments = companyContext.filterByContext(ls.get<any[]>("employeeAssetAssignments", []));
    const isAssigned = assignments.some(a => a.asset_id === id && a.status === "ACTIVE");
    if (isAssigned) {
      toast.error("Cannot delete: Asset is currently assigned to an employee");
      return;
    }
    
    const updated = assets.filter(a => a.id !== id);
    setAssets(updated);
    ls.set("hrAssets", updated);
    toast.success("Asset deleted");
  };

  const filteredAssets = assets.filter(a => 
    a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.serial_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
   <PageHeader 
  title="Asset Library" 
  subtitle="Manage your hardware inventory - laptops, monitors, peripherals, and more"
  actions={
    <Button onClick={() => { 
      setEditing(null); 
      setForm({ 
        name: "", brand: "", model: "", serial_number: "",
        description: "", purchase_date: "", purchase_price: "", 
        warranty_until: "", vendor: "" 
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
                <p className="text-2xl font-bold">{assets.length}</p>
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
                <p className="text-2xl font-bold">{assets.filter(a => a.serial_number).length}</p>
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
                  ${assets.reduce((sum, a) => sum + (parseFloat(a.purchase_price) || 0), 0).toLocaleString()}
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
                <p className="text-2xl font-bold">{new Set(assets.map(a => a.vendor).filter(Boolean)).size}</p>
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
          {filteredAssets.length === 0 ? (
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
                  {filteredAssets.map(asset => (
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
                        {asset.serial_number ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{asset.serial_number}</code>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          {asset.purchase_date && <div>📅 {asset.purchase_date}</div>}
                          {asset.purchase_price && <div>💰 ${asset.purchase_price}</div>}
                          {asset.vendor && <div>🏢 {asset.vendor}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {asset.warranty_until ? (
                          <Badge variant={new Date(asset.warranty_until) > new Date() ? "default" : "destructive"} className="text-xs">
                            {new Date(asset.warranty_until) > new Date() ? "Active" : "Expired"}
                            <br />
                            <span className="text-[10px]">{asset.warranty_until}</span>
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
                            <DropdownMenuItem onClick={() => { setEditing(asset); setForm(asset); setShowModal(true); }}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(asset.id)} className="text-destructive">
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
                value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                placeholder="Unique serial number for tracking"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Purchase Date</Label>
                <DatePicker
                  value={form.purchase_date}
                  onChange={(val) => setForm({ ...form, purchase_date: val || "" })}
                  placeholder="Select date"
                />
              </div>
              <div className="grid gap-2">
                <Label>Purchase Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.purchase_price}
                  onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Warranty Until</Label>
                <DatePicker
                  value={form.warranty_until}
                  onChange={(val) => setForm({ ...form, warranty_until: val || "" })}
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
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              {editing ? "Update" : "Save"} Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}