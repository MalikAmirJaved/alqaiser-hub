"use client";

import { useState } from "react";
import { DynamicModulePage, type ModulePermissions } from "@/components/reuseable/final/DynamicModulePage";
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  type Department,
} from "@/hooks/useDepartments";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import DepartmentFormModal from "@/components/settings/departments/DepartmentFormModal";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "next/navigation";

export default function DepartmentsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

  const { data: departments = [], isLoading, refetch } = useDepartments();
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const permissions = useFeaturePermissions("SETTINGS", "department");
  const router = useRouter();

  const modulePermissions: ModulePermissions = {
    create: permissions.create,
    update: permissions.update,
    delete: permissions.delete,
    view: permissions.view,
    export: true,
  };

  const handleToggleStatus = async (dept: Department, newStatus: boolean) => {
    await updateDepartment.mutateAsync({
      id: dept.id,
      data: { is_active: newStatus },
    });
    refetch();
  };

  const columns = [
    { key: "code", label: "Code", sortable: true },
    { key: "name", label: "Name", sortable: true },
    { key: "description", label: "Description" },
    {
      key: "is_active",
      label: "Status",
      render: (value: boolean, row: Department) => (
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
      ),
    },
  ];

  const handleCreate = () => {
    setEditingDepartment(null);
    setModalOpen(true);
  };

  const handleEdit = (dept: Department) => {
    setEditingDepartment(dept);
    setModalOpen(true);
  };

  const handleDelete = async (dept: Department) => {
    if (confirm(`Delete department "${dept.name}"?`)) {
      await deleteDepartment.mutateAsync(dept.id);
      refetch();
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingDepartment(null);
  };

  const handleModalSuccess = () => {
    refetch();
    setModalOpen(false);
    setEditingDepartment(null);
  };

  return (
    <>
      <DynamicModulePage
        breadcrumbs={["Settings", "Departments"]}
        title="Departments"
        description="Manage company departments (HR, Inventory, Finance, etc.)"
        data={departments}
        isLoading={isLoading}
        columns={columns}
        getRowId={(dept) => dept.id}
        onRowClick={(dept) => router.push(`/settings/departments/${dept.id}`)}
        permissions={modulePermissions}
        primaryActionLabel="New Department"
        onCreate={handleCreate}
        actions={{
          onEdit: handleEdit,
          onDelete: handleDelete,
        }}
        exportEnabled
      />
      <DepartmentFormModal
        open={modalOpen}
        onClose={handleModalClose}
        initialData={editingDepartment}
        onSuccess={handleModalSuccess}
      />
    </>
  );
}