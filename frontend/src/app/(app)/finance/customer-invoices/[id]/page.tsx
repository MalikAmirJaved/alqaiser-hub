"use client";

import { DetailLayout, StandardSidebar } from "@/components/reuseable/final/DetailLayout";
import { AttachmentList, AuditTrail, CommentsThread, RelatedRecords, ApprovalTimeline, RiskBanner } from "@/components/reuseable/final/workflow";
import { fmtCurrency } from "@/staticdata/finance-data";
import { useParams } from "next/navigation";

export default function InvoiceDetail() {
  const id = useParams().id as string;

  return (
    <DetailLayout
      breadcrumbs={["Receivables", "Customer Invoices", id]}
      entityId={id}
      title="Acme Corp — Q2 Consulting"
      status="Partial"
      subtitle="Issued Jun 2, 2026 · Net 30 · USD"
      meta={[
        { label: "Customer", value: "Acme Corp" }, { label: "PO", value: "PO-9821" },
        { label: "Sales Rep", value: "K. Nakamura" }, { label: "Project", value: "SO-8821" },
      ]}
      summary={[
        { label: "Invoice Total", value: fmtCurrency(86_832) },
        { label: "Paid", value: fmtCurrency(34_992), tone: "success", sub: "PAY-7822 · Jun 5" },
        { label: "Outstanding", value: fmtCurrency(51_840), tone: "warning" },
        { label: "Days to Due", value: "12d", sub: "Due Jul 2" },
      ]}
      primaryAction="Record Payment"
      tabs={[
        { id: "overview", label: "Overview", render: () => (
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ["Subtotal", fmtCurrency(80_400)], ["Tax (8%)", fmtCurrency(6_432)],
              ["Discount", fmtCurrency(0)], ["Grand Total", fmtCurrency(86_832)],
              ["Currency", "USD"], ["Posted GL", "1120 / 4000"],
            ].map(([l, v]) => (
              <div key={l as string} className="flex items-center justify-between border-b border-border/60 pb-2"><span className="text-muted-foreground">{l}</span><span className="num font-medium">{v}</span></div>
            ))}
          </div>
        )},
        { id: "items", label: "Line Items", count: 2, render: () => (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr className="text-left"><th className="py-2">SKU</th><th>Description</th><th className="text-right">Qty</th><th className="text-right">Unit</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {[
                  ["SVC-CONSULT","Q2 consulting retainer",1,48_000,51_840],
                  ["SVC-IMPL","Implementation milestone 3",1,32_400,34_992],
                ].map((r,i)=>(
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-2 font-mono text-xs text-primary">{r[0]}</td>
                    <td>{r[1]}</td>
                    <td className="text-right num">{r[2]}</td>
                    <td className="text-right num">{fmtCurrency(r[3] as number)}</td>
                    <td className="text-right num font-medium">{fmtCurrency(r[4] as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )},
        { id: "allocations", label: "Payment Allocation", render: () => (
          <div className="space-y-3">
            <RiskBanner level="warning" title="Partially allocated" description="$51,840 remains. Apply additional payment or credit note." />
            <RelatedRecords items={[
              { id: "PAY-7822", type: "Payment", title: "Wire receipt — Acme", amount: fmtCurrency(34_992), status: "Cleared" },
            ]} />
            <button className="text-xs text-primary hover:underline">+ Apply existing credit · CR-0312 ($12,400)</button>
          </div>
        )},
        { id: "approval", label: "Approvals", render: () => <ApprovalTimeline /> },
        { id: "related", label: "Related", count: 4, render: () => (
          <RelatedRecords items={[
            { id: "SO-8821", type: "Sales Order", title: "Acme Corp — Project Alpha", amount: fmtCurrency(120_000), status: "Active" },
            { id: "JE-10428", type: "Journal", title: "Auto-posting INV-5821", status: "Posted" },
            { id: "CR-0312", type: "Credit Note", title: "Goodwill adjustment", amount: fmtCurrency(12_400), status: "Open" },
            { id: "CUST-001", type: "Customer", title: "Acme Corp", status: "Active" },
          ]} />
        )},
        { id: "attach", label: "Attachments", count: 3, render: () => <AttachmentList /> },
        { id: "audit", label: "Audit Trail", render: () => <AuditTrail /> },
        { id: "comments", label: "Comments", count: 2, render: () => <CommentsThread /> },
      ]}
      sidebar={<StandardSidebar />}
    />
  );
}
