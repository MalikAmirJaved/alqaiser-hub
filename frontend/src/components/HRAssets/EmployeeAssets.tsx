// components/hr/EmployeeAssets.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import { ls, uid } from "@/services/localStorageService";
import { companyContext } from "@/services/companyContextService";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  Plus,
  Search,
  Truck,
  CheckCircle,
  X,
  Save,
  MoreVertical,
  User,
  Package,
  Layers,
  Filter,
  Users,
  Eye,
  Trash2,
  Edit,
  Calendar,
  AlertCircle,
  ChevronRight
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ASSET_CONDITIONS = [
  { value: "NEW", label: "New", color: "bg-emerald-500/10 text-emerald-600" },
  { value: "GOOD", label: "Good", color: "bg-blue-500/10 text-blue-600" },
  { value: "FAIR", label: "Fair", color: "bg-amber-500/10 text-amber-600" },
  { value: "POOR", label: "Poor", color: "bg-red-500/10 text-red-600" },
];

const ASSET_STATUSES = [
  { value: "ACTIVE", label: "Active", color: "bg-emerald-500/10 text-emerald-600" },
  { value: "RETURNED", label: "Returned", color: "bg-slate-500/10 text-slate-600" },
  { value: "LOST", label: "Lost", color: "bg-red-500/10 text-red-600" },
  { value: "DAMAGED", label: "Damaged", color: "bg-amber-500/10 text-amber-600" },
];

export default function EmployeeAssets() {
  const [assets, setAssets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  
  const [assignForm, setAssignForm] = useState({ 
    employee_id: "", 
    category_id: "", 
    condition: "NEW",
    notes: "" 
  });

  const [returnForm, setReturnForm] = useState({
    condition: "GOOD",
    return_notes: ""
  });

  useEffect(() => {
    companyContext.init();
    loadData();
    
    const urlParams = new URLSearchParams(window.location.search);
    const kitId = urlParams.get('kit');
    if (kitId) {
      setShowAssignModal(true);
      setAssignForm(prev => ({ ...prev, category_id: kitId }));
    }
  }, []);

  const loadData = () => {
    setAssets(companyContext.filterByContext(ls.get("hrAssets", [])));
    setCategories(companyContext.filterByContext(ls.get("hrAssetCategories", [])));
    setAssignments(companyContext.filterByContext(ls.get("employeeAssetAssignments", [])));
    setEmployees(companyContext.filterByContext(ls.get("employees", [])));
    setLoading(false);
  };

  const handleAssign = () => {
    if (!assignForm.employee_id) {
      toast.error("Please select an employee");
      return;
    }
    if (!assignForm.category_id) {
      toast.error("Please select a kit");
      return;
    }

    const emp = employees.find(e => e.id === assignForm.employee_id);
    const cat = categories.find(c => c.id === assignForm.category_id);
    
    if (!emp || !cat) {
      toast.error("Invalid selection");
      return;
    }

    const assetIds: string[] = JSON.parse(cat.asset_ids || "[]");
    if (assetIds.length === 0) {
      toast.error("This kit has no assets");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    
    const newRecords: any[] = [];
    const alreadyAssigned: string[] = [];

    for (const assetId of assetIds) {
      const existing = assignments.find(a => a.employee_id === emp.id && a.asset_id === assetId && a.status === "ACTIVE");
      if (existing) {
        const asset = assets.find(a => a.id === assetId);
        alreadyAssigned.push(asset?.name || assetId);
        continue;
      }
      
      const asset = assets.find(a => a.id === assetId);
      newRecords.push(companyContext.addContextToRecord({
        id: uid("hrt_as"),
        employee_id: emp.id,
        employee_name: `${emp.first_name} ${emp.last_name || ""}`,
        category_id: cat.id,
        category_name: cat.name,
        asset_id: assetId,
        asset_name: asset?.name || assetId,
        asset_brand: asset?.brand || "",
        asset_model: asset?.model || "",
        assigned_date: today,
        condition: assignForm.condition,
        status: "ACTIVE",
        notes: assignForm.notes
      }));
    }

    if (alreadyAssigned.length > 0) {
      toast.warning(`${alreadyAssigned.length} asset(s) already assigned: ${alreadyAssigned.join(", ")}`);
    }

    if (newRecords.length === 0) {
      toast.error("All assets are already assigned to this employee");
      return;
    }

    const updated = [...newRecords, ...assignments];
    setAssignments(updated);
    ls.set("employeeAssetAssignments", updated);
    setShowAssignModal(false);
    setAssignForm({ employee_id: "", category_id: "", condition: "NEW", notes: "" });
    toast.success(`${newRecords.length} asset(s) assigned to ${emp.first_name} ${emp.last_name || ""}`);
  };

  const handleRemoveAssignment = () => {
    if (!selectedAssignment) return;
    
    const updated = assignments.filter(a => a.id !== selectedAssignment.id);
    setAssignments(updated);
    ls.set("employeeAssetAssignments", updated);
    setShowRemoveModal(false);
    setSelectedAssignment(null);
    toast.success("Assignment removed successfully");
  };

  const handleReturn = () => {
    if (!selectedAssignment) return;
    
    const updated = assignments.map(a => 
      a.id === selectedAssignment.id 
        ? { 
            ...a, 
            status: "RETURNED", 
            condition: returnForm.condition,
            return_date: new Date().toISOString().split("T")[0],
            return_notes: returnForm.return_notes
          } 
        : a
    );
    
    setAssignments(updated);
    ls.set("employeeAssetAssignments", updated);
    setShowReturnModal(false);
    setSelectedAssignment(null);
    setReturnForm({ condition: "GOOD", return_notes: "" });
    toast.success("Asset returned successfully");
  };

  const getEmployeeAssets = (employeeId: string) => {
    return assignments.filter(a => a.employee_id === employeeId);
  };

  const filteredAssignments = useMemo(() => {
    let filtered = assignments;
    
    if (filterStatus !== "all") {
      filtered = filtered.filter(a => a.status === filterStatus);
    }
    
    if (selectedEmployee !== "all") {
      filtered = filtered.filter(a => a.employee_id === selectedEmployee);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.employee_name?.toLowerCase().includes(query) ||
        a.asset_name?.toLowerCase().includes(query) ||
        a.category_name?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [assignments, searchQuery, filterStatus, selectedEmployee]);

  const activeCount = assignments.filter(a => a.status === "ACTIVE").length;
  const returnedCount = assignments.filter(a => a.status === "RETURNED").length;
  const employeesWithAssets = new Set(assignments.map(a => a.employee_id)).size;

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
  title="Employee Asset Assignments" 
  subtitle="Track which assets are assigned to each employee"
  actions={
    <Button onClick={() => { 
      setAssignForm({ 
        employee_id: "", 
        category_id: "", 
        condition: "NEW", 
        notes: "" 
      }); 
      setShowAssignModal(true); 
    }}>
      <Plus className="w-4 h-4 mr-2" />
      New Assignment
    </Button>
  }
/>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Assignments</p>
                <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Returned Assets</p>
                <p className="text-2xl font-bold text-slate-600">{returnedCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-500/10">
                <Truck className="w-5 h-5 text-slate-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Employees with Assets</p>
                <p className="text-2xl font-bold">{employeesWithAssets}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Assignments</p>
                <p className="text-2xl font-bold">{assignments.length}</p>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Briefcase className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg">Assignment History</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {ASSET_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAssignments.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No assignments found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery ? "Try a different search term" : "Click 'New Assignment' to assign assets to employees"}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Kit</TableHead>
                    <TableHead>Assigned Date</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map(assignment => {
                    const statusConfig = ASSET_STATUSES.find(s => s.value === assignment.status);
                    const conditionConfig = ASSET_CONDITIONS.find(c => c.value === assignment.condition);
                    return (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            {assignment.employee_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{assignment.asset_name}</div>
                            {assignment.asset_brand && (
                              <div className="text-xs text-muted-foreground">
                                {assignment.asset_brand} {assignment.asset_model}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {assignment.category_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{assignment.assigned_date}</TableCell>
                        <TableCell>
                          {conditionConfig ? (
                            <Badge className={conditionConfig.color} variant="outline">
                              {conditionConfig.label}
                            </Badge>
                          ) : (
                            <Badge variant="outline">{assignment.condition}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {statusConfig ? (
                            <Badge className={statusConfig.color} variant="secondary">
                              {statusConfig.label}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">{assignment.status}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setSelectedAssignment(assignment);
                                setShowDetailsModal(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {assignment.status === "ACTIVE" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-600"
                                  onClick={() => {
                                    setSelectedAssignment(assignment);
                                    setShowReturnModal(true);
                                  }}
                                >
                                  <Truck className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600"
                                  onClick={() => {
                                    setSelectedAssignment(assignment);
                                    setShowRemoveModal(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
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

      {/* Assign Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Assets to Employee</DialogTitle>
            <DialogDescription>
              Select an employee and a kit to assign
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Employee *</Label>
              <SearchableSelect
                value={assignForm.employee_id}
                onChange={(v) => setAssignForm({ ...assignForm, employee_id: v })}
                options={employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name || ""} (${e.employee_id || e.id})` }))}
                placeholder="Select employee"
              />
            </div>
            <div className="grid gap-2">
              <Label>Equipment Kit *</Label>
              <SearchableSelect
                value={assignForm.category_id}
                onChange={(v) => setAssignForm({ ...assignForm, category_id: v })}
                options={categories.map(c => ({ value: c.id, label: `${c.name} (${JSON.parse(c.asset_ids || "[]").length} assets)` }))}
                placeholder="Select kit"
              />
            </div>
            <div className="grid gap-2">
              <Label>Initial Condition</Label>
              <Select value={assignForm.condition} onValueChange={(v) => setAssignForm({ ...assignForm, condition: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CONDITIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={assignForm.notes}
                onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                placeholder="Additional assignment notes"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>Cancel</Button>
            <Button onClick={handleAssign}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Modal */}
      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Return Asset</DialogTitle>
            <DialogDescription>
              Record the return of {selectedAssignment?.asset_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Return Condition</Label>
              <Select value={returnForm.condition} onValueChange={(v) => setReturnForm({ ...returnForm, condition: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CONDITIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Return Notes</Label>
              <Textarea
                value={returnForm.return_notes}
                onChange={(e) => setReturnForm({ ...returnForm, return_notes: e.target.value })}
                placeholder="Any issues or damages to note"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnModal(false)}>Cancel</Button>
            <Button onClick={handleReturn}>
              <Truck className="w-4 h-4 mr-2" />
              Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Assignment Modal */}
      <Dialog open={showRemoveModal} onOpenChange={setShowRemoveModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Assignment</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this assignment?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-muted/30 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Employee:</span>
                <span className="font-medium">{selectedAssignment?.employee_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Asset:</span>
                <span className="font-medium">{selectedAssignment?.asset_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kit:</span>
                <span>{selectedAssignment?.category_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned:</span>
                <span>{selectedAssignment?.assigned_date}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              This action cannot be undone. The asset will be unassigned from this employee.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveAssignment}>
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assignment Details</DialogTitle>
            <DialogDescription>
              Complete information about this asset assignment
            </DialogDescription>
          </DialogHeader>
          {selectedAssignment && (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Employee Name</p>
                  <p className="font-medium">{selectedAssignment.employee_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Asset Name</p>
                  <p className="font-medium">{selectedAssignment.asset_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Kit Category</p>
                  <p>{selectedAssignment.category_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Brand / Model</p>
                  <p>{selectedAssignment.asset_brand} {selectedAssignment.asset_model}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Assigned Date</p>
                  <p>{selectedAssignment.assigned_date}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Return Date</p>
                  <p>{selectedAssignment.return_date || "Not returned yet"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Condition</p>
                  <Badge variant="outline">{selectedAssignment.condition}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="secondary">{selectedAssignment.status}</Badge>
                </div>
              </div>
              {(selectedAssignment.notes || selectedAssignment.return_notes) && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Notes</p>
                  {selectedAssignment.notes && (
                    <div className="text-sm bg-muted/30 p-2 rounded mb-2">
                      <span className="text-xs text-muted-foreground">Assignment:</span>
                      <p>{selectedAssignment.notes}</p>
                    </div>
                  )}
                  {selectedAssignment.return_notes && (
                    <div className="text-sm bg-muted/30 p-2 rounded">
                      <span className="text-xs text-muted-foreground">Return:</span>
                      <p>{selectedAssignment.return_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowDetailsModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}