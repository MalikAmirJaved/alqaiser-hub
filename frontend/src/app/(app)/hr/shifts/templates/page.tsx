// src/app/(dashboard)/hr/shift-templates/page.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import { useShiftTemplatesPaginated, useCreateShiftTemplate, useUpdateShiftTemplate, useDeleteShiftTemplate } from "@/hooks/useShiftTemplates";
import PageHeader from "@/components/PageHeader";
import { Plus, Clock, Edit, Trash2, Search, Palette, Shield, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { useAuth } from "@/hooks/useAuth";

export default function ShiftTemplatesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const apiParams = useMemo(() => ({
    ...(search ? { search } : {}),
    page: String(page),
    page_size: String(pageSize),
  }), [search, page, pageSize]);

  const { data: templates = [], totalCount, totalPages, currentPage, isLoading } = useShiftTemplatesPaginated(apiParams);
  const createTemplate = useCreateShiftTemplate();
  const updateTemplate = useUpdateShiftTemplate();
  const deleteTemplate = useDeleteShiftTemplate();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => { setPage(1); }, [search]);
  const [formData, setFormData] = useState({
    name: "",
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 60,
    description: "",
    is_active: true,
  });

  const handleSave = async () => {
    if (!formData.name || !formData.startTime || !formData.endTime) {
      alert("Required fields missing");
      return;
    }

    try {
      if (editing) {
        await updateTemplate.mutateAsync({
          id: editing.id,
          ...formData,
        });
      } else {
        await createTemplate.mutateAsync(formData);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (error) {
      console.error("Failed to save template:", error);
    }
  };

  const handleEdit = (template: any) => {
    setEditing(template);
    setFormData({
      name: template.name,
      startTime: template.startTime,
      endTime: template.endTime,
      breakMinutes: template.breakMinutes,
      description: template.description || "",
      is_active: template.is_active,
    });
    setModalOpen(true);
  };

  const handleDelete = async (template: any) => {
    if (!confirm(`Delete template "${template.name}"?`)) return;
    try {
      await deleteTemplate.mutateAsync(template.id);
    } catch (error) {
      console.error("Failed to delete template:", error);
    }
  };

  return (
    <div>
      <PageHeader
        title="Shift Templates"
        subtitle="Define reusable shift patterns & working hours"
        actions={
            <Button
              onClick={() => {
                setEditing(null);
                setFormData({
                  name: "",
                  startTime: "09:00",
                  endTime: "17:00",
                  breakMinutes: 60,
                  description: "",
                  is_active: true,
                });
                setModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> New Template
            </Button>
          
        }
      />

      <div className="mb-4 relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2 pt-3 border-t border-border">
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div
            key={t.id}
            className="group bg-card border border-border rounded-2xl p-5 hover:shadow-lg transition-all relative"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl grid place-items-center font-bold shadow-inner"
                >
                  {t.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{t.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Clock className="w-3 h-3" /> {t.startTime} - {t.endTime} • {t.breakMinutes}m break
                  </div>
                  {t.workingHours && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t.workingHours} working hours
                    </div>
                  )}
                </div>
              </div>
              <div
                className={`px-2 py-0.5 rounded-full text-[10px] ${
                  t.is_active
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {t.is_active ? "Active" : "Inactive"}
              </div>
            </div>
            {t.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{t.description}</p>
            )}
            <div className="flex gap-2 pt-3 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(t)}>
                  <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(t)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </Button>
              
            </div>
          </div>
        ))}
      </div>
      )}

      {!isLoading && templates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No templates found</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
          <span>
            {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalCount)} of {totalCount}
          </span>
          <div className="flex items-center gap-2">
            <span>Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={currentPage >= totalPages}
              className="p-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-lg">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold">{editing ? "Edit Template" : "Create Template"}</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Template Name *</span>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-muted/40 border border-border rounded-md h-9 px-3 outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g., Morning Shift"
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Start Time *</span>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="bg-muted/40 border border-border rounded-md h-9 px-3"
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">End Time *</span>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="bg-muted/40 border border-border rounded-md h-9 px-3"
                />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Break (mins)</span>
                <input
                  type="number"
                  value={formData.breakMinutes}
                  onChange={(e) => setFormData({ ...formData, breakMinutes: Number(e.target.value) })}
                  className="bg-muted/40 border border-border rounded-md h-9 px-3"
                  min="0"
                />
              </label>
              <label className="col-span-2 text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Status</span>
                <SearchableSelect
                  value={formData.is_active ? "true" : "false"}
                  onChange={(val) => setFormData({ ...formData, is_active: val === "true" })}
                  options={[
                    { value: "true", label: "Active" },
                    { value: "false", label: "Inactive" },
                  ]}
                />
              </label>
              <label className="col-span-2 text-sm flex flex-col gap-1">
                <span className="text-muted-foreground">Description</span>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="bg-muted/40 border border-border rounded-md p-3 outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Brief description of this shift..."
                />
              </label>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending}>
                {createTemplate.isPending || updateTemplate.isPending ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}