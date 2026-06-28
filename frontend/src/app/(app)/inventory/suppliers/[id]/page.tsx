"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useSupplier, useSupplierHistory } from "@/hooks/useSuppliers";
import { usePayments, type Payment } from "@/hooks/finance/usePayments";
import PageHeader from "@/components/PageHeader";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Filter, DollarSign, TrendingUp, TrendingDown, History, Wallet, CreditCard } from "lucide-react";
import { DatePicker } from "@/components/reuseable/DatePicker";
import { addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";

type DateRange = { start: string; end: string };

const transactionTypeLabels: Record<string, string> = {
  PURCHASE: "Purchase",
  PAYMENT: "Payment",
  CREDIT_NOTE: "Credit Note",
  INVOICE_ADJUSTMENT: "Invoice Adjustment",
  CREDIT_APPLIED: "Credit Applied",
};

const transactionTypeColors: Record<string, string> = {
  PURCHASE: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  PAYMENT: "bg-green-500/15 text-green-600 dark:text-green-400",
  CREDIT_NOTE: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  INVOICE_ADJUSTMENT: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  CREDIT_APPLIED: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

export default function SupplierDetailPage() {
  const formatCurrency = useFormatCurrency();
  const { id } = useParams();
  const { data: supplier, isLoading: supplierLoading } = useSupplier(id as string);
  const { data: supplierHistoryData } = useSupplierHistory(id as string);
  const [dateRange, setDateRange] = useState<DateRange>({ start: "", end: "" });
  const [filterPreset, setFilterPreset] = useState<string>("all");

  const { data: payments = [], isLoading: paymentsLoading } = usePayments(
    id ? { supplier: id as string } : undefined
  );

  // Filter payments by date range
  const filteredPayments = payments.filter((p) => {
    if (!dateRange.start && !dateRange.end) return true;
    const paymentDate = new Date(p.payment_date);
    if (dateRange.start && paymentDate < new Date(dateRange.start)) return false;
    if (dateRange.end && paymentDate > new Date(dateRange.end)) return false;
    return true;
  });

  const totalPaid = filteredPayments
    .filter((p) => p.status === "CONFIRMED")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalUnpaid = filteredPayments
    .filter((p) => p.status !== "CONFIRMED")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const handlePreset = (preset: string) => {
    setFilterPreset(preset);
    const today = new Date();
    switch (preset) {
      case "today":
        setDateRange({ start: format(today, "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") });
        break;
      case "week":
        setDateRange({
          start: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
          end: format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        });
        break;
      case "month":
        setDateRange({
          start: format(startOfMonth(today), "yyyy-MM-dd"),
          end: format(endOfMonth(today), "yyyy-MM-dd"),
        });
        break;
      default:
        setDateRange({ start: "", end: "" });
    }
  };

  if (supplierLoading) return <div className="p-8 text-center">Loading supplier...</div>;
  if (!supplier) return <div className="p-8 text-center">Supplier not found</div>;

  const supplierHistory = supplierHistoryData?.results ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={supplier.name} subtitle={`Code: ${supplier.code}`} />

      {/* Balance & Credit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(Number(supplier.balance) || 0)}</p>
            </div>
            <Wallet className="w-8 h-8 text-muted-foreground/30" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Credit</p>
              <p className="text-2xl font-bold text-success">{formatCurrency(Number(supplier.credit) || 0)}</p>
            </div>
            <CreditCard className="w-8 h-8 text-success/30" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Payments (Filtered)</p>
              <p className="text-2xl font-bold">{filteredPayments.length}</p>
            </div>
            <DollarSign className="w-8 h-8 text-muted-foreground/30" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Paid Amount</p>
              <p className="text-2xl font-bold text-success">{formatCurrency(totalPaid)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-success/30" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Payments | History */}
      <Tabs defaultValue="payments" className="w-full">
        <TabsList>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* ── Payments Tab ── */}
        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex gap-2">
                  <Button variant={filterPreset === "today" ? "default" : "outline"} onClick={() => handlePreset("today")}>
                    Today
                  </Button>
                  <Button variant={filterPreset === "week" ? "default" : "outline"} onClick={() => handlePreset("week")}>
                    This Week
                  </Button>
                  <Button variant={filterPreset === "month" ? "default" : "outline"} onClick={() => handlePreset("month")}>
                    This Month
                  </Button>
                  <Button variant={filterPreset === "all" ? "default" : "outline"} onClick={() => handlePreset("all")}>
                    All
                  </Button>
                </div>
                <div className="flex gap-2 items-center">
                  <DatePicker
                    value={dateRange.start}
                    onChange={(val) => setDateRange((prev) => ({ ...prev, start: val || "" }))}
                    placeholder="Start Date"
                  />
                  <span className="text-muted-foreground">–</span>
                  <DatePicker
                    value={dateRange.end}
                    onChange={(val) => setDateRange((prev) => ({ ...prev, end: val || "" }))}
                    placeholder="End Date"
                  />
                  <Button variant="outline" onClick={() => setDateRange({ start: "", end: "" })}>
                    Clear
                  </Button>
                </div>
              </div>

              {paymentsLoading ? (
                <div className="text-center py-8">Loading payments...</div>
              ) : filteredPayments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No payments found for this period.</div>
              ) : (
                <div className="overflow-x-auto">
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
                      {filteredPayments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.payment_date}</TableCell>
                          <TableCell>{p.reference_number || "-"}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(Number(p.amount))}</TableCell>
                          <TableCell>{p.payment_method}</TableCell>
                          <TableCell>
                            <Badge variant={p.status === "CONFIRMED" ? "default" : "secondary"}>
                              {p.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── History Tab ── */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Supplier History</CardTitle>
            </CardHeader>
            <CardContent>
              {supplierHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No history records found.</div>
              ) : (
                <div className="overflow-x-auto">
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
                      {supplierHistory.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(h.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${transactionTypeColors[h.transaction_type] || ""}`}>
                              {transactionTypeLabels[h.transaction_type] || h.transaction_type}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{formatCurrency(Number(h.amount))}</TableCell>
                          <TableCell className="font-mono text-sm">{formatCurrency(Number(h.balance_after))}</TableCell>
                          <TableCell className="font-mono text-sm">{formatCurrency(Number(h.credit_after))}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{h.reference_type} #{h.reference_id?.slice(0, 8)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{h.notes || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}