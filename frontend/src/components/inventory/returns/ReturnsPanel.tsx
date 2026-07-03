"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCcw, Search, Undo2, RotateCcw, Receipt, ShoppingCart,
  Loader2, AlertTriangle, CheckCircle2, XCircle, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { useReturns, useLookupDocument, useCreateReturn, useReturnDetail } from "@/hooks/useReturns";
import { useWarehouses } from "@/hooks/useWarehouses";
import { format } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    CANCELLED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    INVOICE: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    POS: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[status] || map.DRAFT}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

interface ReturnsPanelProps {
  moduleCode: "INVENTORY" | "SALES" | "FINANCE";
}

export default function ReturnsPanel({ moduleCode }: ReturnsPanelProps) {
  const fmt = useFormatCurrency();
  const router = useRouter();
  const searchParams = useSearchParams();

  /* ─── Module context ─── */
  // Sales module → show only INVOICE returns
  // Finance module → show ALL returns
  // Inventory module → show ALL returns
  const isSalesModule = moduleCode === "SALES";

  /* ─── Pre-population from query params ─── */
  const prefillDocType = searchParams.get("document_type") as "INVOICE" | "POS" | null;
  const prefillDocNumber = searchParams.get("document_number");

  /* ─── Tabs ─── */
  const [activeTab, setActiveTab] = useState("all");

  /* ─── List data ─── */
  const { data: returns, isLoading, refetch } = useReturns(
    activeTab === "all"
      ? { return_type: isSalesModule ? "INVOICE" : undefined }
      : {
          status: activeTab.toUpperCase(),
          ...(isSalesModule ? { return_type: "INVOICE" } : {}),
        }
  );

  /* ─── Create Return Modal ─── */
  const [createOpen, setCreateOpen] = useState(false);
  const [searchType, setSearchType] = useState<"INVOICE" | "POS">("INVOICE");
  const [docNumber, setDocNumber] = useState("");
  const lookupDoc = useLookupDocument();
  const createReturn = useCreateReturn();
  const { data: warehouses } = useWarehouses({ is_active: true });

  const [lookedUpDoc, setLookedUpDoc] = useState<any>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnLines, setReturnLines] = useState<Record<string, { quantity: number; restock: boolean; return_to_supplier: boolean }>>({});
  const [submitting, setSubmitting] = useState(false);

  /* ─── Detail View ─── */
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: detail } = useReturnDetail(detailId || "");

  /* ─── Auto-populate from query params ─── */
  useEffect(() => {
    if (prefillDocType && prefillDocNumber && !createOpen) {
      setCreateOpen(true);
      setSearchType(prefillDocType);
      setDocNumber(prefillDocNumber);
      // Auto-trigger lookup after a short delay so modal renders
      const timer = setTimeout(() => {
        handleLookup();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [prefillDocType, prefillDocNumber]);

  const handleLookup = async () => {
    const num = docNumber;
    const type = searchType;
    if (!num.trim()) { toast.error("Enter a document number"); return; }
    try {
      const result = await lookupDoc.mutateAsync({ return_type: type, document_number: num.trim() });
      setLookedUpDoc(result.data);
      // Initialize return lines
      const initial: Record<string, any> = {};
      result.data.lines.forEach((l: any) => {
        initial[l.source_line_id] = {
          quantity: l.max_returnable,
          restock: !l.is_manual_entry,
          return_to_supplier: l.is_manual_entry && !!l.vendor_id,
        };
      });
      setReturnLines(initial);
      if (warehouses && warehouses.length > 0 && !selectedWarehouse) {
        setSelectedWarehouse(warehouses[0].id);
      }
    } catch (e: any) {
      toast.error(e?.message || "Document not found or not fully paid");
    }
  };

  const handleCreateReturn = async () => {
    if (!lookedUpDoc || !selectedWarehouse) { toast.error("Select warehouse"); return; }

    const lines = Object.entries(returnLines)
      .filter(([_, data]) => data.quantity > 0)
      .map(([source_line_id, data]) => {
        const lineInfo = lookedUpDoc.lines.find((l: any) => l.source_line_id === source_line_id);
        return {
          source_line_id,
          quantity: data.quantity,
          unit_price: lineInfo?.unit_price || 0,
          refund_amount: (lineInfo?.unit_price || 0) * data.quantity,
          restock: data.restock,
          return_to_supplier: data.return_to_supplier,
        };
      });

    if (lines.length === 0) { toast.error("Select at least one line to return"); return; }

    setSubmitting(true);
    try {
      await createReturn.mutateAsync({
        return_type: lookedUpDoc.document.return_type,
        document_id: lookedUpDoc.document.document_id,
        warehouse_id: selectedWarehouse,
        return_date: new Date().toISOString(),
        reason: returnReason,
        lines,
      });
      toast.success("Return processed successfully");
      setCreateOpen(false);
      resetCreateForm();
      refetch();
    } catch (e: any) {
      toast.error(e?.message || "Failed to process return");
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setLookedUpDoc(null);
    setDocNumber("");
    setReturnLines({});
    setReturnReason("");
    setSelectedWarehouse("");
    setSearchType("INVOICE");
    lookupDoc.reset();
  };

  const closeCreateModal = () => {
    setCreateOpen(false);
    resetCreateForm();
    // Clear prefill params from URL
    if (prefillDocType) {
      router.replace(
        moduleCode === "SALES" ? "/sales/return" :
        moduleCode === "FINANCE" ? "/finance/return" :
        "/inventory/returns"
      );
    }
  };

  const totalRefundAmount = Object.entries(returnLines)
    .filter(([_, d]) => d.quantity > 0)
    .reduce((sum, [id, d]) => {
      const line = lookedUpDoc?.lines?.find((l: any) => l.source_line_id === id);
      return sum + (line?.unit_price || 0) * d.quantity;
    }, 0);

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-orange-500" /> Return & Refund
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isSalesModule
              ? "Process returns and refunds for paid invoices"
              : "Process returns and refunds for paid invoices and POS orders — restock inventory or reverse supplier bills"
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Dialog open={createOpen} onOpenChange={(open) => {
            if (!open) closeCreateModal();
            else setCreateOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Undo2 className="mr-2 h-4 w-4" /> New Return
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <RotateCcw className="h-5 w-5 text-orange-500" />
                  Create Return & Refund
                </DialogTitle>
              </DialogHeader>

              {/* Step 1: Lookup Document */}
              {!lookedUpDoc && (
                <div className="space-y-4">
                  <div className="flex items-end gap-3">
                    <div className="space-y-1.5 flex-1">
                      <Label>Document Type</Label>
                      <Select
                        value={searchType}
                        onValueChange={(v: "INVOICE" | "POS") => setSearchType(v)}
                        disabled={!!prefillDocType}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INVOICE">Customer Invoice</SelectItem>
                          {!isSalesModule && <SelectItem value="POS">POS Sale / Sales Order</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 flex-[2]">
                      <Label>Document Number</Label>
                      <Input
                        placeholder={searchType === "INVOICE" ? "INV-..." : "SO-..."}
                        value={docNumber}
                        onChange={e => setDocNumber(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleLookup()}
                        disabled={!!prefillDocNumber && !!lookedUpDoc}
                      />
                    </div>
                    <Button onClick={handleLookup} disabled={lookupDoc.isPending}>
                      {lookupDoc.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                      Lookup
                    </Button>
                  </div>

                  {lookupDoc.isError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      {lookupDoc.error?.message || "Document not found. Ensure it's fully paid."}
                    </div>
                  )}

                  <div className="p-4 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Enter a paid invoice{!isSalesModule ? " or POS order" : ""} number to look up its line items for return
                  </div>
                </div>
              )}

              {/* Step 2: Select Lines & Process */}
              {lookedUpDoc && (
                <div className="space-y-4">
                  {/* Document Info */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      {lookedUpDoc.document.return_type === "INVOICE" ? (
                        <Receipt className="h-5 w-5 text-blue-500" />
                      ) : (
                        <ShoppingCart className="h-5 w-5 text-purple-500" />
                      )}
                      <div>
                        <p className="font-medium">{lookedUpDoc.document.document_number}</p>
                        <p className="text-xs text-muted-foreground">
                          Customer: {lookedUpDoc.document.customer?.name || "Walk-in"} · Type: {lookedUpDoc.document.return_type}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={lookedUpDoc.document.return_type} />
                  </div>

                  {/* Warehouse Selection */}
                  <div className="space-y-1.5">
                    <Label>Return to Warehouse</Label>
                    <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                      <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                      <SelectContent>
                        {warehouses?.map(wh => (
                          <SelectItem key={wh.id} value={wh.id}>{wh.warehouse_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Line Items */}
                  <div>
                    <Label className="mb-2 block">Items to Return</Label>
                    <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                      {lookedUpDoc.lines.map((line: any) => {
                        const rl = returnLines[line.source_line_id] || { quantity: 0, restock: true, return_to_supplier: false };
                        return (
                          <div key={line.source_line_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{line.product_name}</p>
                              <p className="text-xs text-muted-foreground">SKU: {line.variant_sku} · Max: {line.max_returnable}</p>
                              {line.vendor_name && (
                                <p className="text-xs text-muted-foreground">Supplier: {line.vendor_name}</p>
                              )}
                            </div>
                            <div className="w-20">
                              <Input
                                type="number"
                                min={0}
                                max={line.max_returnable}
                                value={rl.quantity}
                                onChange={e => setReturnLines(prev => ({
                                  ...prev,
                                  [line.source_line_id]: { ...prev[line.source_line_id], quantity: Math.min(Number(e.target.value) || 0, line.max_returnable) },
                                }))}
                                className="h-8 text-center"
                              />
                            </div>
                            <div className="text-right text-sm shrink-0 w-24">
                              <p className="font-medium">{fmt(line.unit_price * (rl.quantity || 0))}</p>
                            </div>
                            {line.is_manual_entry && line.vendor_id && (
                              <div className="flex gap-1 shrink-0">
                                <Badge
                                  variant={rl.return_to_supplier ? "default" : "outline"}
                                  className="cursor-pointer text-xs"
                                  onClick={() => setReturnLines(prev => ({
                                    ...prev,
                                    [line.source_line_id]: { ...prev[line.source_line_id], return_to_supplier: !prev[line.source_line_id]?.return_to_supplier },
                                  }))}
                                >
                                  {rl.return_to_supplier ? "↩ Vendor" : "📦 Stock"}
                                </Badge>
                              </div>
                            )}
                            {!line.is_manual_entry && (
                              <Badge variant="secondary" className="text-xs shrink-0">Restock</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="space-y-1.5">
                    <Label>Reason for Return</Label>
                    <Input
                      placeholder="Optional reason..."
                      value={returnReason}
                      onChange={e => setReturnReason(e.target.value)}
                    />
                  </div>

                  {/* Summary */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border">
                    <span className="text-sm font-medium">Total Refund Amount</span>
                    <span className="text-lg font-bold text-primary">{fmt(totalRefundAmount)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={resetCreateForm}>Back to Search</Button>
                    <Button onClick={handleCreateReturn} disabled={submitting || totalRefundAmount <= 0}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                      Process Return & Refund
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Returns</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card className="border bg-card/65">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {activeTab === "all" ? "All Returns" : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Returns`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !returns || returns.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <RotateCcw className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No returns found</p>
                  <p className="text-xs mt-1">Click "New Return" to process a return for a paid invoice{!isSalesModule ? " or POS order" : ""}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b bg-muted/30">
                      <tr>
                        <th className="px-3 py-2.5 text-left">Return #</th>
                        <th className="px-3 py-2.5 text-left">Type</th>
                        <th className="px-3 py-2.5 text-left">Document</th>
                        <th className="px-3 py-2.5 text-left">Customer</th>
                        <th className="px-3 py-2.5 text-right">Refund</th>
                        <th className="px-3 py-2.5 text-center">Status</th>
                        <th className="px-3 py-2.5 text-right">Date</th>
                        <th className="px-3 py-2.5 text-center">Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returns.map((r) => (
                        <tr
                          key={r._id}
                          className="border-b last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                          onClick={() => setDetailId(r._id === detailId ? null : r._id)}
                        >
                          <td className="px-3 py-2.5 font-medium">{r.return_number}</td>
                          <td className="px-3 py-2.5"><StatusBadge status={r.return_type} /></td>
                          <td className="px-3 py-2.5 text-muted-foreground">{r.document_number}</td>
                          <td className="px-3 py-2.5">{r.customer_name || "—"}</td>
                          <td className="px-3 py-2.5 text-right font-medium">{fmt(r.total_refund_amount)}</td>
                          <td className="px-3 py-2.5 text-center"><StatusBadge status={r.status} /></td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground text-xs">
                            {r.return_date ? format(new Date(r.return_date), "MMM d, yyyy") : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-center text-muted-foreground">{r.lines_count || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Detail View */}
              {detailId && detail && (
                <div className="mt-6 border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <RotateCcw className="h-5 w-5 text-orange-500" />
                      {detail.return_number}
                      <StatusBadge status={detail.status} />
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => setDetailId(null)}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-muted/20">
                      <p className="text-xs text-muted-foreground">Document</p>
                      <p className="font-medium">{detail.document_number}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/20">
                      <p className="text-xs text-muted-foreground">Customer</p>
                      <p className="font-medium">{detail.customer_name || "—"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/20">
                      <p className="text-xs text-muted-foreground">Warehouse</p>
                      <p className="font-medium">{detail.warehouse_name}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/20">
                      <p className="text-xs text-muted-foreground">Total Refund</p>
                      <p className="font-bold text-primary">{fmt(detail.total_refund_amount)}</p>
                    </div>
                  </div>

                  {detail.reason && (
                    <div className="mb-4 p-3 rounded-lg bg-muted/20">
                      <p className="text-xs text-muted-foreground">Reason</p>
                      <p className="text-sm">{detail.reason}</p>
                    </div>
                  )}

                  {detail.lines && detail.lines.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground border-b bg-muted/30">
                          <tr>
                            <th className="px-3 py-2 text-left">Variant</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2 text-right">Unit Price</th>
                            <th className="px-3 py-2 text-right">Refund</th>
                            <th className="px-3 py-2 text-center">Restock</th>
                            <th className="px-3 py-2 text-center">To Supplier</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.lines.map((l) => (
                            <tr key={l._id} className="border-b last:border-0">
                              <td className="px-3 py-2">
                                <span className="font-medium">{l.is_manual_entry ? l.manual_variant_name : "Variant"}</span>
                                <span className="text-xs text-muted-foreground ml-2">{l.manual_variant_sku || "—"}</span>
                              </td>
                              <td className="px-3 py-2 text-right">{l.quantity}</td>
                              <td className="px-3 py-2 text-right">{fmt(l.unit_price)}</td>
                              <td className="px-3 py-2 text-right font-medium">{fmt(l.refund_amount)}</td>
                              <td className="px-3 py-2 text-center">
                                {l.restock ? <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" /> : <XCircle className="h-4 w-4 text-muted-foreground inline" />}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {l.return_to_supplier ? <CheckCircle2 className="h-4 w-4 text-amber-500 inline" /> : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Created: {format(new Date(detail.created_at), "MMM d, yyyy HH:mm")}</span>
                    {detail.completed_at && <span>Completed: {format(new Date(detail.completed_at), "MMM d, yyyy HH:mm")}</span>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
