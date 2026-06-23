// frontend/src/app/(app)/settings/designations/page.tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import { useDesignations, useCreateDesignation, useUpdateDesignation, useDeleteDesignation, type Designation } from "@/hooks/useDesignations";
import { useDepartmentOptions } from "@/hooks/useDepartments";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import { Switch } from "@/components/ui/switch";
import DesignationFormModal from "@/components/settings/designations/DesignationFormModal";
import { usePagination } from "@/hooks/usePagination";

export default function DesignationsPage() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const pagination = usePagination();

  const filtersWithPage = useMemo(() => ({
    page: pagination.page,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.department ? { department: filters.department } : {}),
    ...(filters.is_active ? { is_active: filters.is_active === "true" } : {}),
  }), [filters, pagination.page]);

  const { options: departmentOptions } = useDepartmentOptions();

  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
    { name: "department", label: "Department", type: "select", searchable: true, options: departmentOptions },
    { name: "is_active", label: "Status", type: "boolean" },
  ];

  const { data: designations = [], isLoading, totalCount, refetch } = useDesignations(filtersWithPage);

  const createDesignation = useCreateDesignation();
  const updateDesignation = useUpdateDesignation();
  const deleteDesignation = useDeleteDesignation();
  const permissions = useFeaturePermissions("SETTINGS", "designation");

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: permissions.export,
  };

  const handleToggleStatus = async (des: Designation, newStatus: boolean) => {
    await updateDesignation.mutateAsync({
      id: des.id,
      isActive: newStatus,           // ✅ direct field, not nested
    });
    refetch();
  };

  const columns = [
    { key: "name", label: "Designation", sortable: true },
    {
      key: "department_name",
      label: "Department",
      sortable: true,
      render: (value: string) => (
        <span className="text-muted-foreground">
          {value === "ALL" ? "All Departments" : value || "—"}
        </span>
      ),
    },

    { key: "description", label: "Description" },
    {
      key: "isActive",
      label: "Status",
      render: (value: boolean, row: Designation) => (
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <Switch
              checked={value}
              onCheckedChange={(checked) => handleToggleStatus(row, checked)}
              disabled={!permissions.update}
            />
            <span className={value ? "text-success" : "text-muted-foreground"}>
              {value ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      ),
    },
  ];

  const handleCreate = () => {
    setEditingDesignation(null);
    setModalOpen(true);
  };

  const handleEdit = (des: Designation) => {
    setEditingDesignation(des);
    setModalOpen(true);
  };

  const handleDelete = async (des: Designation) => {
    if (confirm(`Delete designation "${des.name}"?`)) {
      await deleteDesignation.mutateAsync(des.id);
      refetch();
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingDesignation(null);
  };

  const handleModalSuccess = () => {
    refetch();
    setModalOpen(false);
    setEditingDesignation(null);
  };

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Settings", "Designations"]}
        title="Designations"
        description="Manage job titles and designations across departments"
        data={designations}
        isLoading={isLoading}
        totalCount={totalCount}
        currentPage={pagination.page}
        onPageChange={pagination.setPage}
        columns={columns}
        getRowId={(des) => des.id}
        onRowClick={(des) => router.push(`/settings/designations/${des.id}`)}
        permissions={modulePermissions}
        primaryActionLabel="New Designation"
        onCreate={handleCreate}
        actions={{
          onEdit: handleEdit,
          onDelete: handleDelete,
        }}
        exportEnabled={permissions.export}
        filterBar={
          <FilterBar
            fields={filterFields}
            filters={filters}
            onChange={(f) => { setFilters(f); pagination.resetPage(); }}
          />
        }
      />
      <DesignationFormModal
        open={modalOpen}
        onClose={handleModalClose}
        initialData={editingDesignation}
        onSuccess={handleModalSuccess}
        departmentOptions={departmentOptions}
      />
    </>
  );
}