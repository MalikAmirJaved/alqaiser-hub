// components/hr/AssetCategories.tsx
"use client";
import { useState } from "react";
import { useAssets } from "@/hooks/useAssets";
import { 
  useAssetCategories, 
  useAssetCategoryStats, 
  useCreateAssetCategory, 
  useUpdateAssetCategory, 
  useDeleteAssetCategory 
} from "@/hooks/useAssetCategories";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import {
  Layers,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Save,
  MoreVertical,
  Package,
  Users,
  Check
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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { cn } from "@/lib/utils";

function AssetMultiSelect({ options, selected, onChange, assets }: any) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((i: string) => i !== id) : [...selected, id]);
  };

  const getAssetDetails = (id: string) => assets.find((a: any) => a.id === id);

  const selectAll = () => onChange(options.map((opt: any) => opt.value));
  const deselectAll = () => onChange([]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {selected.length} asset{selected.length !== 1 ? 's' : ''} selected
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={selectAll} className="h-6 text-xs">
            Select All
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={deselectAll} className="h-6 text-xs">
            Clear
          </Button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 min-h-[48px] p-2 bg-muted/30 rounded-lg border border-border">
        {selected.length === 0 && (
          <span className="text-xs text-muted-foreground">No assets selected</span>
        )}
        {selected.map((id: string) => {
          const asset = getAssetDetails(id);
          return (
            <Badge key={id} variant="secondary" className="gap-1 pl-2 pr-1">
              <Package className="w-3 h-3" />
              <span className="text-xs">{asset?.name || `Asset #${id}`}</span>
              <button onClick={() => toggle(id)} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          );
        })}
      </div>
      
      <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
        {options.map((opt: any) => {
          const asset = getAssetDetails(opt.value);
          const isSelected = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 hover:bg-muted/50",
                isSelected && "bg-primary/5"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                isSelected ? "bg-primary border-primary" : "border-muted-foreground"
              )}>
                {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1">{opt.label}</span>
              {asset?.brand && (
                <span className="text-xs text-muted-foreground">{asset.brand}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AssetCategories() {
  const permissions = useFeaturePermissions("HR", "asset_kit");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useRouter();
  
  const { data: assets = [] } = useAssets();
  const { data: categories = [], isLoading } = useAssetCategories(
    searchQuery ? { search: searchQuery } : undefined
  );
  const { data: stats } = useAssetCategoryStats();
  const createCategory = useCreateAssetCategory();
  const updateCategory = useUpdateAssetCategory();
  const deleteCategory = useDeleteAssetCategory();
  
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  
  const [form, setForm] = useState({ 
    name: "", 
    assetIds: [] as string[], 
    description: "" 
  });

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Kit name is required");
      return;
    }
    if (form.assetIds.length === 0) {
      toast.error("Please select at least one asset");
      return;
    }

    try {
      if (editing) {
        await updateCategory.mutateAsync({
          id: editing.id,
          name: form.name,
          description: form.description,
          assetIds: form.assetIds,
        });
      } else {
        await createCategory.mutateAsync({
          name: form.name,
          description: form.description,
          assetIds: form.assetIds,
        });
      }
      
      setShowModal(false);
      setEditing(null);
      setForm({ name: "", assetIds: [], description: "" });
    } catch (error: any) {
      toast.error(error.message || "Failed to save kit");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory.mutateAsync(id);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete kit");
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
    <div className="space-y-6">
      <PageHeader 
        title="Equipment Kits" 
        subtitle="Bundle multiple assets together for easy assignment to employees"
        actions={
          permissions.create && (
            <Button onClick={() => { 
              setEditing(null); 
              setForm({ name: "", assetIds: [], description: "" }); 
              setShowModal(true); 
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Create Kit
            </Button>
          )
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Kits</p>
                <p className="text-2xl font-bold">{stats?.totalCategories || categories.length}</p>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Layers className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Assets in Kits</p>
                <p className="text-2xl font-bold">
                  {stats?.totalAssetsInCategories || categories.reduce((sum, c) => sum + (c.assetCount || 0), 0)}
                </p>
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
                <p className="text-xs text-muted-foreground">Assets Available</p>
                <p className="text-2xl font-bold">{assets.length}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Package className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Kits Grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg">Asset Kits</CardTitle>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search kits by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No kits found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery ? "Try a different search term" : "Click 'Create Kit' to bundle assets together"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(cat => (
                <Card key={cat.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">{cat.name}</CardTitle>
                        {cat.description && (
                          <CardDescription className="mt-1 line-clamp-2">
                            {cat.description}
                          </CardDescription>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {permissions.update && (
                            <DropdownMenuItem onClick={() => { 
                              setEditing(cat); 
                              setForm({ 
                                name: cat.name, 
                                assetIds: cat.assetIds || [], 
                                description: cat.description || "" 
                              }); 
                              setShowModal(true); 
                            }}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {permissions.update && permissions.delete && (
                            <DropdownMenuSeparator />
                          )}
                          {permissions.delete && (
                            <DropdownMenuItem onClick={() => handleDelete(cat.id)} className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Assets in kit:</span>
                        <Badge variant="secondary">{cat.assetCount || cat.assets?.length || 0}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {cat.assets?.map(asset => (
                          <Badge key={asset.id} variant="outline" className="text-xs gap-1">
                            <Package className="w-3 h-3" />
                            {asset.name}
                          </Badge>
                        )) || (
                          <span className="text-xs text-muted-foreground">No assets loaded</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => {
                        navigate.push(`employee-assets?kit=${cat.id}`);
                      }}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Assign to Employee
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Modal */}
      <Dialog
        open={showModal && (editing ? permissions.update : permissions.create)}
        onOpenChange={setShowModal}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Kit" : "Create Equipment Kit"}</DialogTitle>
            <DialogDescription>
              Bundle multiple assets together for easy assignment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Kit Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Standard Workstation, Developer Kit"
              />
            </div>
            <div className="grid gap-2">
              <Label>Select Assets *</Label>
              <AssetMultiSelect
                options={assets.map(a => ({ value: a.id, label: `${a.name}${a.brand ? ` (${a.brand})` : ''}` }))}
                selected={form.assetIds}
                onChange={(v: string[]) => setForm({ ...form, assetIds: v })}
                assets={assets}
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the purpose of this kit"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button 
              onClick={handleSave} 
              disabled={createCategory.isPending || updateCategory.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              {createCategory.isPending || updateCategory.isPending ? "Saving..." : editing ? "Update" : "Create"} Kit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}