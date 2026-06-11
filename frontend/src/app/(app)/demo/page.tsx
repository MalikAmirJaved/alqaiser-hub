"use client";

// ============================================================
// DEMO PAGE — shows every component from the UI library
// Place this in: app/(demo)/ui-showcase/page.tsx
// ============================================================

import { useState } from "react";
import {
  HeaderCards, PageHeader, Toolbar,
  TableView, GridView, GridCard,
  FullForm, LittleForm,
  ToggleStatusModal, DetailPanel, DetailRow,
  DatePicker, DateRangePicker,
  Dropdown, DropdownWithCreate,
  SearchableDropdown, SearchableDropdownWithCreate,
  Toggle, Checkbox, Badge, Button, Input, Pagination, EmptyState,
  type StatusVariant,
} from "@/components/reuseableComponents";

// ─── Sample data ─────────────────────────────────────────────

const SAMPLE_USERS = [
  { id: 1, name: "Aisha Malik",    role: "Admin",    status: "active",   email: "aisha@acme.io",  joined: "Jan 2024" },
  { id: 2, name: "Carlos Reyes",  role: "Editor",   status: "inactive", email: "carlos@acme.io", joined: "Feb 2024" },
  { id: 3, name: "Priya Sharma",  role: "Viewer",   status: "pending",  email: "priya@acme.io",  joined: "Mar 2024" },
  { id: 4, name: "James Kwon",    role: "Admin",    status: "active",   email: "james@acme.io",  joined: "Apr 2024" },
  { id: 5, name: "Lena Fischer",  role: "Editor",   status: "warning",  email: "lena@acme.io",   joined: "May 2024" },
];

const OPTIONS = [
  { value: "design",     label: "Design",     description: "UI/UX work" },
  { value: "engineering",label: "Engineering",description: "Dev work"   },
  { value: "marketing",  label: "Marketing",  description: "Growth"     },
  { value: "finance",    label: "Finance",    description: "Accounting" },
  { value: "hr",         label: "HR",         description: "People ops" },
];

const NAV_ITEMS = [
  { label: "Dashboard", href: "#", active: true },
  { label: "Users",     href: "#", badge: 5 },
  { label: "Reports",   href: "#" },
  { label: "Settings",  href: "#" },
];

const FULL_FORM_SECTIONS = [
  {
    title: "Personal Information",
    description: "Basic identity details",
    fields: [
      { name: "firstName",  label: "First Name",  type: "text"  as const, required: true,  placeholder: "John" },
      { name: "lastName",   label: "Last Name",   type: "text"  as const, required: true,  placeholder: "Doe" },
      { name: "email",      label: "Email",       type: "email" as const, required: true,  placeholder: "john@example.com" },
      { name: "phone",      label: "Phone",       type: "text"  as const, placeholder: "+1 (555) 000-0000" },
    ],
  },
  {
    title: "Role & Access",
    description: "Permissions and department",
    fields: [
      { name: "department", label: "Department",  type: "select" as const, options: OPTIONS, placeholder: "Select department" },
      { name: "role",       label: "Role",        type: "select" as const,
        options: [{ value: "admin", label: "Admin" }, { value: "editor", label: "Editor" }, { value: "viewer", label: "Viewer" }] },
      { name: "joinDate",   label: "Join Date",   type: "date"  as const },
      { name: "contract",   label: "Contract Period", type: "daterange" as const },
    ],
  },
  {
    title: "Preferences",
    description: "Account behaviour settings",
    fields: [
      { name: "notifications", label: "Email notifications", type: "toggle" as const, description: "Receive alerts via email" },
      { name: "twoFactor",     label: "Two-factor auth",     type: "toggle" as const, description: "Add extra login security" },
      { name: "newsletter",    label: "Subscribe to newsletter", type: "checkbox" as const },
    ],
  },
];

// ─────────────────────────────────────────────────────────────

export default function UIShowcasePage() {
  const [viewMode, setViewMode]     = useState<"table" | "grid">("table");
  const [search,   setSearch]       = useState("");
  const [selected, setSelected]     = useState(new Set<number>());
  const [page,     setPage]         = useState(1);
  const [dropVal,  setDropVal]      = useState("");
  const [searchDrop, setSearchDrop] = useState("");
  const [toggleOn, setToggleOn]     = useState(true);
  const [checked,  setChecked]      = useState(false);
  const [date,     setDate]         = useState<Date | null>(null);
  const [range,    setRange]        = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [detailOpen, setDetailOpen] = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [detailRow,  setDetailRow]  = useState<(typeof SAMPLE_USERS)[0] | null>(null);

  const filteredUsers = SAMPLE_USERS.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  function handleRowSelect(idx: number, v: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      v ? n.add(idx) : n.delete(idx);
      return n;
    });
  }

  const TABLE_COLUMNS = [
    { key: "name",   label: "Name",   sortable: true },
    { key: "email",  label: "Email",  sortable: true },
    { key: "role",   label: "Role",   sortable: true },
    { key: "joined", label: "Joined", sortable: true },
    {
      key: "status",
      label: "Status",
      render: (_: unknown, row: typeof SAMPLE_USERS[0]) => (
        <Badge status={row.status as StatusVariant} label={row.status} />
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-10">

        {/* ── Page Header ─────────────────────────────────── */}
        <PageHeader
          title="People Management"
          description="Manage user accounts, roles, and permissions across your organisation."
          breadcrumbs={[{ label: "Home", href: "#" }, { label: "Users" }]}
          actions={
            <>
              <Button variant="secondary" size="sm">Import CSV</Button>
              <Button size="sm">+ Add User</Button>
            </>
          }
        />

        {/* ── Header Cards (KPI Row) ───────────────────────── */}
        <HeaderCards
          columns={4}
          cards={[
            { title: "Total Users",    value: "1,284",   change: { value: 12.5 }, description: "vs last month" },
            { title: "Active Now",     value: "847",     change: { value: 8.2  }, description: "online" },
            { title: "Pending Invites",value: "39",      change: { value: -3.1 }, description: "awaiting" },
            { title: "MRR",            value: "$24,900", change: { value: 21.0 }, description: "monthly revenue" },
          ]}
        />

        {/* ── Toolbar + Table / Grid ──────────────────────── */}
        <section className="flex flex-col gap-4">
          <Toolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search users..."
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            actions={
              <>
                <Button size="sm" variant="secondary">Filter</Button>
                <Button size="sm" onClick={() => setModalOpen(true)}>Toggle Status</Button>
              </>
            }
          />

          {viewMode === "table" ? (
            <TableView
              columns={TABLE_COLUMNS as never}
              data={[]}
              selectedRows={selected}
              onRowSelect={handleRowSelect}
              onRowClick={(row) => { setDetailRow(row as typeof SAMPLE_USERS[0]); setDetailOpen(true); }}
              actions={(row) => (
                <Button size="sm" variant="ghost" onClick={() => { setDetailRow(row as typeof SAMPLE_USERS[0]); setDetailOpen(true); }}>
                  View
                </Button>
              )}
            />
          ) : (
            <GridView
              data={[]}
              columns={3}
              renderCard={(item) => {
                const u = item as typeof SAMPLE_USERS[0];
                return (
                  <GridCard
                    key={u.id}
                    title={u.name}
                    subtitle={u.role}
                    description={u.email}
                    badge={{ label: u.status, status: u.status as StatusVariant }}
                    onClick={() => { setDetailRow(u); setDetailOpen(true); }}
                    footer={<span className="text-xs text-[var(--muted-foreground)]">Joined {u.joined}</span>}
                    actions={<Button size="sm" variant="ghost">···</Button>}
                  />
                );
              }}
            />
          )}

          <Pagination page={page} totalPages={8} totalItems={filteredUsers.length} pageSize={10}
            onPageChange={setPage} onPageSizeChange={() => {}} />
        </section>

        {/* ── Form Components ─────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Little form */}
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Quick Add</h2>
            <LittleForm
              title="Invite Team Member"
              fields={[
                { name: "name",  label: "Full Name", type: "text",  placeholder: "Jane Smith" },
                { name: "email", label: "Email",     type: "email", placeholder: "jane@acme.io" },
                { name: "role",  label: "Role",      type: "select",
                  options: [{ value: "admin", label: "Admin" }, { value: "editor", label: "Editor" }] },
              ]}
              onSubmit={(d) => console.log("Quick add:", d)}
              submitLabel="Send Invite"
              onCancel={() => {}}
            />

            {/* Dropdowns */}
            <h2 className="text-base font-semibold text-[var(--foreground)]">Dropdown Variants</h2>
            <div className="flex flex-col gap-4 p-5 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)]">
              <Dropdown label="Basic Dropdown" options={OPTIONS} value={dropVal} onChange={setDropVal} placeholder="Select department" />
              <DropdownWithCreate label="Dropdown + Create" options={OPTIONS} value={dropVal} onChange={setDropVal}
                onCreateNew={() => alert("Create new!")} createLabel="Create department" />
              <SearchableDropdown label="Searchable Dropdown" options={OPTIONS} value={searchDrop}
                onChange={setSearchDrop} placeholder="Search departments..." />
              <SearchableDropdownWithCreate label="Searchable + Create" options={OPTIONS} value={searchDrop}
                onChange={setSearchDrop} onCreateNew={(q) => alert(`Create: ${q}`)} />
            </div>

            {/* Date Pickers */}
            <h2 className="text-base font-semibold text-[var(--foreground)]">Date Pickers</h2>
            <div className="flex flex-col gap-4 p-5 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)]">
              <DatePicker label="Date Picker" value={date} onChange={setDate} placeholder="Pick a date" />
              <DateRangePicker label="Date Range Picker" value={range} onChange={setRange} />
            </div>

            {/* Controls */}
            <h2 className="text-base font-semibold text-[var(--foreground)]">Controls</h2>
            <div className="flex flex-col gap-4 p-5 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)]">
              <Toggle checked={toggleOn} onChange={setToggleOn} label="Email notifications"
                description="Receive daily digest emails" />
              <Toggle checked={!toggleOn} onChange={(v) => setToggleOn(!v)} label="Maintenance mode"
                description="Temporarily disable public access" size="sm" />
              <Checkbox checked={checked} onChange={setChecked} label="Accept terms of service"
                description="I agree to the Terms and Privacy Policy" />
            </div>
          </div>

          {/* previews */}
          <div className="flex flex-col gap-4">
           

            {/* Badges */}
            <h2 className="text-base font-semibold text-[var(--foreground)] mt-2">Status Badges</h2>
            <div className="flex flex-wrap gap-2 p-4 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)]">
              {(["active","inactive","pending","success","warning","danger"] as StatusVariant[]).map((s) => (
                <Badge key={s} status={s} label={s.charAt(0).toUpperCase() + s.slice(1)} />
              ))}
            </div>

            {/* Button variants */}
            <h2 className="text-base font-semibold text-[var(--foreground)] mt-2">Buttons</h2>
            <div className="flex flex-col gap-3 p-4 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)]">
              <div className="flex flex-wrap gap-2">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Button loading>Loading</Button>
                <Button disabled>Disabled</Button>
              </div>
            </div>

            {/* Empty state */}
            <EmptyState
              icon={<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"><path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4m8-4v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
              title="No results found"
              description="Try adjusting your search query or filters to find what you're looking for."
              action={<Button size="sm" variant="secondary">Clear filters</Button>}
            />
          </div>
        </section>

        {/* ── Full Form ─────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-4">Full Form</h2>
          <FullForm
            title="Add New User"
            description="Fill in the details below to create a new team member account."
            sections={FULL_FORM_SECTIONS}
            onSubmit={(d) => console.log("Form submit:", d)}
            onCancel={() => {}}
            submitLabel="Create User"
          />
        </section>

      </main>

      {/* ── Detail Panel ──────────────────────────────────── */}
      <DetailPanel
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detailRow?.name ?? "User Detail"}
        subtitle={detailRow?.role}
        badge={detailRow ? { label: detailRow.status, status: detailRow.status as StatusVariant } : undefined}
        width="md"
        actions={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setDetailOpen(false)}>Close</Button>
            <Button className="flex-1">Edit User</Button>
          </>
        }
      >
        {detailRow && (
          <div className="flex flex-col gap-1">
            <DetailRow label="Full Name" value={detailRow.name} />
            <DetailRow label="Email"     value={<a className="text-[var(--primary)]" href={`mailto:${detailRow.email}`}>{detailRow.email}</a>} />
            <DetailRow label="Role"      value={detailRow.role} />
            <DetailRow label="Status"    value={<Badge status={detailRow.status as StatusVariant} label={detailRow.status} />} />
            <DetailRow label="Joined"    value={detailRow.joined} />
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3">
                Quick Actions
              </p>
              <div className="flex flex-col gap-2">
                <Button variant="secondary" size="sm" onClick={() => setModalOpen(true)}>
                  Toggle Status
                </Button>
                <Button variant="destructive" size="sm">Remove User</Button>
              </div>
            </div>
          </div>
        )}
      </DetailPanel>

      {/* ── Toggle Status Modal ───────────────────────────── */}
      <ToggleStatusModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={() => { alert("Status toggled!"); setModalOpen(false); }}
        currentStatus="active"
        targetStatus="inactive"
        itemName={detailRow?.name ?? "this user"}
        loading={false}
      />
    </div>
  );
}