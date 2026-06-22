"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@/hooks/useUsers";
import PageHeader from "@/components/PageHeader";
import FilterBar from "@/components/reuseable/FilterBar";
import type { FilterField } from "@/components/reuseable/FilterBar";
import { Plus, Pencil, Trash2, UserPlus, ToggleRight } from "lucide-react";
import UserForm from "@/components/Forms/UserForm";
import UserStatusModal from "@/components/UserStatusModal";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useAuth } from "@/hooks/useAuth";

export default function UsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const permissions = useFeaturePermissions("SETTINGS", "user");
  const { user: currentUser } = useAuth();
  const isCompanyAdmin = currentUser?.role === "COMPANY_ADMIN";

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [modalOpen, setModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedUserForStatus, setSelectedUserForStatus] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [storedPrefill, setStoredPrefill] = useState<any>(null);

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  // --- Prefill data from employee page (when coming from employee "Login Access")
  const prefill = searchParams.get("prefill");
  const prefillData = useMemo(() => {
    if (!prefill) return null;
    const email = searchParams.get("email") || "";
    return {
      username: email.split("@")[0] || "",
      email: email,
      first_name: searchParams.get("first_name") || "",
      last_name: searchParams.get("last_name") || "",
      department: searchParams.get("department_id") || searchParams.get("department") || "",
      designation: searchParams.get("designation_id") || searchParams.get("designation") || "",
      phone_number: searchParams.get("phone_number") || "",
      isfrom_employee_id: searchParams.get("isfrom_employee_id") || null,
      password: "",
      confirm_password: "",
    };
  }, [searchParams, prefill]);

  // Auto‑open modal when prefill is present and user has create permission
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (prefill && !hasAutoOpened.current && permissions.create) {
      hasAutoOpened.current = true;
      setStoredPrefill(prefillData);
      setEditingUser(null);
      setModalOpen(true);
      router.replace("/settings/users", undefined);
    }
  }, [prefill, permissions.create, router, prefillData]);

  const handleSave = async (userData: any) => {
    try {
      if (editingUser) {
        if (editingUser.role === "COMPANY_ADMIN" && !isCompanyAdmin) return;
        await updateUser.mutateAsync({ id: editingUser.id, data: userData });
      } else {
        const payload = { ...userData };
        if (storedPrefill?.isfrom_employee_id) {
          payload.isfrom_employee_id = storedPrefill.isfrom_employee_id;
        }
        const newUser = await createUser.mutateAsync(payload);
          router.push(`/settings/permissions?userId=${newUser.id}`);
        
      }
      setModalOpen(false);
      setEditingUser(null);
      setStoredPrefill(null);
    } catch (error: any) {
    }
  };

  const handleDelete = async (user: any) => {
    if (user.role === "COMPANY_ADMIN") return;
    if (!confirm(`Delete user "${user.username}"?`)) return;
    try {
      await deleteUser.mutateAsync(user.id);
    } catch (error: any) {
    }
  };

  const openStatusModal = (user: any) => {
    setSelectedUserForStatus(user);
    setStatusModalOpen(true);
  };

  const handleStatusChange = async (isActive: boolean) => {
    try {
      if (selectedUserForStatus?.role === "COMPANY_ADMIN" && !isCompanyAdmin) return;
      await updateUser.mutateAsync({
        id: selectedUserForStatus.id,
        data: { is_active: isActive },
      });
    } catch (error: any) {
      throw error;
    }
  };

  const { data: users = [], isLoading } = useUsers(
    Object.keys(filters).length > 0 ? filters : undefined
  );

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filters]);

  // Only is_active is client-side (backend doesn't support server-side status filter for users)
  const isActiveFilter = filters.is_active;
  const filteredUsers = users.filter((u) => {
    // Hide company_admin users from non-company_admin viewers
    if (!isCompanyAdmin && u.role === "COMPANY_ADMIN") return false;
    if (isActiveFilter === "true" && !u.is_active) return false;
    if (isActiveFilter === "false" && u.is_active) return false;
    return true;
  });

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);
  const filterFields: FilterField[] = [
    { name: "search", label: "Search", type: "search" },
    { name: "is_active", label: "Status", type: "boolean" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        subtitle="Manage system users"
        // actions={
        //   permissions.create && (
        //     <button
        //       onClick={() => {
        //         setEditingUser(null);
        //         setStoredPrefill(null);
        //         setModalOpen(true);
        //       }}
        //       className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm"
        //     >
        //       <Plus className="w-4 h-4" /> Add User
        //     </button>
        //   )
        // }
      />

      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl shadow-sm">
        <div className="p-3 border-b border-border">
          <FilterBar
            fields={filterFields}
            filters={filters}
            onChange={setFilters}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Username</th>
                <th className="text-left px-4 py-2.5">Full Name</th>
                <th className="text-left px-4 py-2.5">Email</th>
                <th className="text-left px-4 py-2.5">Department</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
              {paginatedUsers.map((user) => (
                <tr key={user.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs">{user.username}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {user.first_name} {user.last_name}
                  </td>
                  <td className="px-4 py-2.5">{user.email}</td>
                  <td className="px-4 py-2.5">{user.department_name || user.department || "—"}</td>
                  <td className="px-4 py-2.5">
                   <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (permissions.update && (isCompanyAdmin || user.role !== "COMPANY_ADMIN")) {
                          openStatusModal(user);
                        }
                      }}
                      className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${
                        user.is_active
                          ? "bg-success/15 text-success border-success/30"
                          : "bg-destructive/15 text-destructive border-destructive/30"
                      }`}
                      title={permissions.update && (isCompanyAdmin || user.role !== "COMPANY_ADMIN") ? "Click to change status" : "No permission to change status"}
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {permissions.update && (isCompanyAdmin || user.role !== "COMPANY_ADMIN") && (
                      <button
                       onClick={() => openStatusModal(user)}
                       className="p-1.5 rounded-md hover:bg-blue-100 text-blue-600 transition-colors"
                       title="Change User Status"
                       aria-label="Change Status"
                      >
                        <ToggleRight className="w-4 h-4" />
                      </button>
                   )}

                   {permissions.update && (isCompanyAdmin || user.role !== "COMPANY_ADMIN") && (
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setStoredPrefill(null);
                          setModalOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-muted"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                   )}

                   {/* Go to Employee: hidden if user already linked to an employee */}
                   {permissions.create && !user.isfrom_employee_id && user.role !== "COMPANY_ADMIN" && (
                     <button
                       onClick={() => {
                         const params = new URLSearchParams({
                           prefill: "true",
                           first_name: user.first_name || "",
                           last_name: user.last_name || "",
                           email: user.email || "",
                           phone: user.phone_number || "",
                           department_id: user.department_id || user.department || "",
                           designation_id: user.designation_id || user.designation || "",
                           isfrom_user_id: user._id || "",
                         });
                         router.push(`/hr/employees?${params.toString()}`);
                       }}
                       className="p-1.5 rounded-md hover:bg-primary/15 text-primary transition-colors"
                       title="Create Employee from User"
                     >
                       <UserPlus className="w-4 h-4" />
                     </button>
                   )}

                   {permissions.delete && user.role !== "COMPANY_ADMIN" && (
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                   )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
            <span>
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredUsers.length)} of {filteredUsers.length}
            </span>
            <div className="flex items-center gap-2">
              <span>Page {safePage} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-2.5 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={safePage >= totalPages}
                className="px-2.5 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Form Modal */}
      {(modalOpen && (editingUser ? permissions.update : permissions.create)) && (
        <UserForm
          initialData={editingUser ? editingUser : storedPrefill || undefined}
          onSubmit={handleSave}
          onCancel={() => {
            setModalOpen(false);
            setEditingUser(null);
            setStoredPrefill(null);
          }}
          isLoading={createUser.isPending || updateUser.isPending}
        />
      )}

      {/* User Status Modal */}
      {selectedUserForStatus && (
        <UserStatusModal
          open={statusModalOpen}
          onOpenChange={setStatusModalOpen}
          user={selectedUserForStatus}
          onSubmit={handleStatusChange}
          onSuccess={() => {
            setSelectedUserForStatus(null);
          }}
        />
      )}
    </div>
  );
}