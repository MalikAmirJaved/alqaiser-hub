// components/HRAssets/EmployeeAssetsNew.tsx
"use client";
import { useState, useMemo, useEffect } from "react";
import { useActiveEmployees } from "@/hooks/useEmployees";
import {
  useEmployeeAssignments,
  useAvailableAssets,
  useAssignAssets,
  useReturnAssets,
  type EmployeeAssignmentsData,
  type AvailableAssetsData,
  type EmployeeAssetAssignment,
  type AvailableKit,
  type AvailableAsset,
} from "@/hooks/useEmployeeAssets";
import PageHeader from "@/components/PageHeader";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/reuseable/Checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Package,
  Search,
  User,
  Layers,
  CheckCircle,
  Truck,
  Plus,
  X,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

interface Employee {
  id: string;
  first_name: string;
  last_name?: string;
  employee_id: string;
  department_name?: string;
  designation_name?: string;
}

export default function EmployeeAssetsNew() {
  const permissions = useFeaturePermissions("HR", "asset_assignment");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  // Selection state: direct asset selections (any asset, including those that belong to kits) and selected kits
  const [selectedAssetQuantities, setSelectedAssetQuantities] = useState<Record<string, number>>({});
  const [selectedKitIds, setSelectedKitIds] = useState<Set<string>>(new Set());
  const [expandedKits, setExpandedKits] = useState<Set<string>>(new Set());
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [assignmentCondition, setAssignmentCondition] = useState("GOOD");
  const [selectedReturnIds, setSelectedReturnIds] = useState<Set<string>>(new Set());

  // Category filter for assets
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<string>("all");

  const { data: employees = [], isLoading: employeesLoading } = useActiveEmployees()

  const { data: assignmentData, isLoading: assignmentsLoading } = useEmployeeAssignments(
    selectedEmployee?.id
  );

  const { data: availableData } = useAvailableAssets(
    showAssignModal ? selectedEmployee?.id : undefined
  );

  const assignMutation = useAssignAssets();
  const returnMutation = useReturnAssets();

  // Helper: map asset ID to its kit (if any)
  const getKitForAsset = useMemo(() => {
    const map = new Map<string, AvailableKit>();
    availableData?.kits?.forEach(kit => {
      kit.assets.forEach(asset => map.set(asset.id, kit));
    });
    return (assetId: string) => map.get(assetId);
  }, [availableData]);

  // All assets (including those in kits)
  const allAssets = availableData?.assets || [];

  // Unique categories from all assets
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    allAssets.forEach(asset => {
      if (asset.category) cats.add(asset.category);
    });
    return Array.from(cats).sort();
  }, [allAssets]);

  // Filtered assets by category
  const filteredAssets = useMemo(() => {
    if (assetCategoryFilter === "all") return allAssets;
    return allAssets.filter(asset => asset.category === assetCategoryFilter);
  }, [allAssets, assetCategoryFilter]);

  // Reset all selection when modal opens
  useEffect(() => {
    if (showAssignModal) {
      setSelectedKitIds(new Set());
      setSelectedAssetQuantities({});
      setExpandedKits(new Set());
      setAssignmentNotes("");
      setAssignmentCondition("GOOD");
      setAssetCategoryFilter("all");
    }
  }, [showAssignModal]);

  // Toggle kit selection – when selected, remove its assets from direct selections to avoid duplication
  const handleKitToggle = (kitId: string, kit: AvailableKit) => {
    const newKitIds = new Set(selectedKitIds);
    if (newKitIds.has(kitId)) {
      // Deselect kit – nothing else needed; assets may remain selected individually (they were removed when kit was selected)
      newKitIds.delete(kitId);
    } else {
      // Check kit stock
      const totalAvailable = kit.assets.reduce((sum, a) => sum + (a.available_quantity || 0), 0);
      if (totalAvailable <= 0) {
        toast.error(`"${kit.name}" has no stock available`);
        return;
      }
      // Select kit – remove its assets from direct selections (to prevent double assignment)
      const newQuantities = { ...selectedAssetQuantities };
      kit.assets.forEach(asset => {
        delete newQuantities[asset.id];
      });
      setSelectedAssetQuantities(newQuantities);
      newKitIds.add(kitId);
    }
    setSelectedKitIds(newKitIds);
  };

  // Toggle individual asset selection – disallowed if asset belongs to a selected kit
  const handleAssetToggle = (asset: AvailableAsset) => {
    const alreadyAssigned = asset.already_assigned_to_employee;
    const availableQty = asset.available_quantity || 0;
    if (alreadyAssigned || availableQty <= 0) return;

    const kit = getKitForAsset(asset.id);
    if (kit && selectedKitIds.has(kit.id)) {
      toast.warning(`This asset belongs to the kit "${kit.name}". Unselect the kit first to assign individually.`);
      return;
    }

    const currentQty = selectedAssetQuantities[asset.id] || 0;
    if (currentQty > 0) {
      const newQuantities = { ...selectedAssetQuantities };
      delete newQuantities[asset.id];
      setSelectedAssetQuantities(newQuantities);
    } else {
      setSelectedAssetQuantities(prev => ({ ...prev, [asset.id]: 1 }));
    }
  };

  // Change quantity for an asset
  const updateAssetQuantity = (assetId: string, quantity: number) => {
    if (quantity <= 0) {
      const newQuantities = { ...selectedAssetQuantities };
      delete newQuantities[assetId];
      setSelectedAssetQuantities(newQuantities);
    } else {
      setSelectedAssetQuantities(prev => ({ ...prev, [assetId]: quantity }));
    }
  };

  // Build final payload: direct assets (asset_id + quantity) and kit_ids
  const assetsPayload = useMemo(() => {
    return Object.entries(selectedAssetQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([assetId, qty]) => ({ asset_id: assetId, quantity: qty }));
  }, [selectedAssetQuantities]);

  const totalUnits = assetsPayload.reduce((sum, a) => sum + a.quantity, 0);

  const handleAssign = async () => {
    if (!selectedEmployee) return;
    if (assetsPayload.length === 0 && selectedKitIds.size === 0) {
      toast.error("Please select at least one asset or kit");
      return;
    }
    try {
      await assignMutation.mutateAsync({
        employee_id: selectedEmployee.id,
        assets: assetsPayload,
        kit_ids: Array.from(selectedKitIds),
        condition: assignmentCondition,
        notes: assignmentNotes,
      });
      setShowAssignModal(false);
    } catch (error: any) {
    }
  };

  const handleBulkReturn = async () => {
    if (selectedReturnIds.size === 0) return;
    try {
      await returnMutation.mutateAsync({
        assignment_ids: Array.from(selectedReturnIds),
        condition_on_return: "GOOD",
      });
      setSelectedReturnIds(new Set());
    } catch (error: any) {
    }
  };

  const toggleKitExpand = (kitId: string) => {
    const newExpanded = new Set(expandedKits);
    if (newExpanded.has(kitId)) newExpanded.delete(kitId);
    else newExpanded.add(kitId);
    setExpandedKits(newExpanded);
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4">
      {/* Left Panel - Employee List */}
      <div
        className={cn(
          "flex flex-col bg-card rounded-xl border border-border overflow-hidden transition-all",
          showDetailPanel ? "w-1/3 min-w-[300px]" : "w-full"
        )}
      >
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {employeesLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {employees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => {
                    setSelectedEmployee(emp);
                    setShowDetailPanel(true);
                  }}
                  className={cn(
                    "w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center justify-between",
                    selectedEmployee?.id === emp.id && "bg-primary/5 border-l-2 border-primary"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {emp.first_name} {emp.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {emp.department_name} • {emp.designation_name || "N/A"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Employee Details & Assignments (unchanged) */}
      {showDetailPanel && selectedEmployee && (
        <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg">
                {selectedEmployee.first_name} {selectedEmployee.last_name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedEmployee.employee_id} • {selectedEmployee.department_name}
              </p>
            </div>
            <div className="flex gap-2">
              {permissions.assign && (
                <Button onClick={() => setShowAssignModal(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Assign Assets
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={() => setShowDetailPanel(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Active Assignments */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Active Assignments</CardTitle>
                  {selectedReturnIds.size > 0 && permissions.update && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkReturn}
                      disabled={returnMutation.isPending}
                    >
                      <Truck className="w-4 h-4 mr-2" />
                      Return {selectedReturnIds.size} Asset(s)
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {assignmentsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : !assignmentData?.active_assignments?.length ? (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No assets assigned</p>
                    {permissions.assign && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setShowAssignModal(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Assign Now
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedReturnIds.size === assignmentData.active_assignments.length}
                            onChange={(checked) => {
                              if (checked) {
                                setSelectedReturnIds(new Set(assignmentData.active_assignments.map((a) => a.id)));
                              } else {
                                setSelectedReturnIds(new Set());
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Asset</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead>Condition</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignmentData.active_assignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedReturnIds.has(assignment.id)}
                              onChange={(checked) => {
                                const newSet = new Set(selectedReturnIds);
                                checked ? newSet.add(assignment.id) : newSet.delete(assignment.id);
                                setSelectedReturnIds(newSet);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{assignment.asset.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {assignment.asset.brand} {assignment.asset.model}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{assignment.quantity}</TableCell>
                          <TableCell>
                            {assignment.source_type === "KIT" ? (
                              <Badge variant="outline" className="gap-1">
                                <Layers className="w-3 h-3" />
                                {assignment.source_kit?.name || "Kit"}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Direct</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{assignment.assigned_date}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                assignment.condition === "NEW" && "bg-emerald-500/10 text-emerald-600",
                                assignment.condition === "GOOD" && "bg-blue-500/10 text-blue-600"
                              )}
                            >
                              {assignment.condition}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Assigned Kits Summary */}
            {assignmentData?.kits && assignmentData.kits.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assigned Kits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {assignmentData.kits.map((kit) => (
                      <div key={kit.id} className="p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Layers className="w-4 h-4 text-primary" />
                          <span className="font-medium text-sm">{kit.name}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {kit.assets.map((asset) => (
                            <Badge key={asset.id} variant="outline" className="text-xs">
                              {asset.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Assignment History */}
            {assignmentData?.history && assignmentData.history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assignment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {assignmentData.history.slice(0, 10).map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium">{h.asset_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Assigned: {h.assigned_date} • Returned: {h.returned_date || "N/A"}
                          </p>
                        </div>
                        <Badge variant={h.status === "RETURNED" ? "secondary" : "destructive"}>
                          {h.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      <Dialog open={showAssignModal && permissions.assign} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Assign Assets to {selectedEmployee?.first_name} {selectedEmployee?.last_name}
            </DialogTitle>
            <DialogDescription>
              Select whole kits (expand to view contents) or individual assets. Assets belonging to a selected kit are disabled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Kits Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Equipment Kits
                <Badge variant="secondary" className="text-xs">
                  {selectedKitIds.size} kit{selectedKitIds.size !== 1 ? "s" : ""} selected
                </Badge>
              </h3>
              {(!availableData?.kits || availableData.kits.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No kits available</p>
              )}
              <div className="grid grid-cols-1 gap-3">
                {availableData?.kits?.map((kit) => (
                  <div key={kit.id} className="border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleKitExpand(kit.id)}
                          className="p-1 hover:bg-muted rounded"
                        >
                          {expandedKits.has(kit.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <Checkbox
                          checked={selectedKitIds.has(kit.id)}
                          onChange={() => handleKitToggle(kit.id, kit)}
                        />
                        <div>
                          <p className="font-medium text-sm">{kit.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {kit.asset_count} asset{kit.asset_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                    {expandedKits.has(kit.id) && (
                      <div className="divide-y divide-border bg-card">
                        {kit.assets.map((asset) => (
                          <div key={asset.id} className="p-3 pl-8 text-sm text-muted-foreground">
                            • {asset.name} {asset.brand ? `(${asset.brand})` : ""}
                            {asset.available_quantity !== undefined && (
                              <span className="ml-2 text-xs">({asset.available_quantity} avail)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Individual Assets Section – includes all assets (kit assets too, but disabled if kit selected) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  Individual Assets
                  <Badge variant="secondary" className="text-xs">
                    {Object.keys(selectedAssetQuantities).length} selected
                  </Badge>
                </h3>
                {availableCategories.length > 0 && (
                  <SearchableSelect
                    value={assetCategoryFilter}
                    onChange={(val) => setAssetCategoryFilter(val)}
                    options={[
                      { value: "all", label: "All Categories" },
                      ...availableCategories.map(cat => ({ value: cat, label: cat }))
                    ]}
                  />
                )}
              </div>

              <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {filteredAssets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No assets found.
                  </div>
                ) : (
                  filteredAssets.map((asset) => {
                    const qty = selectedAssetQuantities[asset.id] || 0;
                    const maxQty = asset.available_quantity || 0;
                    const alreadyAssigned = asset.already_assigned_to_employee;
                    const kit = getKitForAsset(asset.id);
                    const isKitSelected = kit ? selectedKitIds.has(kit.id) : false;
                    const isSelectable = !alreadyAssigned && maxQty > 0 && !isKitSelected;

                    return (
                      <div
                        key={asset.id}
                        className={cn(
                          "px-3 py-2.5 flex items-center gap-3",
                          (!isSelectable || isKitSelected) && "opacity-50"
                        )}
                      >
                        <Checkbox
                          checked={qty > 0}
                          onChange={() => handleAssetToggle(asset)}
                          disabled={!isSelectable}
                        />
                        <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {asset.brand} {asset.model}
                          </p>
                          {asset.category && (
                            <p className="text-xs text-muted-foreground/70">Category: {asset.category}</p>
                          )}
                        </div>
                        {isSelectable && qty > 0 && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max={maxQty}
                              value={qty}
                              onChange={(e) => updateAssetQuantity(asset.id, parseInt(e.target.value) || 0)}
                              className="w-16 text-center text-sm border border-border rounded-md bg-background px-2 py-1"
                            />
                            <span className="text-xs text-muted-foreground">/ {maxQty}</span>
                          </div>
                        )}
                        {asset.serial_number && (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                            {asset.serial_number}
                          </code>
                        )}
                        {isKitSelected && (
                          <span className="text-xs text-primary whitespace-nowrap">In kit</span>
                        )}
                        {!isSelectable && !isKitSelected && (
                          <span className="text-xs text-destructive whitespace-nowrap">
                            {alreadyAssigned ? "Already assigned" : "Out of stock"}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Assignment Details (unchanged) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Condition</label>
                <SearchableSelect
                  value={assignmentCondition}
                  onChange={(val) => setAssignmentCondition(val)}
                  options={[
                    { value: "NEW", label: "New" },
                    { value: "GOOD", label: "Good" },
                    { value: "FAIR", label: "Fair" },
                    { value: "POOR", label: "Poor" },
                  ]}
                  placeholder="Select condition"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notes</label>
                <Input
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="Assignment notes..."
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={assignMutation.isPending || (assetsPayload.length === 0 && selectedKitIds.size === 0)}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {assignMutation.isPending
                ? "Assigning..."
                : `Assign ${totalUnits + selectedKitIds.size} Unit${totalUnits + selectedKitIds.size !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}