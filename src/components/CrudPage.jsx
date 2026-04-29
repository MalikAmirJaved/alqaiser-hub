import { useEffect, useMemo, useState } from "react";
import { ls, uid } from "../services/localStorageService";
import { Plus, Pencil, Trash2, Search, Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import PageHeader from "./PageHeader";

/**
 * Generic CRUD page. Configure with:
 * storeKey: localStorage key
 * title, subtitle
 * fields: [{ key, label, type: 'text'|'number'|'date'|'select'|'textarea', options?, required? }]
 * columns: array of field keys to show in table (defaults to all)
 * idPrefix: prefix for new ids
 * statusField (optional): field name used for color-coded badge
 */
export default function CrudPage({
  storeKey,
  title,
  subtitle,
  fields,
  columns,
  idPrefix = "row",
  statusField,
  hideAddbtn = false
}) {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const cols = columns && columns.length ? columns : fields.map((f) => f.key);

  useEffect(() => {
    setRows(ls.get(storeKey, []) || []);
  }, [storeKey]);

  const persist = (next) => {
    setRows(next);
    ls.set(storeKey, next);
  };

  const openAdd = () => {
    const blank = {};
    fields.forEach((f) => (blank[f.key] = f.type === "number" ? 0 : ""));
    setForm(blank);
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (row) => {
    setForm({ ...row });
    setEditing(row.id);
    setModalOpen(true);
  };
  const handleDelete = (id) => {
    if (!confirm("Delete this record?")) return;
    persist(rows.filter((r) => r.id !== id));
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    for (const f of fields) {
      if (f.required && (form[f.key] === "" || form[f.key] == null)) {
        alert(`${f.label} is required`);
        return;
      }
    }
    if (editing) {
      persist(rows.map((r) => (r.id === editing ? { ...r, ...form } : r)));
    } else {
      persist([{ id: uid(idPrefix), ...form }, ...rows]);
    }
    setModalOpen(false);
  };

  const filtered = useMemo(() => {
    let out = rows;
    if (query) {
      const q = query.toLowerCase();
      out = out.filter((r) =>
        cols.some((c) => String(r[c] ?? "").toLowerCase().includes(q))
      );
    }
    if (sortKey) {
      out = [...out].sort((a, b) => {
        const va = a[sortKey], vb = b[sortKey];
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
        return sortDir === "asc"
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va));
      });
    }
    return out;
  }, [rows, query, sortKey, sortDir, cols]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportCsv = () => {
    const header = cols.join(",");
    const lines = filtered.map((r) =>
      cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${storeKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortBy = (k) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const fieldLabel = (k) => fields.find((f) => f.key === k)?.label || k;
  const isStatus = (k) => statusField && k === statusField;
  const badgeFor = (val) => {
    const v = String(val).toLowerCase();
    if (["active", "paid", "approved", "completed", "received", "present", "excellent"].some((x) => v.includes(x)))
      return "bg-success/15 text-success border-success/30";
    if (["pending", "low", "in progress", "interview"].some((x) => v.includes(x)))
      return "bg-warning/15 text-warning border-warning/30";
    if (["absent", "rejected", "cancelled", "high", "overdue", "resigned"].some((x) => v.includes(x)))
      return "bg-destructive/15 text-destructive border-destructive/30";
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <button onClick={exportCsv} className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border text-sm hover:bg-muted">
              <Download className="w-4 h-4" /> Export
            </button>
            {!hideAddbtn && (
            <button onClick={openAdd} className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
              <Plus className="w-4 h-4" /> Add new
            </button>
            )}
          </>
        }
      />

      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Total Records</div>
          <div className="text-xl font-semibold">{rows.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Filtered</div>
          <div className="text-xl font-semibold">{filtered.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Module</div>
          <div className="text-xl font-semibold capitalize">{storeKey}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm">
        <div className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 border-b border-border">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search..."
              className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Page {page} / {totalPages}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {cols.map((c) => (
                  <th
                    key={c}
                    className="text-left px-4 py-2.5 cursor-pointer select-none"
                    onClick={() => sortBy(c)}
                  >
                    {fieldLabel(c)}
                    {sortKey === c && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={cols.length + 1} className="text-center py-10 text-muted-foreground">
                    No records found.
                  </td>
                </tr>
              )}
              {pageRows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  {cols.map((c) => (
                    <td key={c} className="px-4 py-2.5">
                      {isStatus(c) ? (
                        <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-full border ${badgeFor(r[c])}`}>
                          {String(r[c] ?? "—")}
                        </span>
                      ) : (
                        <span>{String(r[c] ?? "—")}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(r)} className="p-1.5 rounded-md hover:bg-muted" aria-label="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive" aria-label="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 flex items-center justify-between border-t border-border">
          <div className="text-xs text-muted-foreground">{filtered.length} records</div>
          <div className="flex items-center gap-1">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4" >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-semibold">{editing ? "Edit record" : "Add new record"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1.5 rounded-md hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 grid sm:grid-cols-2 gap-3">
              {fields.map((f) => (
                <label key={f.key} className={`text-sm flex flex-col gap-1 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
                  <span className="text-muted-foreground">
                    {f.label} {f.required && <span className="text-destructive">*</span>}
                  </span>
                  {f.type === "select" ? (
                    <select
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">— Select —</option>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      rows={3}
                      className="bg-muted/40 border border-border rounded-md p-2 outline-none focus:ring-2 focus:ring-ring"
                    />
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })}
                      className="bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring"
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted">
                Cancel
              </button>
              <button type="submit" className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
                {editing ? "Save changes" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
