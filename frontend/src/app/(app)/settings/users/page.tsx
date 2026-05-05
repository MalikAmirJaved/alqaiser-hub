

"use client";

// ============================================
// FILE: src/routes/_app.settings.users.jsx (UPDATED)
// ============================================

import { useState, useEffect } from "react";
import { ls, uid } from "@/services/localStorageService";
import PageHeader from "@/components/PageHeader";
import { Plus, Pencil, Trash2, Search, Download } from "lucide-react";
import UserFormWithPermissions from "@/components/Forms/UserForm";

export default UsersPage;

function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [departments] = useState(["HR", "INVENTORY", "FINANCE", "SETTINGS"]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setUsers(ls.get<any[]>("users", []));
    setPermissions(ls.get<any[]>("permissions", []));
  };

  const filteredUsers = users.filter(u =>
    u.username?.toLowerCase().includes(query.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(query.toLowerCase()) ||
    u.email?.toLowerCase().includes(query.toLowerCase()) ||
    u.role?.toLowerCase().includes(query.toLowerCase())
  );

  const handleSaveUser = (userData, userPermissions) => {
    let updatedUsers;
    
    if (editingUser) {
      // Update existing user
      updatedUsers = users.map(u => 
        u.id === editingUser.id ? { ...u, ...userData, id: u.id } : u
      );
      
      // Update permissions
      const existingPerms = permissions.filter(p => p.user_id !== editingUser.id);
      const newPermissions = [...existingPerms, ...userPermissions.map(p => ({
        ...p,
        id: p.id || uid("perm"),
        user_id: editingUser.id,
      }))];
      ls.set("permissions", newPermissions);
      setPermissions(newPermissions);
    } else {
      // Create new user
      const newId = uid("u");
      const newUser = { ...userData, id: newId };
      updatedUsers = [newUser, ...users];
      
      // Save permissions with the new user ID
      const newPermissions = userPermissions.map(p => ({
        ...p,
        id: uid("perm"),
        user_id: newId,
      }));
      const allPermissions = [...permissions, ...newPermissions];
      ls.set("permissions", allPermissions);
      setPermissions(allPermissions);
    }
    
    ls.set("users", updatedUsers);
    setUsers(updatedUsers);
    setModalOpen(false);
    setEditingUser(null);
  };

  const handleDelete = (user) => {
    if (!confirm(`Delete user "${user.full_name}"? This will also remove their permissions.`)) return;
    
    const updatedUsers = users.filter(u => u.id !== user.id);
    const updatedPerms = permissions.filter(p => p.user_id !== user.id);
    
    ls.set("users", updatedUsers);
    ls.set("permissions", updatedPerms);
    setUsers(updatedUsers);
    setPermissions(updatedPerms);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setModalOpen(true);
  };

  const exportCsv = () => {
    const headers = ["Username", "Full Name", "Email", "Role", "Department", "Status"];
    const rows = filteredUsers.map(u => [
      u.username,
      u.full_name,
      u.email,
      u.role,
      u.department,
      u.status,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Users & Permissions"
        subtitle="Manage system users and their access rights"
        actions={
          <>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border text-sm hover:bg-muted"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Add User
            </button>
          </>
        }
      />

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Total Users</div>
          <div className="text-xl font-semibold">{users.length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Company Admins</div>
          <div className="text-xl font-semibold">{users.filter(u => u.role === "COMPANY_ADMIN").length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Branch Admins</div>
          <div className="text-xl font-semibold">{users.filter(u => u.role === "BRANCH_ADMIN").length}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="text-xs text-muted-foreground">Staff Members</div>
          <div className="text-xl font-semibold">{users.filter(u => u.role === "STAFF").length}</div>
        </div>
      </div>

      {/* Search Bar */}
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

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Username</th>
                <th className="text-left px-4 py-2.5">Full Name</th>
                <th className="text-left px-4 py-2.5">Email</th>
                <th className="text-left px-4 py-2.5">Role</th>
                <th className="text-left px-4 py-2.5">Department</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs">{user.username}</td>
                  <td className="px-4 py-2.5 font-medium">{user.full_name}</td>
                  <td className="px-4 py-2.5">{user.email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
                      user.role === "COMPANY_ADMIN" 
                        ? "bg-primary/15 text-primary border-primary/30"
                        : user.role === "BRANCH_ADMIN"
                        ? "bg-info/15 text-info border-info/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{user.department || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full border ${
                      user.status === "Active"
                        ? "bg-success/15 text-success border-success/30"
                        : "bg-destructive/15 text-destructive border-destructive/30"
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEditModal(user)}
                      className="p-1.5 rounded-md hover:bg-muted"
                      aria-label="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Form Modal with Permissions */}
      {modalOpen && (
        <UserFormWithPermissions
          initialData={editingUser}
          onSubmit={handleSaveUser}
          onCancel={() => {
            setModalOpen(false);
            setEditingUser(null);
          }}
          departments={departments}
        />
      )}
    </div>
  );
}
