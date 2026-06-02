"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useJournalEntries, type JournalEntry } from "@/hooks/finance/useJournalEntries";
import { formatCurrency } from "@/lib/currency";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // if you have shadcn; otherwise custom modal
import { ChevronDown, ChevronUp, Eye } from "lucide-react";

// Simple custom modal if you don't have shadcn
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function X(props: any) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>; }

export default function JournalEntriesPage() {
  const permissions = useFeaturePermissions("FINANCE", "journal");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [entryNumber, setEntryNumber] = useState("");
  const [referenceType, setReferenceType] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const { data: entries, isLoading } = useJournalEntries({
    date__gte: dateFrom || undefined,
    date__lte: dateTo || undefined,
    entry_number: entryNumber || undefined,
    reference_type: referenceType || undefined,
    ordering: "-date",
  });

  const referenceTypeOptions = [
    { value: "", label: "All" },
    { value: "SupplierBill", label: "Supplier Bill" },
    { value: "CustomerInvoice", label: "Customer Invoice" },
    { value: "Payment", label: "Payment" },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Journal Entries" subtitle="View all double‑entry accounting records" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          placeholder="From date"
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          placeholder="To date"
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        />
        <input
          type="text"
          value={entryNumber}
          onChange={(e) => setEntryNumber(e.target.value)}
          placeholder="Entry number"
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background w-40"
        />
        <select
          value={referenceType}
          onChange={(e) => setReferenceType(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background"
        >
          {referenceTypeOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entry #</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reference</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Total Debit</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Total Credit</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={7} className="px-4 py-3"><div className="h-4 bg-muted rounded w-full" /></td>
                </tr>
              ))
            ) : entries?.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No journal entries found</td></tr>
            ) : (
              entries?.map((entry) => {
                const totalDebit = entry.lines.reduce(
  (sum, line) => sum + parseFloat(String(line.debit || 0)),
  0
);

const totalCredit = entry.lines.reduce(
  (sum, line) => sum + parseFloat(String(line.credit || 0)),
  0
);
                return (
                  <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">{entry.date}</td>
                    <td className="px-4 py-3 font-mono text-xs">{entry.entry_number}</td>
                    <td className="px-4 py-3 max-w-md truncate">{entry.description}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        {entry.reference_type || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-success">{formatCurrency(Number(totalDebit))}</td>
                    <td className="px-4 py-3 text-destructive">{formatCurrency(Number(totalCredit))}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedEntry(entry)}
                        className="p-1.5 rounded-md hover:bg-muted"
                        title="View lines"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Details Modal */}
      <Modal open={!!selectedEntry} onClose={() => setSelectedEntry(null)} title="Journal Entry Details">
        {selectedEntry && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Entry number:</span> {selectedEntry.entry_number}</div>
              <div><span className="text-muted-foreground">Date:</span> {selectedEntry.date}</div>
              <div className="col-span-2"><span className="text-muted-foreground">Description:</span> {selectedEntry.description}</div>
              <div><span className="text-muted-foreground">Reference:</span> {selectedEntry.reference_type || "—"}</div>
              <div><span className="text-muted-foreground">Posted:</span> {selectedEntry.is_posted ? "Yes" : "No"}</div>
            </div>
            <div className="border-t pt-2">
              <h4 className="font-medium mb-2">Lines</h4>
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-2 py-1 text-left">Account</th>
                    <th className="px-2 py-1 text-right">Debit</th>
                    <th className="px-2 py-1 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEntry.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-2 py-1">{line.account?.code} – {line.account?.name}</td>
                      <td className="px-2 py-1 text-right text-success">{Number(line.debit) > 0 ? formatCurrency(Number(line.debit)) : "—"}</td>
                      <td className="px-2 py-1 text-right text-destructive">{line.credit > 0 ? formatCurrency(line.credit) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}