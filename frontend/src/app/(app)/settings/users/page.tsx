"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@/hooks/useUsers";
import PageHeader from "@/components/PageHeader";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import UserForm from "@/components/Forms/UserForm";
import { toast } from "sonner";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

export default function UsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const permissions = useFeaturePermissions("SETTINGS", "user");

  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const { data: users = [], isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  // --- Prefill data from employee page (when coming from employee "Login Access")
  const prefill = searchParams.get("prefill");
  const prefillData = useMemo(() => {
    if (!prefill) return null;
    const email = searchParams.get("email") || "";  
    console.log("reciveing the data::: ", searchParams.toString())
    return {
      username: email.split("@")[0] || "",
      email: email,
      first_name: searchParams.get("first_name") || "",
      last_name: searchParams.get("last_name") || "",
      department: searchParams.get("department_id") || "",   // department UUID
      designation: searchParams.get("designation_id") || "",
      phone_number: searchParams.get("phone_number") || "",
      password: "",      // still required, user must set password
      confirm_password: "",
      _disableUsername: true
    };
  }, [searchParams, prefill]);

  // Auto open modal when prefill is present and user has create permission
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (prefill && !hasAutoOpened.current && permissions.create) {
      hasAutoOpened.current = true;
      setEditingUser(null);      // ensure we are in create mode
      setModalOpen(true);
      // Remove query params from URL to avoid reopening on refresh
      router.replace("/settings/users", undefined);
    }
  }, [prefill, permissions.create, router]);

  const handleSave = async (userData: any) => {
    try {
      if (editingUser) {
        await updateUser.mutateAsync({ id: editingUser.id, data: userData });
        toast.success("User updated");
      } else {
        const newUser = await createUser.mutateAsync(userData);
        toast.success(
          `User created. ${prefill ? "Login access granted." : "Set permissions if needed."}`
        );
        router.push(`/settings/permissions?userId=${newUser.id}`);
      }
      setModalOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      toast.error(error.message || "Operation failed");
    }
  };

  const handleDelete = async (user: any) => {
    if (!confirm(`Delete user "${user.username}"?`)) return;
    try {
      await deleteUser.mutateAsync(user.id);
      toast.success("User deleted");
    } catch (error: any) {
      toast.error(error.message || "Delete failed");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username?.toLowerCase().includes(query.toLowerCase()) ||
      u.email?.toLowerCase().includes(query.toLowerCase()) ||
      u.first_name?.toLowerCase().includes(query.toLowerCase()) ||
      u.last_name?.toLowerCase().includes(query.toLowerCase())
  );

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
        actions={
          permissions.create && (
            <button
              onClick={() => {
                setEditingUser(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm"
            >
              <Plus className="w-4 h-4" /> Add User
            </button>
          )
        }
      />

      {/* Search */}
      <div className="bg-card border border-border rounded-2xl shadow-sm">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full bg-muted/40 pl-9 pr-3 h-9 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
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
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs">{user.username}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {user.first_name} {user.last_name}
                  </td>
                  <td className="px-4 py-2.5">{user.email}</td>
                  <td className="px-4 py-2.5">{user.department || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
                        user.is_active
                          ? "bg-success/15 text-success border-success/30"
                          : "bg-destructive/15 text-destructive border-destructive/30"
                      }`}
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {permissions.update && (
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setModalOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-muted"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {permissions.delete && (
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
      </div>

      {/* User Form Modal */}
      {(modalOpen && (editingUser ? permissions.update : permissions.create)) && (
        <UserForm
          initialData={editingUser ? editingUser : prefillData || undefined}
          onSubmit={handleSave}
          onCancel={() => {
            setModalOpen(false);
            setEditingUser(null);
          }}
          isLoading={createUser.isPending || updateUser.isPending}
        />
      )}
    </div>
  );
}