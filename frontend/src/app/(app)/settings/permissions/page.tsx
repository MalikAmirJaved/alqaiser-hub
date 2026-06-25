"use client";
// app/settings/permissions/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Production-ready Permission Management UI
// Features: user list, role assignment, per-permission toggles, real-time WS
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Search, ChevronDown, ChevronRight, Check, X,
  Users, Layers, UserCheck, AlertCircle, Loader2,
  Wifi, WifiOff, Eye, Edit, Trash2, Plus, RefreshCw,
  CheckSquare, Square, Minus, Crown, Zap
} from "lucide-react";

import {
  useUserModules,
  useUserRoles,
  useUserOverrides,
  useRoles,
  useBulkSetPermissions,
  useAssignRole,
  useRemoveRole,
  useRemoveOverride,
  usePermissionSocket,
  PermissionUser,
  ModuleNode,
} from "@/hooks/usePermissions";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { useSearchParams } from "next/navigation";
import SearchableSelect from "@/components/reuseable/SearchableSelect";
import { useServerSearch } from "@/hooks/useServerSearch";
import { useApi } from "@/hooks/useApi";
// ─── Helpers ────────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  view:    "text-info border-info/30 bg-info/10",
  create:  "text-success border-success/30 bg-success/10",
  update:  "text-warning border-warning/30 bg-warning/10",
  delete:  "text-destructive border-destructive/30 bg-destructive/10",
  export:  "text-purple-400 border-purple-400/30 bg-purple-400/10",
  approve: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  reject:  "text-orange-400 border-orange-400/30 bg-orange-400/10",
  assign:  "text-cyan-400 border-cyan-400/30 bg-cyan-400/10",
  publish: "text-pink-400 border-pink-400/30 bg-pink-400/10",
  archive: "text-muted-foreground border-border bg-muted/40",
};

const ACTION_ICONS: Record<string, string> = {
  view: "👁", create: "✚", update: "✎", delete: "✕",
  export: "↗", approve: "✓", reject: "✗", assign: "→",
  publish: "◉", archive: "⊙",
};

function initials(u: PermissionUser) {
  if (u.first_name && u.last_name) return `${u.first_name[0]}${u.last_name[0]}`.toUpperCase();
  return u.username.slice(0, 2).toUpperCase();
}

function avatarColor(username: string) {
  const colors = [
    "from-blue-500 to-indigo-600",
    "from-violet-500 to-purple-600",
    "from-emerald-500 to-teal-600",
    "from-orange-500 to-amber-600",
    "from-pink-500 to-rose-600",
    "from-cyan-500 to-sky-600",
  ];
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) % colors.length;
  return colors[hash];
}

// ─── Module Permission Card ──────────────────────────────────────────────────

function ModuleCard({
  module,
  pendingChanges,
  onToggle,
  canEdit = true,
}: {
  module: ModuleNode;
  pendingChanges: Record<string, boolean>;
  onToggle: (code: string, current: boolean) => void;
  canEdit?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  // Compute aggregate state for module-level header
  const allActions = module.resources.flatMap(r =>
    r.actions.map(a => ({ code: `${module.code}:${r.code}:${a.code}`, granted: a.granted }))
  );
  const effective = allActions.map(a => ({
    code: a.code,
    granted: pendingChanges[a.code] !== undefined ? pendingChanges[a.code] : a.granted,
  }));
  const grantedCount = effective.filter(a => a.granted).length;
  const total = effective.length;
  const allGranted = grantedCount === total;
  const noneGranted = grantedCount === 0;

  const handleModuleToggle = () => {
    if (!canEdit) return;
    const target = !allGranted;
    allActions.forEach(a => onToggle(a.code, !target));
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Module Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={e => { e.stopPropagation(); handleModuleToggle(); }}
            disabled={!canEdit}
            className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center border transition-all ${
              allGranted
                ? "bg-primary border-primary text-primary-foreground"
                : noneGranted
                ? "border-border bg-transparent"
                : "border-primary bg-primary/20"
            }`}
          >
            {allGranted ? <Check className="w-3 h-3" /> : !noneGranted ? <Minus className="w-3 h-3 text-primary" /> : null}
          </button>
          <span className="font-semibold text-sm truncate">{module.name}</span>
          <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {grantedCount}/{total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mini progress bar */}
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${total > 0 ? (grantedCount / total) * 100 : 0}%` }}
            />
          </div>
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-border/50">
              {module.resources.map(resource => (
                <ResourceRow
                  key={resource.code}
                  moduleCode={module.code}
                  resource={resource}
                  pendingChanges={pendingChanges}
                  onToggle={onToggle}
                  canEdit={canEdit}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResourceRow({
  moduleCode,
  resource,
  pendingChanges,
  onToggle,
  canEdit = true,
}: {
  moduleCode: string;
  resource: ModuleNode["resources"][0];
  pendingChanges: Record<string, boolean>;
  onToggle: (code: string, current: boolean) => void;
  canEdit?: boolean;
}) {
  const codes = resource.actions.map(a => `${moduleCode}:${resource.code}:${a.code}`);
  const effective = resource.actions.map(a => {
    const code = `${moduleCode}:${resource.code}:${a.code}`;
    return pendingChanges[code] !== undefined ? pendingChanges[code] : a.granted;
  });
  const allGranted = effective.every(Boolean);
  const noneGranted = effective.every(v => !v);

  const handleRowToggle = () => {
    if (!canEdit) return;
    const target = !allGranted;
    codes.forEach((code, i) => onToggle(code, effective[i] !== target ? effective[i] : !target));
    resource.actions.forEach(a => {
      const code = `${moduleCode}:${resource.code}:${a.code}`;
      onToggle(code, !target ? !target : effective[resource.actions.indexOf(a)]);
    });
  };

  return (
    <div className="px-4 py-3 flex items-center gap-4 hover:bg-muted/20 transition-colors">
      {/* Row checkbox */}
      <button
        onClick={handleRowToggle}
        disabled={!canEdit}
        className={`flex-shrink-0 w-4 h-4 rounded flex items-center justify-center border transition-all ${
          allGranted
            ? "bg-primary border-primary text-primary-foreground"
            : noneGranted
            ? "border-border bg-transparent"
            : "border-primary bg-primary/20"
        }`}
      >
        {allGranted ? <Check className="w-2.5 h-2.5" /> : !noneGranted ? <Minus className="w-2.5 h-2.5 text-primary" /> : null}
      </button>

      {/* Resource name */}
      <span className="text-sm w-36 flex-shrink-0 capitalize text-muted-foreground">
        {resource.name}
      </span>

      {/* Action chips */}
      <div className="flex flex-wrap gap-1.5">
        {resource.actions.map(action => {
          const code = `${moduleCode}:${resource.code}:${action.code}`;
          const isGranted = pendingChanges[code] !== undefined ? pendingChanges[code] : action.granted;
          const colorClass = ACTION_COLORS[action.code] || "text-muted-foreground border-border bg-muted/40";
          const icon = ACTION_ICONS[action.code] || "·";

          return (
            <button
              key={action.code}
              onClick={() => canEdit && onToggle(code, isGranted)}
              disabled={!canEdit}
              title={`${action.name}: ${isGranted ? "Granted — click to revoke" : "Not granted — click to grant"}`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all ${
                isGranted
                  ? colorClass
                  : "text-muted-foreground/40 border-border/30 bg-transparent opacity-40"
              }`}
            >
              <span>{icon}</span>
              <span>{action.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── User List Item ──────────────────────────────────────────────────────────

function UserListItem({
  user,
  selected,
  onClick,
}: {
  user: PermissionUser;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 pr-3 py-2.5 rounded-lg text-left transition-all ${
        selected
          ? "bg-primary/15 border border-primary/30"
          : "border border-transparent hover:bg-muted/50"
      }`}
    >
      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(user.username)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
        {initials(user)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">
          {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{user.username}</div>
      </div>
      <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${user.is_active ? "bg-success" : "bg-muted-foreground"}`} />
    </button>
  );
}

// ─── Roles Panel ────────────────────────────────────────────────────────────

function RolesPanel({
  userId,
  canAssign = true,
  canRemove = true,
}: {
  userId: number;
  canAssign?: boolean;
  canRemove?: boolean;
}) {
  const { data: userRoles = [], isLoading } = useUserRoles(userId);
  const { data: allRoles = [] } = useRoles();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<number | "">("");

  const assignedRoleIds = new Set(userRoles.map(r => r.role.id));
  const availableRoles = allRoles.filter(r => !assignedRoleIds.has(r.id));

  const handleAssign = async () => {
    if (!selectedRoleId) return;
    try {
      await assignRole.mutateAsync({ user_id: userId, role_id: Number(selectedRoleId) });
      setShowAdd(false);
      setSelectedRoleId("");
    } catch {
    }
  };

  const handleRemove = async (roleId: number) => {
    try {
      await removeRole.mutateAsync({ userId, roleId });
    } catch {
    }
  };

  if (isLoading) return <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-2">
      {userRoles.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-3">No roles assigned</p>
      )}
      {userRoles.map(ur => (
        <div key={ur.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 border border-border">
          <div className="flex items-center gap-2">
            {ur.role.is_system && <Crown className="w-3.5 h-3.5 text-warning" />}
            <span className="text-sm font-medium">{ur.role.name}</span>
          </div>
          {canRemove && (
            <button
              onClick={() => handleRemove(ur.role.id)}
              disabled={ur.role.is_system}
              className="p-1 rounded hover:bg-destructive/15 text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={ur.role.is_system ? "System roles cannot be removed" : "Remove role"}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}

      {!showAdd ? (
        canAssign && (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Role
          </button>
        )
      ) : canAssign ? (
        <div className="flex gap-2">
          <SearchableSelect
            value={selectedRoleId ? String(selectedRoleId) : ""}
            onChange={val => setSelectedRoleId(Number(val) as any)}
            options={availableRoles.map(r => ({ value: String(r.id), label: r.name }))}
            placeholder="Select role…"
          />
          <button
            onClick={handleAssign}
            disabled={!selectedRoleId || assignRole.isPending}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50"
          >
            {assignRole.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
          </button>
          <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-lg border border-border text-sm">
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type Tab = "permissions" | "roles" | "overrides";

export default function PermissionsPage() {
  const permissions = useFeaturePermissions("SETTINGS", "permissions");
  const api = useApi();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("permissions");
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  const [wsOnline, setWsOnline] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const searchParams = useSearchParams();  const urlUserId = searchParams.get("userId");

  // Server-side infinite scrolling user search (for SearchableSelect)
  const fetchUsers = useServerSearch("/api/organization/users/", {
    transformOption: (u: any) => ({
      value: String(u.id),
      label: `${u.first_name || ""} ${u.last_name || ""} (${u.username})`,
    }),
  });

  // ── Infinite-scroll user list for sidebar ──
  const USERS_PAGE_SIZE = 20;
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersTotalCount, setUsersTotalCount] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const usersPageRef = useRef(1);
  const loadingUsersRef = useRef(false);
  const allUsersRef = useRef<any[]>([]);
  const userListRef = useRef<HTMLDivElement>(null);
  const urlHandledRef = useRef(false);

  // Keep ref in sync with allUsers (for use inside callbacks without stale closure)
  allUsersRef.current = allUsers;

  const loadUserPage = useCallback(async (page: number, append: boolean) => {
    if (loadingUsersRef.current) return;
    loadingUsersRef.current = true;
    setUsersLoading(true);
    try {
      const res = await api<any>(`/api/organization/users/?page=${page}&page_size=${USERS_PAGE_SIZE}`);
      const items = res?.results ?? [];
      setAllUsers(prev => append ? [...prev, ...items] : items);
      setUsersTotalCount(res?.count ?? items.length);
      setHasMoreUsers(items.length >= USERS_PAGE_SIZE);
      // Handle URL userId selection on initial load
      if (!append && urlUserId && !urlHandledRef.current) {
        urlHandledRef.current = true;
        const id = parseInt(urlUserId, 10);
        if (items.find((u: any) => u.id === id)) {
          setSelectedUserId(id);
        } else {
          // URL user not on first page — fetch individually
          fetchAndAddUserById(id);
        }
      }
    } catch {
      setHasMoreUsers(false);
    } finally {
      setUsersLoading(false);
      loadingUsersRef.current = false;
    }
  }, [api, urlUserId]);

  // Fetch a single user by ID and add to the sidebar list
  const fetchAndAddUserById = useCallback(async (userId: number) => {
    if (allUsersRef.current.find((u: any) => u.id === userId)) return;
    try {
      const user = await api<any>(`/api/organization/users/${userId}/`);
      if (user && user.id) {
        setAllUsers(prev => [user, ...prev]);
        setSelectedUserId(userId);
      }
    } catch {}
  }, [api]);

  // Load first page on mount
  useEffect(() => {
    usersPageRef.current = 1;
    loadUserPage(1, false);
  }, [loadUserPage]);

  // Scroll handler to load more pages
  const handleUserListScroll = useCallback(() => {
    const el = userListRef.current;
    if (!el || !hasMoreUsers || loadingUsersRef.current) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 150) {
      const nextPage = usersPageRef.current + 1;
      usersPageRef.current = nextPage;
      loadUserPage(nextPage, true);
    }
  }, [hasMoreUsers, loadUserPage]);
  const { data: modules = [], isLoading: modulesLoading, refetch: refetchModules } = useUserModules(selectedUserId);
  const { data: overrides = [] } = useUserOverrides(selectedUserId);
  const bulkSet = useBulkSetPermissions();
  const removeOverride = useRemoveOverride();
  
  // Real-time WebSocket
  usePermissionSocket(selectedUserId);
  const selectedUser = allUsers.find((u: any) => u.id === selectedUserId);
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;
  // Reset pending when user changes
  useEffect(() => {
    setPendingChanges({});
  }, [selectedUserId]);

  const handleToggle = useCallback((code: string, current: boolean) => {
    setPendingChanges(prev => {
      const next = { ...prev };
      if (next[code] !== undefined && next[code] !== current) {
        delete next[code];
      } else {
        next[code] = !current;
      }
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!selectedUserId || !hasPendingChanges) return;

    const permissions = Object.entries(pendingChanges).map(([permission_code, granted]) => ({
      permission_code,
      granted,
    }));

    try {
      await bulkSet.mutateAsync({ user_id: selectedUserId, permissions });
      setPendingChanges({});
    } catch {
    }
  };

  const handleDiscard = () => setPendingChanges({});

  // Compute summary
  const totalGranted = modules.reduce((acc, m) =>
    acc + m.resources.reduce((a2, r) =>
      a2 + r.actions.filter(a => {
        const code = `${m.code}:${r.code}:${a.code}`;
        return pendingChanges[code] !== undefined ? pendingChanges[code] : a.granted;
      }).length, 0), 0);
  const totalActions = modules.reduce((acc, m) =>
    acc + m.resources.reduce((a2, r) => a2 + r.actions.length, 0), 0);

  return (
    <div className="h-full flex flex-col gap-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">Permission Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Assign roles & granular permissions per user</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${
            wsOnline
              ? "text-success border-success/30 bg-success/10"
              : "text-muted-foreground border-border bg-muted/40"
          }`}>
            {wsOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {wsOnline ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel: User List (server-side search with infinite scroll) ── */}
        <div className="w-72 flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
          <div className="py-3 pr-3 border-b border-border">
            <SearchableSelect
              value={selectedUserId ? String(selectedUserId) : ""}
              onChange={(val) => {
                if (val) {
                  const id = Number(val);
                  if (allUsersRef.current.find((u: any) => u.id === id)) {
                    setSelectedUserId(id);
                  } else {
                    fetchAndAddUserById(id);
                  }
                }
              }}
              fetchOptions={fetchUsers}
              placeholder="Search users…"
              pageSize={20}
            />
          </div>

          <div
            ref={userListRef}
            onScroll={handleUserListScroll}
            className="flex-1 overflow-y-auto py-2 space-y-0.5"
          >
            {allUsers.length === 0 && usersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : allUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
            ) : (
              <>
                {allUsers.map((user: any) => (
                  <UserListItem
                    key={user.id}
                    user={user}
                    selected={selectedUserId === user.id}
                    onClick={() => setSelectedUserId(user.id)}
                  />
                ))}
                {usersLoading && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="py-3 border-t border-border text-xs text-muted-foreground">
            {allUsers.length} of {usersTotalCount} user{usersTotalCount !== 1 ? "s" : ""}
          </div>
        </div>

        {/* ── Right Panel ───────────────────────────────────────────────────── */}
        {!selectedUserId ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center">
              <Users className="w-8 h-8 opacity-30" />
            </div>
            <p className="text-sm">Select a user to manage permissions</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* User header strip */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(selectedUser?.username || "")} flex items-center justify-center text-white text-sm font-bold`}>
                  {selectedUser ? initials(selectedUser) : "?"}
                </div>
                <div>
                  <div className="font-semibold text-sm">
                    {selectedUser?.first_name && selectedUser.last_name
                      ? `${selectedUser.first_name} ${selectedUser.last_name}`
                      : selectedUser?.username}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{selectedUser?.email}</span>
                    {selectedUser?.department && (
                      <span className="px-1.5 py-0.5 rounded-full bg-muted border border-border">
                        {selectedUser.department}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Permission summary */}
              {activeTab === "permissions" && (
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-bold">{totalGranted}<span className="text-muted-foreground font-normal">/{totalActions}</span></div>
                    <div className="text-[10px] text-muted-foreground">permissions granted</div>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  {hasPendingChanges && (
                    <span className="text-xs px-2 py-1 rounded-full bg-warning/15 text-warning border border-warning/30">
                      {Object.keys(pendingChanges).length} unsaved
                    </span>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => refetchModules()}
                      className="p-1.5 rounded-md hover:bg-muted border border-border transition-colors"
                      title="Refresh"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    {hasPendingChanges && permissions.update && (
                      <>
                        <button
                          onClick={handleDiscard}
                          className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
                        >
                          Discard
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={bulkSet.isPending}
                          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1.5 disabled:opacity-70"
                        >
                          {bulkSet.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Save Changes
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border flex-shrink-0">
              {(["permissions", "roles", "overrides"] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2.5 text-sm capitalize transition-colors border-b-2 -mb-px ${
                    activeTab === tab
                      ? "border-primary text-primary font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "permissions" && <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />{tab}</span>}
                  {tab === "roles" && <span className="flex items-center gap-1.5"><Crown className="w-3.5 h-3.5" />{tab}</span>}
                  {tab === "overrides" && <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" />{tab}</span>}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {/* ── Permissions Tab ───────────────────────────────────────── */}
              {activeTab === "permissions" && (
                <div className="p-4 space-y-3">
                  {modulesLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : modules.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No permissions found</p>
                    </div>
                  ) : (
                    modules.map(module => (
                      <ModuleCard
                        key={module.code}
                        module={module}
                        pendingChanges={pendingChanges}
                        onToggle={handleToggle}
                        canEdit={permissions.update}
                      />
                    ))
                  )}
                </div>
              )}

              {/* ── Roles Tab ─────────────────────────────────────────────── */}
              {activeTab === "roles" && selectedUserId && (
                <div className="p-4">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold mb-1">Assigned Roles</h3>
                    <p className="text-xs text-muted-foreground">
                      Roles grant a base set of permissions. User-level overrides (Overrides tab) take precedence.
                    </p>
                  </div>
                  <RolesPanel
                    userId={selectedUserId}
                    canAssign={permissions.assign}
                    canRemove={permissions.delete}
                  />
                </div>
              )}

              {/* ── Overrides Tab ─────────────────────────────────────────── */}
              {activeTab === "overrides" && (
                <div className="p-4">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold mb-1">Permission Overrides</h3>
                    <p className="text-xs text-muted-foreground">
                      These user-specific overrides take precedence over role permissions. Grant = forces on, Deny = forces off.
                    </p>
                  </div>

                  {overrides.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
                      <Zap className="w-6 h-6 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No overrides set</p>
                      <p className="text-xs mt-1">Modify permissions in the Permissions tab to create overrides</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {overrides.map(ov => (
                        <div
                          key={ov.id}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${
                            ov.granted
                              ? "border-success/30 bg-success/5"
                              : "border-destructive/30 bg-destructive/5"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                              ov.granted ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
                            }`}>
                              {ov.granted ? "✓" : "✕"}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-mono truncate">{ov.permission.code}</div>
                              {ov.reason && <div className="text-[11px] text-muted-foreground truncate">{ov.reason}</div>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {ov.expires_at && (
                              <span className="text-[10px] text-muted-foreground">
                                exp {new Date(ov.expires_at).toLocaleDateString()}
                              </span>
                            )}
                            <button
                              onClick={async () => {
                                try {
                                  await removeOverride.mutateAsync({ userId: selectedUserId!, overrideId: ov.id });
                                } catch {
                                }
                              }}
                              className="p-1 rounded hover:bg-muted transition-colors"
                            >
                              <X className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}