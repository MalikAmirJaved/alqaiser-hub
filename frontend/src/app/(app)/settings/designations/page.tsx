// src/app/(dashboard)/designations/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useDesignations, useCreateDesignation, useUpdateDesignation, useDeleteDesignation } from "@/hooks/useDesignations";
import DataTable from "@/components/reuseable/DataTable";
import PageHeader from "@/components/PageHeader";
import FormModal from "@/components/reuseable/FormModal";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Briefcase, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { DEPARTMENT_CHOICES } from "@/lib/departments";

export default function DesignationsPage() {
  const { user } = useAuth();
  const { data: designations = [], isLoading, error } = useDesignations();
  const createDesignation = useCreateDesignation();
  const updateDesignation = useUpdateDesignation();
  const deleteDesignation = useDeleteDesignation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    department: "",
    payGrade: "",
    description: "",
    isActive: true,
  });

  const handleCreate = () => {
    setFormData({
      name: "",
      department: "",
      payGrade: "",
      description: "",
      isActive: true,
    });
    setEditingDesignation(null);
    setModalOpen(true);
  };

  const handleEdit = (row: any) => {
    setFormData({
      name: row.name || "",
      department: row.department || "",
      payGrade: row.payGrade || "",
      description: row.description || "",
      isActive: row.isActive ?? true,
    });
    setEditingDesignation(row);
    setModalOpen(true);
  };

  const handleDelete = async (row: any) => {
    if (!confirm(`Are you sure you want to delete "${row.name}"?`)) return;
    try {
      await deleteDesignation.mutateAsync(row.id);
    } catch (error) {
      console.error("Failed to delete designation:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert("Designation name is required");
      return;
    }

    try {
      if (editingDesignation) {
        await updateDesignation.mutateAsync({
          id: editingDesignation.id,
          ...formData,
        });
      } else {
        await createDesignation.mutateAsync(formData);
      }
      setModalOpen(false);
    } catch (error) {
      console.error("Failed to save designation:", error);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Designation",
      sortable: true,
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-primary" />
          </div>
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: "department",
      label: "Department",
      sortable: true,
      render: (value: string) => (
        <span className="text-muted-foreground">{value || "—"}</span>
      ),
    },
    {
      key: "payGrade",
      label: "Pay Grade",
      sortable: true,
      render: (value: string) => (
        <span className="text-muted-foreground">{value || "—"}</span>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (value: string) => (
        <span className="text-sm text-muted-foreground line-clamp-1">
          {value || "—"}
        </span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      badge: true,
      render: (value: boolean) => (
        <Badge
          variant={value ? "default" : "destructive"}
          className="text-xs"
        >
          {value ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Designations"
        subtitle="Manage job titles and designations"
        actions={
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Add Designation
            </Button>
          
        }
      />

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Total Designations</div>
          <div className="text-2xl font-semibold">{designations.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Active</div>
          <div className="text-2xl font-semibold text-success">
            {designations.filter(d => d.isActive).length}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Inactive</div>
          <div className="text-2xl font-semibold text-destructive">
            {designations.filter(d => !d.isActive).length}
          </div>
        </div>
      </div>

      <DataTable
        data={designations}
        columns={columns}
        title="All Designations"
        subtitle={`${designations.length} designation${designations.length !== 1 ? "s" : ""} found`}
        searchable
        searchFields={["name", "department", "payGrade"]}
        onEdit={(row) =>  handleEdit(row)}
        onDelete={(row) => handleDelete(row)}
        defaultPageSize={10}
      />

      {/* Create/Edit Modal */}
      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDesignation ? "Edit Designation" : "Create Designation"}
        onSubmit={handleSubmit}
        loading={createDesignation.isPending || updateDesignation.isPending}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Designation Name */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-muted/40 focus:border-primary outline-none"
              placeholder="e.g., Software Engineer"
              required
            />
          </div>

          {/* Department */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Department
            </label>
            <select
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-muted/40 focus:border-primary outline-none"
            >
              <option value="">Select Department</option>
              {DEPARTMENT_CHOICES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Pay Grade */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Pay Grade
            </label>
            <input
              type="text"
              value={formData.payGrade}
              onChange={(e) => setFormData({ ...formData, payGrade: e.target.value })}
              className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-muted/40 focus:border-primary outline-none"
              placeholder="e.g., Grade 5, Level 3"
            />
          </div>

          {/* Active Status */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Status
            </label>
            <select
              value={formData.isActive ? "true" : "false"}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.value === "true" })}
              className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-muted/40 focus:border-primary outline-none"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-muted-foreground">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-muted/40 focus:border-primary outline-none resize-none"
              placeholder="Brief description of this designation..."
            />
          </div>
        </div>
      </FormModal>
    </div>
  );
}