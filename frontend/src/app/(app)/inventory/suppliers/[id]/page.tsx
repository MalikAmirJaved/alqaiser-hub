"use client";
import { useParams, useRouter } from "next/navigation";
import { useSupplierDetail } from "@/hooks/useSuppliers";
import PageHeader from "@/components/PageHeader";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Mail, Phone, MapPin, User, Hash,
  ShoppingCart, FileText, DollarSign, TrendingUp,
  History, Shield, Eye, CreditCard, Wallet,
  Package, Receipt, ArrowUpRight,
} from "lucide-react";

const statusColors: Record<string, string> = {
  active: "bg-green-500/15 text-green-600 dark:text-green-400",
  inactive: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
  suspended: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const poStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
  CONFIRMED: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  PARTIALLY_RECEIVED: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  FULLY_RECEIVED: "bg-green-500/15 text-green-600 dark:text-green-400",
  CANCELLED: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const billStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
  CANCELLED: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const paymentStatusColors: Record<string, string> = {
  UNPAID: "bg-red-500/15 text-red-600 dark:text-red-400",
  PARTIAL: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  PAID: "bg-green-500/15 text-green-600 dark:text-green-400",
};

const transTypeLabels: Record<string, string> = {
  PURCHASE: "Purchase", PAYMENT: "Payment", CREDIT_NOTE: "Credit Note",
  INVOICE_ADJUSTMENT: "Invoice Adjustment", CREDIT_APPLIED: "Credit Applied",
  PURCHASE_REVERSAL: "Purchase Reversal",
};

const transTypeColors: Record<string, string> = {
  PURCHASE: "bg-blue-500/15 text-blue-600", PAYMENT: "bg-green-500/15 text-green-600",
  CREDIT_NOTE: "bg-amber-500/15 text-amber-600", INVOICE_ADJUSTMENT: "bg-purple-500/15 text-purple-600",
  CREDIT_APPLIED: "bg-rose-500/15 text-rose-600", PURCHASE_REVERSAL: "bg-orange-500/15 text-orange-600",
};

export default function SupplierDetailPage() {
  const formatCurrency = useFormatCurrency();
  const { id } = useParams();
  const router = useRouter();
  const { data, isLoading } = useSupplierDetail(id as string);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading supplier details...</div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">Supplier not found</div>;

  const { supplier, summary, purchase_orders, bills, payments, quote_lines, invoice_lines, history, audit_logs } = data;

  return (
    <div className="space-y-6">
      <PageHeader title={supplier.name} subtitle={`Code: ${supplier.code}`} />

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <SummaryCard label="Balance" value={formatCurrency(Number(summary.balance))} icon={Wallet} />
        <SummaryCard label="Credit" value={formatCurrency(Number(summary.credit))} icon={CreditCard} className="text-success" />
        <SummaryCard label="Purchase Orders" value={String(summary.total_purchase_orders)} icon={ShoppingCart} />
        <SummaryCard label="PO Amount" value={formatCurrency(Number(summary.total_po_amount))} icon={Package} />
        <SummaryCard label="Bills" value={String(summary.total_bills)} icon={FileText} />
        <SummaryCard label="Bill Amount" value={formatCurrency(Number(summary.total_bill_amount))} icon={Receipt} />
        <SummaryCard label="Paid" value={formatCurrency(Number(summary.total_paid))} icon={TrendingUp} className="text-success" />
        <SummaryCard label="Outstanding" value={formatCurrency(Number(summary.total_outstanding))} icon={DollarSign} className="text-destructive" />
      </div>

      {/* ── Supplier Info Card ── */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Building2 className="w-4 h-4" />Supplier Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <InfoRow icon={Building2} label="Name" value={supplier.name} />
            <InfoRow icon={Hash} label="Code" value={supplier.code} />
            <InfoRow icon={User} label="Contact Person" value={supplier.contact_person || "-"} />
            <InfoRow icon={Mail} label="Email" value={supplier.email || "-"} />
            <InfoRow icon={Phone} label="Phone" value={supplier.phone || "-"} />
            <InfoRow icon={MapPin} label="Address" value={[supplier.address_line, supplier.city, supplier.state, supplier.country].filter(Boolean).join(", ") || "-"} />
            <InfoRow icon={Hash} label="Postal Code" value={supplier.postal_code || "-"} />
            <InfoRow icon={Shield} label="Status" value={
              <Badge className={statusColors[supplier.status]}>{supplier.status}</Badge>
            } />
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <Tabs defaultValue="purchase_orders" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="purchase_orders" className="flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5" />Purchase Orders
          </TabsTrigger>
          <TabsTrigger value="bills" className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />Bills
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />Payments
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5" />Usage
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />History
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />Audit Trail
          </TabsTrigger>
        </TabsList>

        {/* ═══ PO Tab ═══ */}
        <TabsContent value="purchase_orders" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Purchase Orders ({purchase_orders.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Lines</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchase_orders.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No purchase orders</TableCell></TableRow>
                  ) : purchase_orders.map((po: Record<string, unknown>) => (
                    <TableRow key={po._id as string} className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/inventory/purchases/${po._id}`)}>
                      <TableCell className="font-medium">{po.order_number as string}</TableCell>
                      <TableCell>{(po.order_date as string)?.slice(0, 10) || "-"}</TableCell>
                      <TableCell><Badge className={poStatusColors[po.status as string] || ""}>{po.status as string}</Badge></TableCell>
                      <TableCell className="font-mono">{formatCurrency(Number(po.total_amount))}</TableCell>
                      <TableCell>{(po.lines as Array<unknown>)?.length || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Bills Tab ═══ */}
        <TabsContent value="bills" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Supplier Bills ({bills.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No bills</TableCell></TableRow>
                  ) : bills.map((b: Record<string, unknown>) => (
                    <TableRow key={b.id as string} className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/finance/supplier-bills/${b.id}`)}>
                      <TableCell className="font-medium">{b.bill_number as string}</TableCell>
                      <TableCell>{(b.bill_date as string)?.slice(0, 10)}</TableCell>
                      <TableCell>{(b.due_date as string)?.slice(0, 10)}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(Number(b.amount))}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(Number(b.paid_amount))}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(Number(b.outstanding))}</TableCell>
                      <TableCell>
                        <Badge className={paymentStatusColors[b.payment_status as string] || ""}>
                          {b.payment_status as string || "UNPAID"}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge className={billStatusColors[b.status as string] || ""}>{b.status as string}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Payments Tab ═══ */}
        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Payments ({payments.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No payments</TableCell></TableRow>
                  ) : payments.map((p: Record<string, unknown>) => (
                    <TableRow key={p.id as string}>
                      <TableCell>{(p.payment_date as string)?.slice(0, 10)}</TableCell>
                      <TableCell>{p.reference_number as string || "-"}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(Number(p.amount))}</TableCell>
                      <TableCell className="capitalize">{(p.payment_method as string)?.toLowerCase().replace(/_/g, " ")}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "CONFIRMED" ? "default" : "secondary"}>
                          {p.status as string}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Usage Tab (Quote Lines + Invoice Lines) ═══ */}
        <TabsContent value="usage" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Manual Quote Lines ({quote_lines.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Line Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quote_lines.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No quote references</TableCell></TableRow>
                  ) : quote_lines.map((ql) => (
                    <TableRow key={ql.id}>
                      <TableCell className="font-medium">{ql.quote_number}</TableCell>
                      <TableCell>{ql.item}</TableCell>
                      <TableCell>{ql.quantity}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(Number(ql.unit_price))}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(Number(ql.line_total))}</TableCell>
                      <TableCell><Badge variant="outline">{ql.quote_status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Manual Invoice Lines ({invoice_lines.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Line Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice_lines.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No invoice references</TableCell></TableRow>
                  ) : invoice_lines.map((il) => (
                    <TableRow key={il.id}>
                      <TableCell className="font-medium">{il.invoice_number}</TableCell>
                      <TableCell>{il.item}</TableCell>
                      <TableCell>{il.quantity}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(Number(il.unit_price))}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(Number(il.line_total))}</TableCell>
                      <TableCell><Badge variant="outline">{il.invoice_status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ History Tab ═══ */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Transaction History ({history.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Balance After</TableHead>
                    <TableHead>Credit After</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No history</TableCell></TableRow>
                  ) : history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(h.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${transTypeColors[h.transaction_type] || ""}`}>
                          {transTypeLabels[h.transaction_type] || h.transaction_type}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{formatCurrency(Number(h.amount))}</TableCell>
                      <TableCell className="font-mono text-sm">{formatCurrency(Number(h.balance_after))}</TableCell>
                      <TableCell className="font-mono text-sm">{formatCurrency(Number(h.credit_after))}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{h.reference_type} {h.reference_id?.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{h.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Audit Trail Tab ═══ */}
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Audit Trail ({audit_logs.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Changed Fields</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit_logs.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No audit logs</TableCell></TableRow>
                  ) : audit_logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="text-sm">{log.user_name || `User #${log.user_id}`}</div>
                        {log.user_email && <div className="text-xs text-muted-foreground">{log.user_email}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.action === "CREATE" ? "default" : log.action === "UPDATE" ? "secondary" : "destructive"}>
                          {log.action_display}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.field_changes.length === 0 ? (
                          <span className="text-xs text-muted-foreground">-</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {log.field_changes.map((fc) => (
                              <span key={fc.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-muted whitespace-nowrap">
                                <span className="font-medium">{fc.field_name}</span>
                                {fc.old_value !== null && fc.new_value !== null && (
                                  <span className="text-muted-foreground">
                                    {fc.old_value} → {fc.new_value}
                                  </span>
                                )}
                                {fc.old_value === null && fc.new_value !== null && (
                                  <span className="text-green-600">= {fc.new_value}</span>
                                )}
                                {fc.old_value !== null && fc.new_value === null && (
                                  <span className="text-red-600">✕ {fc.old_value}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, className = "" }: {
  label: string; value: string; icon: React.ElementType; className?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
          <p className={`text-base font-bold truncate ${className}`}>{value}</p>
        </div>
        <Icon className="w-5 h-5 shrink-0 text-muted-foreground/30" />
      </CardContent>
    </Card>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground min-w-24">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}