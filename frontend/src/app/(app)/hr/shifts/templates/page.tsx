// src/app/(dashboard)/hr/shift-templates/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useShiftTemplates, useCreateShiftTemplate, useUpdateShiftTemplate, useDeleteShiftTemplate } from "@/hooks/useShiftTemplates";
import PageHeader from "@/components/PageHeader";
import { Plus, Clock, Edit, Trash2, Search, Palette, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { permissionService } from "@/services/permissionService";
import { useAuth } from "@/hooks/useAuth";

export default function ShiftTemplatesPage() {
  const { user } = useAuth();
  const { data: templates = [], isLoading } = useShiftTemplates();
  const createTemplate = useCreateShiftTemplate();
  const updateTemplate = useUpdateShiftTemplate();
  const deleteTemplate = useDeleteShiftTemplate();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 60,
    description: "",
    is_active: true,
  });

  const [permissions, setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    loading: true,
  });

  useEffect(() => {
    permissionService.init();
    setPermissions({
      canCreate: permissionService.hasPermission("HR", "Shift Management", "create"),
      canUpdate: permissionService.hasPermission("HR", "Shift Management", "update"),
      canDelete: permissionService.hasPermission("HR", "Shift Management", "delete"),
      loading: false,
    });
  }, []);

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

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

  if (permissions.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading permissions...</p>
        </div>
      </div>
    );
  }

  if (!permissions.canCreate && !permissions.canUpdate && !permissions.canDelete && user?.role !== "COMPANY_ADMIN") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/15 flex items-center justify-center">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            You don't have permission to access shift templates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Shift Templates"
        subtitle="Define reusable shift patterns & working hours"
        actions={
          (permissions.canCreate || user?.role === "COMPANY_ADMIN") && (
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
          )
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((t) => (
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
              {(permissions.canUpdate || user?.role === "COMPANY_ADMIN") && (
                <Button variant="ghost" size="sm" onClick={() => handleEdit(t)}>
                  <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
              )}
              {(permissions.canDelete || user?.role === "COMPANY_ADMIN") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(t)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

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