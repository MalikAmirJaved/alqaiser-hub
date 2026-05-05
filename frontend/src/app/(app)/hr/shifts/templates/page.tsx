"use client";
import { useState, useEffect } from "react";
import { ls, uid } from "@/services/localStorageService";
import PageHeader from "@/components/PageHeader";
import { Plus, Clock, Edit, Trash2, Search, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { ShiftTemplate } from "@/lib/shiftResolver";

export default function ShiftTemplatesPage() {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftTemplate | null>(null);
  const [formData, setFormData] = useState<Partial<ShiftTemplate>>({
    name: "", startTime: "09:00", endTime: "17:00", breakMinutes: 60, color: "#3b82f6", description: "", is_active: true
  });

  useEffect(() => setTemplates(ls.get<any[]>("shifts_templates", [])), []);

  const filtered = templates.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  const handleSave = () => {
    if (!formData.name || !formData.startTime || !formData.endTime) return alert("Required fields missing");
    const template: ShiftTemplate = {
      id: editing?.id || uid("shift"),
      name: formData.name!,
      startTime: formData.startTime!,
      endTime: formData.endTime!,
      breakMinutes: formData.breakMinutes || 0,
      color: formData.color || "#3b82f6",
      description: formData.description || "",
      is_active: formData.is_active !== false,
    };
    const updated = editing ? templates.map((t) => (t.id === editing.id ? template : t)) : [template, ...templates];
    setTemplates(updated);
    ls.set("shifts_templates", updated);
    setModalOpen(false);
    setEditing(null);
  };

  return (
    <div>
      <PageHeader title="Shift Templates" subtitle="Define reusable shift patterns & working hours" actions={
        <Button onClick={() => { setEditing(null); setFormData({ name: "", startTime: "09:00", endTime: "17:00", breakMinutes: 60, color: "#3b82f6", description: "", is_active: true }); setModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Template
        </Button>
      } />

      <div className="mb-4 relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((t) => (
          <div key={t.id} className="group bg-card border border-border rounded-2xl p-5 hover:shadow-lg transition-all relative">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl grid place-items-center text-white font-bold shadow-inner" style={{ backgroundColor: t.color }}>{t.name.charAt(0)}</div>
                <div>
                  <h3 className="font-semibold text-lg">{t.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Clock className="w-3 h-3" /> {t.startTime} - {t.endTime} • {t.breakMinutes}m break
                  </div>
                </div>
              </div>
              <div className={`px-2 py-0.5 rounded-full text-[10px] ${t.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{t.is_active ? "Active" : "Inactive"}</div>
            </div>
            {t.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{t.description}</p>}
            <div className="flex gap-2 pt-3 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(t); setFormData(t); setModalOpen(true); }}><Edit className="w-3.5 h-3.5 mr-1"/> Edit</Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { if(confirm("Delete template?")) { const u = templates.filter(x => x.id !== t.id); setTemplates(u); ls.set("shifts_templates", u); } }}><Trash2 className="w-3.5 h-3.5 mr-1"/> Delete</Button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-lg">
            <div className="p-4 border-b border-border"><h2 className="font-semibold">{editing ? "Edit Template" : "Create Template"}</h2></div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm flex flex-col gap-1"><span className="text-muted-foreground">Template Name</span><input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring" /></label>
              <label className="text-sm flex flex-col gap-1"><span className="text-muted-foreground">Start Time</span><input type="time" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} className="bg-muted/40 border border-border rounded-md h-9 px-3" /></label>
              <label className="text-sm flex flex-col gap-1"><span className="text-muted-foreground">End Time</span><input type="time" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} className="bg-muted/40 border border-border rounded-md h-9 px-3" /></label>
              <label className="text-sm flex flex-col gap-1"><span className="text-muted-foreground">Break (mins)</span><input type="number" value={formData.breakMinutes} onChange={(e) => setFormData({...formData, breakMinutes: Number(e.target.value)})} className="bg-muted/40 border border-border rounded-md h-9 px-3" /></label>
              <label className="text-sm flex flex-col gap-1"><span className="text-muted-foreground">Accent Color</span><div className="flex items-center gap-2"><input type="color" value={formData.color} onChange={(e) => setFormData({...formData, color: e.target.value})} className="w-9 h-9 p-1 rounded border border-border cursor-pointer" /><Palette className="w-4 h-4 text-muted-foreground"/></div></label>
              <label className="col-span-2 text-sm flex flex-col gap-1"><span className="text-muted-foreground">Status</span><SearchableSelect value={formData.is_active ? "true" : "false"} onChange={(val) => setFormData({...formData, is_active: val === "true"})} options={[{value:"true",label:"Active"},{value:"false",label:"Inactive"}]} /></label>
              <label className="col-span-2 text-sm flex flex-col gap-1"><span className="text-muted-foreground">Description</span><textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={2} className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring resize-none" /></label>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save Template</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}