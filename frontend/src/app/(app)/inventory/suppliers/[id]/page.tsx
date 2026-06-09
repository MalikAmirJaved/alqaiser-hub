"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useSupplier } from "@/hooks/useSuppliers";
import { usePayments, type Payment } from "@/hooks/finance/usePayments";
import PageHeader from "@/components/PageHeader";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Filter, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { DatePicker } from "@/components/reuseable/DatePicker";
import { addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";

type DateRange = { start: string; end: string };

export default function SupplierDetailPage() {
  const { id } = useParams();
  const { data: supplier, isLoading: supplierLoading } = useSupplier(id as string);
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

  return (
    <div className="space-y-6">
      <PageHeader title={supplier.name} subtitle={`Code: ${supplier.code} · Payment Terms: ${supplier.payment_terms || "N/A"}`} />

      {/* Supplier Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Unpaid Amount</p>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(totalUnpaid)}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-destructive/30" />
          </CardContent>
        </Card>
      </div>

      {/* Date Filter */}
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

          {/* Payments Table */}
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
    </div>
  );
}