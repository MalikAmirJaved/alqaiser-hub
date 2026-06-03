"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Paperclip, FileText, Image as ImageIcon, Upload, MessageSquare, ChevronRight, ShieldAlert, ShieldCheck, Clock, CheckCircle2, XCircle, ArrowUpRight } from "lucide-react";

// ============================================
// ApprovalTimeline
// ============================================
export function ApprovalTimeline({ steps }: { steps?: { step: string; who: string; when: string; state: "done" | "current" | "todo" | "rejected"; note?: string }[] }) {
  if (!steps || steps.length === 0) return null;
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const ring =
          s.state === "done" ? "bg-success/15 text-success border-success/30"
          : s.state === "current" ? "bg-primary text-primary-foreground border-primary"
          : s.state === "rejected" ? "bg-destructive/15 text-destructive border-destructive/30"
          : "bg-surface-2 text-muted-foreground border-border";
        return (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`h-7 w-7 rounded-full border flex items-center justify-center text-xs font-semibold ${ring}`}>{i + 1}</span>
              {i < steps.length - 1 && <span className="w-px flex-1 bg-border mt-1" style={{ minHeight: 18 }} />}
            </div>
            <div className="flex-1 pb-2">
              <div className="text-sm font-medium">{s.step}</div>
              <div className="text-xs text-muted-foreground">{s.who} · {s.when}</div>
              {s.note && <div className="text-xs text-muted-foreground italic mt-0.5">{s.note}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ============================================
// ApprovalMatrix
// ============================================
export function ApprovalMatrix() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground bg-surface/40 border-b border-border">
          <tr className="text-left">
            <th className="px-4 py-2 font-medium">Threshold</th>
            <th className="px-4 py-2 font-medium">Approver</th>
            <th className="px-4 py-2 font-medium text-center">Required</th>
            <th className="px-4 py-2 font-medium text-right">SLA</th>
           </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border/60">
            <td className="px-4 py-2.5 font-medium">Tier 1 · &lt; $10,000</td>
            <td className="px-4 py-2.5 text-muted-foreground">Team Lead</td>
            <td className="px-4 py-2.5 text-center num">1</td>
            <td className="px-4 py-2.5 text-right num text-muted-foreground">4h</td>
          </tr>
          <tr className="border-b border-border/60">
            <td className="px-4 py-2.5 font-medium">Tier 2 · $10K – $50K</td>
            <td className="px-4 py-2.5 text-muted-foreground">Department Head</td>
            <td className="px-4 py-2.5 text-center num">1</td>
            <td className="px-4 py-2.5 text-right num text-muted-foreground">8h</td>
          </tr>
          <tr className="border-b border-border/60">
            <td className="px-4 py-2.5 font-medium">Tier 3 · $50K – $250K</td>
            <td className="px-4 py-2.5 text-muted-foreground">Finance Controller</td>
            <td className="px-4 py-2.5 text-center num">2</td>
            <td className="px-4 py-2.5 text-right num text-muted-foreground">24h</td>
          </tr>
          <tr className="border-b border-border/60">
            <td className="px-4 py-2.5 font-medium">Tier 4 · &gt; $250,000</td>
            <td className="px-4 py-2.5 text-muted-foreground">CFO + CEO</td>
            <td className="px-4 py-2.5 text-center num">2</td>
            <td className="px-4 py-2.5 text-right num text-muted-foreground">48h</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// AttachmentList
// ============================================
export function AttachmentList({ files, onUpload }: { files?: { name: string; size: string; kind: "pdf" | "img" | "doc"; uploaded: string; by: string; version: string }[]; onUpload?: () => void }) {
  if (!files || files.length === 0) return null;
  const IconMap: Record<string, any> = { pdf: FileText, img: ImageIcon, doc: FileText };
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-dashed border-border bg-surface/40 p-6 text-center text-sm text-muted-foreground hover:border-primary/40 cursor-pointer" onClick={onUpload}>
        <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
        <div className="mt-2 font-medium text-foreground">Drop files or click to upload</div>
        <div className="text-xs mt-1">PDF · PNG · JPG · XLSX · DOCX · up to 25 MB</div>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border">
        {files.map((f) => {
          const Icon = IconMap[f.kind] || FileText;
          return (
            <div key={f.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/40">
              <div className="h-9 w-9 rounded-md bg-surface-2 flex items-center justify-center text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{f.name}</div>
                <div className="text-xs text-muted-foreground">{f.size} · {f.uploaded} · {f.by}</div>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5 num">{f.version}</span>
              <button className="text-xs text-primary hover:underline">Preview</button>
              <button className="text-xs text-muted-foreground hover:text-foreground">Download</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// ActivityFeed
// ============================================
export function ActivityFeed({ events }: { events?: { ts: string; actor: string; text: string; tone?: "success" | "info" | "warning" | "destructive" | "muted" }[] }) {
  if (!events || events.length === 0) return null;
  const dot: Record<string, string> = {
    success: "bg-success", info: "bg-primary", warning: "bg-warning", destructive: "bg-destructive", muted: "bg-muted-foreground/50",
  };
  return (
    <ul className="space-y-2.5 text-sm">
      {events.map((e, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${dot[e.tone ?? "muted"]}`} />
          <div className="flex-1">
            <div className="text-[13px]">
              <span className="font-medium">{e.actor}</span>
              <span className="text-muted-foreground"> {e.text}</span>
            </div>
            <div className="text-[11px] text-muted-foreground num">{e.ts}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ============================================
// AuditTrail
// ============================================
export function AuditTrail({ rows }: { rows?: { ts: string; user: string; field: string; from: string; to: string }[] }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground bg-surface/40">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Timestamp</th>
            <th className="px-3 py-2 font-medium">User</th>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">From</th>
            <th className="px-3 py-2 font-medium">To</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/60">
              <td className="px-3 py-2 text-muted-foreground num">{r.ts}</td>
              <td className="px-3 py-2">{r.user}</td>
              <td className="px-3 py-2 text-primary">{r.field}</td>
              <td className="px-3 py-2 text-destructive line-through">{r.from}</td>
              <td className="px-3 py-2 text-success">{r.to}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// CommentsThread
// ============================================
export function CommentsThread({ messages, onAddComment }: { messages?: { who: string; role: string; when: string; text: string }[]; onAddComment?: (text: string) => void }) {
  if (!messages || messages.length === 0) return null;
  const [comment, setComment] = useState("");
  const handleSubmit = () => {
    if (comment.trim() && onAddComment) {
      onAddComment(comment);
      setComment("");
    }
  };
  return (
    <div className="space-y-4">
      {messages.map((m, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-9 w-9 rounded-full bg-surface-2 flex items-center justify-center text-xs font-semibold">
            {m.who.split(" ").map((s) => s[0]).join("")}
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium">{m.who}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.role}</span>
              <span className="text-xs text-muted-foreground num">{m.when}</span>
            </div>
            <div className="mt-1 rounded-lg border border-border bg-surface/40 px-3 py-2 text-sm">{m.text}</div>
          </div>
        </div>
      ))}
      <div className="rounded-lg border border-border bg-background p-3">
        <textarea
          rows={2}
          placeholder="Add a comment… use @ to mention"
          className="w-full bg-transparent text-sm outline-none resize-none"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="flex items-center justify-between mt-1">
          <button className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <Paperclip className="h-3 w-3" /> Attach
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1 text-xs font-medium inline-flex items-center gap-1"
          >
            <MessageSquare className="h-3 w-3" /> Comment
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// RelatedRecords
// ============================================
export function RelatedRecords({ items }: { items: { id: string | number; type: string; title: string; amount?: string; status?: string }[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {items.map((it) => (
        <div key={String(it.id)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/40 cursor-pointer">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground w-20 font-medium">{it.type}</div>
          <span className="font-mono text-xs text-primary w-24">{String(it.id)}</span>
          <span className="text-sm flex-1 truncate">{it.title}</span>
          {it.amount && <span className="num text-sm font-medium">{it.amount}</span>}
          {it.status && <span className="text-xs text-muted-foreground">{it.status}</span>}
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      ))}
    </div>
  );
}

// ============================================
// RiskBanner
// ============================================
export function RiskBanner({ level = "info", title, description }: { level?: "info" | "warning" | "destructive" | "success"; title: string; description?: string }) {
  const map = {
    info: { bg: "border-info/30 bg-info/10 text-info", icon: <ShieldCheck className="h-4 w-4" /> },
    warning: { bg: "border-warning/30 bg-warning/10 text-warning", icon: <ShieldAlert className="h-4 w-4" /> },
    destructive: { bg: "border-destructive/30 bg-destructive/10 text-destructive", icon: <XCircle className="h-4 w-4" /> },
    success: { bg: "border-success/30 bg-success/10 text-success", icon: <CheckCircle2 className="h-4 w-4" /> },
  };
  const cfg = map[level];
  return (
    <div className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${cfg.bg}`}>
      <div className="mt-0.5">{cfg.icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium">{title}</div>
        {description && <div className="text-xs mt-0.5 opacity-90">{description}</div>}
      </div>
    </div>
  );
}

// ============================================
// Exports
// ============================================
export { Clock, ArrowUpRight };