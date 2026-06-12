"use client";

import { useParams } from "next/navigation";
import { DetailLayout, StandardSidebar } from "@/components/reuseable/final/DetailLayout";
import { useJournalEntry } from "@/hooks/finance/useJournalEntries";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";

const toNumber = (value: number | string): number => {
  return typeof value === "string" ? parseFloat(value) : value;
};

export default function JournalEntryDetailPage() {
    const formatCurrency = useFormatCurrency();
  const { id } = useParams();
  const { data: entry, isLoading } = useJournalEntry(id as string);
  const permissions = useFeaturePermissions("FINANCE", "journal");

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!entry) return <div className="p-8 text-center">Journal entry not found</div>;

  const totalDebit = entry.lines.reduce((sum, line) => sum + toNumber(line.debit), 0);
  const totalCredit = entry.lines.reduce((sum, line) => sum + toNumber(line.credit), 0);

  const tabs = [
    {
      id: "lines",
      label: "Journal Lines",
      count: entry.lines.length,
      render: () => (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="px-2 py-2 text-left">Account</th>
                <th className="px-2 py-2 text-right">Debit</th>
                <th className="px-2 py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {entry.lines.map((line) => (
                <tr key={line.id} className="border-b border-border/60">
                  <td className="px-2 py-2">
                    {line.account.code} – {line.account.name}
                  </td>
                  <td className="px-2 py-2 text-right text-success">
                    {toNumber(line.debit) > 0 ? formatCurrency(toNumber(line.debit)) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right text-destructive">
                    {toNumber(line.credit) > 0 ? formatCurrency(toNumber(line.credit)) : "—"}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-border font-semibold">
                <td className="px-2 py-2">Total</td>
                <td className="px-2 py-2 text-right text-success">{formatCurrency(totalDebit)}</td>
                <td className="px-2 py-2 text-right text-destructive">{formatCurrency(totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ),
    },
  ];

  return (
    <DetailLayout
      breadcrumbs={["General Ledger", "Journal Entries", entry.entry_number]}
      entityId={entry.entry_number}
      title={`Journal Entry ${entry.entry_number}`}
      status={entry.is_posted ? "Posted" : "Draft"}
      subtitle={`Created on ${new Date(entry.created_at).toLocaleDateString()}`}
      data={entry}
      meta={[
        { label: "Date", value: entry.date },
        { label: "Reference", value: entry.reference_type || "—" },
        { label: "Reference ID", value: entry.reference_id || "—" },
      ]}
      summary={[
        { label: "Total Debit", value: totalDebit, isCurrency: true, tone: "info" },
        { label: "Total Credit", value: totalCredit, isCurrency: true, tone: "info" },
        { label: "Lines", value: entry.lines.length, isCurrency: false },
      ]}
      tabs={tabs}
      sidebar={
        <StandardSidebar
          metadata={[
            ["Created", new Date(entry.created_at).toLocaleString()],
            ["Created by", String(entry.created_by || "-")],
            ["Modified", new Date(entry.updated_at).toLocaleString()],
            ["Modified by", String(entry.updated_by || "-")],
          ]}
        />
      }
      // No edit or primary action for journal entries (read‑only)
      onEdit={undefined}
      onPrimaryAction={undefined}
      permissions={{ view: true }}
      currencyFormatter={formatCurrency}
    />
  );
}