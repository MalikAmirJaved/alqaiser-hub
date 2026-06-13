// components/HRAssets/EmployeeAssetsNew.tsx
"use client";
import { useState, useMemo } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import { 
  useEmployeeAssignments, 
  useAvailableAssets, 
  useAssignAssets, 
  useReturnAssets,
  type EmployeeAssignmentsData,
  type AvailableAssetsData,
  type EmployeeAssetAssignment,
  type AvailableKit,
  type AvailableAsset
} from "@/hooks/useEmployeeAssets";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/reuseable/Checkbox";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Package, Search, User, Layers, CheckCircle,
  Truck, Plus, X, ChevronRight, PackageOpen,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Define Employee type (adjust according to your actual employee data)
interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  employee_id: string;
  department: string;
  designation?: string;
}

export default function EmployeeAssetsNew() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  
  const [selectedKitIds, setSelectedKitIds] = useState<Set<number>>(new Set());
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set());
  const [deselectedKitAssets, setDeselectedKitAssets] = useState<Set<number>>(new Set());
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [assignmentCondition, setAssignmentCondition] = useState("GOOD");
  const [selectedReturnIds, setSelectedReturnIds] = useState<Set<number>>(new Set());

  // Explicitly type the hook returns
  const { data: employees = [], isLoading: employeesLoading } = useEmployees(
    searchQuery ? { search: searchQuery } : undefined
  ) as { data: Employee[]; isLoading: boolean };
  
  const { data: assignmentData, isLoading: assignmentsLoading } = useEmployeeAssignments(
    selectedEmployee?.id
  );
  
  const { data: availableData } = useAvailableAssets(
    showAssignModal ? selectedEmployee?.id : undefined
  );
  
  const assignMutation = useAssignAssets();
  const returnMutation = useReturnAssets();

  const handleKitToggle = (kitId: number, kit: AvailableKit) => {
    const newKitIds = new Set(selectedKitIds);
    const newDeselected = new Set(deselectedKitAssets);
    
    if (newKitIds.has(kitId)) {
      newKitIds.delete(kitId);
      kit.assets.forEach((asset) => {
        if (!selectedAssetIds.has(asset.id)) {
          newDeselected.delete(asset.id);
        }
      });
    } else {
      newKitIds.add(kitId);
      kit.assets.forEach((asset) => {
        if (!asset.already_assigned_to_employee && !asset.is_assigned) {
          newDeselected.delete(asset.id);
        }
      });
    }
    
    setSelectedKitIds(newKitIds);
    setDeselectedKitAssets(newDeselected);
  };

  const finalAssetIds = useMemo(() => {
    const assetIds = new Set<number>(selectedAssetIds);
    
    selectedKitIds.forEach(kitId => {
      const kit = availableData?.kits?.find((k) => k.id === kitId);
      if (kit) {
        kit.assets.forEach((asset) => {
          if (!asset.already_assigned_to_employee && !asset.is_assigned) {
            if (!deselectedKitAssets.has(asset.id)) {
              assetIds.add(asset.id);
            }
          }
        });
      }
    });
    
    return Array.from(assetIds);
  }, [selectedKitIds, selectedAssetIds, deselectedKitAssets, availableData]);

  const handleAssign = async () => {
    if (!selectedEmployee) return;
    
    if (finalAssetIds.length === 0 && selectedKitIds.size === 0) {
      toast.error("Please select at least one asset or kit");
      return;
    }
    
    try {
      await assignMutation.mutateAsync({
        employee_id: selectedEmployee.id,
        asset_ids: finalAssetIds,
        kit_ids: Array.from(selectedKitIds),
        condition: assignmentCondition,
        notes: assignmentNotes,
      });
      
      toast.success("Assets assigned successfully");
      setShowAssignModal(false);
      resetSelection();
    } catch (error: any) {
      toast.error(error.message || "Failed to assign assets");
    }
  };

  const handleBulkReturn = async () => {
    if (selectedReturnIds.size === 0) return;
    
    try {
      await returnMutation.mutateAsync({
        assignment_ids: Array.from(selectedReturnIds),
        condition_on_return: "GOOD",
      });
      
      toast.success(`${selectedReturnIds.size} asset(s) returned`);
      setSelectedReturnIds(new Set());
    } catch (error: any) {
      toast.error(error.message || "Failed to return assets");
    }
  };

  const resetSelection = () => {
    setSelectedKitIds(new Set());
    setSelectedAssetIds(new Set());
    setDeselectedKitAssets(new Set());
    setAssignmentNotes("");
    setAssignmentCondition("GOOD");
  };

  // Helper to check if an asset is already assigned (for modal list)
  const isAssetAlreadyAssigned = (asset: AvailableAsset) => {
    return asset.is_assigned === true;
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4 p-4 md:p-6">
      {/* Left Panel - Employee List (unchanged but typed) */}
      <div className={cn(
        "flex flex-col bg-card rounded-xl border border-border overflow-hidden transition-all",
        showDetailPanel ? "w-1/3 min-w-[300px]" : "w-full"
      )}>
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
              {employees.map(emp => (
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
                      <p className="font-medium text-sm">{emp.first_name} {emp.last_name}</p>
                      <p className="text-xs text-muted-foreground">{emp.department} • {emp.designation || 'N/A'}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Employee Details & Assignments */}
      {showDetailPanel && selectedEmployee && (
        <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden flex flex-col">
          {/* Header (unchanged) */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg">
                {selectedEmployee.first_name} {selectedEmployee.last_name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedEmployee.employee_id} • {selectedEmployee.department}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowAssignModal(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Assign Assets
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowDetailPanel(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Active Assignments Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Active Assignments</CardTitle>
                  {selectedReturnIds.size > 0 && (
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setShowAssignModal(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Assign Now
                    </Button>
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
                                setSelectedReturnIds(
                                  new Set(assignmentData.active_assignments.map((a) => a.id))
                                );
                              } else {
                                setSelectedReturnIds(new Set());
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Asset</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead>Condition</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignmentData.active_assignments.map((assignment: EmployeeAssetAssignment) => (
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
                          <TableCell>
                            {assignment.source_type === 'KIT' ? (
                              <Badge variant="outline" className="gap-1">
                                <Layers className="w-3 h-3" />
                                {assignment.source_kit?.name || 'Kit'}
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
                                assignment.condition === 'NEW' && "bg-emerald-500/10 text-emerald-600",
                                assignment.condition === 'GOOD' && "bg-blue-500/10 text-blue-600",
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
                      <div key={h.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium">{h.asset_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Assigned: {h.assigned_date} • Returned: {h.returned_date || 'N/A'}
                          </p>
                        </div>
                        <Badge variant={h.status === 'RETURNED' ? 'secondary' : 'destructive'}>
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
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Assets to {selectedEmployee?.first_name} {selectedEmployee?.last_name}</DialogTitle>
            <DialogDescription>
              Select kits and/or individual assets to assign
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Kits Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Equipment Kits
                <Badge variant="secondary" className="text-xs">
                  {selectedKitIds.size} selected
                </Badge>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {availableData?.kits?.map((kit: AvailableKit) => (
                  <button
                    key={kit.id}
                    onClick={() => handleKitToggle(kit.id, kit)}
                    className={cn(
                      "p-4 rounded-lg border text-left transition-all",
                      selectedKitIds.has(kit.id)
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{kit.name}</span>
                      <Checkbox
                        checked={selectedKitIds.has(kit.id)}
                        onChange={() => handleKitToggle(kit.id, kit)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {kit.asset_count} asset{kit.asset_count !== 1 ? 's' : ''}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {kit.assets.map((asset) => (
                        <Badge
                          key={asset.id}
                          variant="outline"
                          className={cn(
                            "text-xs",
                            asset.already_assigned_to_employee && "opacity-50 line-through",
                            selectedKitIds.has(kit.id) && deselectedKitAssets.has(asset.id) && "opacity-30"
                          )}
                        >
                          {asset.name}
                          {asset.already_assigned_to_employee && " ✓"}
                        </Badge>
                      ))}
                    </div>
                    {selectedKitIds.has(kit.id) && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Click to deselect:</p>
                        <div className="flex flex-wrap gap-1">
                          {kit.assets
                            .filter((a) => !a.already_assigned_to_employee)
                            .map((asset) => (
                              <button
                                key={asset.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newSet = new Set(deselectedKitAssets);
                                  newSet.has(asset.id) ? newSet.delete(asset.id) : newSet.add(asset.id);
                                  setDeselectedKitAssets(newSet);
                                }}
                                className={cn(
                                  "text-xs px-1.5 py-0.5 rounded border transition-all",
                                  deselectedKitAssets.has(asset.id)
                                    ? "border-destructive text-destructive bg-destructive/10"
                                    : "border-border hover:border-primary"
                                )}
                              >
                                {asset.name} {deselectedKitAssets.has(asset.id) ? "✕" : ""}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Individual Assets Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Individual Assets
                <Badge variant="secondary" className="text-xs">
                  {selectedAssetIds.size + finalAssetIds.filter(id => !selectedAssetIds.has(id)).length} selected
                </Badge>
              </h3>
              <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {availableData?.assets?.map((asset: AvailableAsset) => {
                  const isSelected = selectedAssetIds.has(asset.id) || 
                    finalAssetIds.includes(asset.id);
                  const alreadyAssigned = isAssetAlreadyAssigned(asset);
                  
                  return (
                    <button
                      key={asset.id}
                      onClick={() => {
                        if (alreadyAssigned && !isSelected) return;
                        const newSet = new Set(selectedAssetIds);
                        isSelected ? newSet.delete(asset.id) : newSet.add(asset.id);
                        setSelectedAssetIds(newSet);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors",
                        isSelected && "bg-primary/5",
                        alreadyAssigned && !isSelected && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={() => {}}
                        disabled={alreadyAssigned && !isSelected}
                      />
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{asset.name}</p>
                        {asset.brand && (
                          <p className="text-xs text-muted-foreground">
                            {asset.brand} {asset.model}
                          </p>
                        )}
                      </div>
                      {asset.serial_number && (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {asset.serial_number}
                        </code>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assignment Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Condition</label>
                <select
                  value={assignmentCondition}
                  onChange={(e) => setAssignmentCondition(e.target.value)}
                  className="w-full mt-1 bg-muted/40 border border-border rounded-md h-9 px-2 text-sm"
                >
                  <option value="NEW">New</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                </select>
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
              disabled={assignMutation.isPending || (finalAssetIds.length === 0 && selectedKitIds.size === 0)}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {assignMutation.isPending 
                ? "Assigning..." 
                : `Assign ${finalAssetIds.length} Asset${finalAssetIds.length !== 1 ? 's' : ''}`
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}