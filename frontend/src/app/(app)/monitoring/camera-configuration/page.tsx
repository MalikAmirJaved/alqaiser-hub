"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, Building2, Monitor, Camera } from "lucide-react";
import {
  useSites, useCreateSite, useUpdateSite, useDeleteSite,
  type Site, type SiteFormData,
} from "@/hooks/useSites";
import {
  useNvrs, useCreateNvr, useUpdateNvr, useDeleteNvr,
  type Nvr, type NvrFormData,
} from "@/hooks/useNvrs";
import {
  useCameras, useCreateCamera, useUpdateCamera, useDeleteCamera,
  type Camera as CameraType, type CameraFormData,
} from "@/hooks/useCameras";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";
import FormModal from "@/components/reuseable/FormModal";
import PageHeader from "@/components/PageHeader";

const inputCls = "bg-muted/40 border border-border rounded-md h-9 px-2 outline-none focus:ring-2 focus:ring-ring w-full text-sm";

export default function CameraConfigurationPage() {
  const sitePerms = useFeaturePermissions("AI_MONITORING", "site");
  const nvrPerms = useFeaturePermissions("AI_MONITORING", "nvr");
  const cameraPerms = useFeaturePermissions("AI_MONITORING", "camera");

  const { data: sites, isLoading: sitesLoading } = useSites();
  const createSite = useCreateSite();
  const updateSite = useUpdateSite();
  const deleteSite = useDeleteSite();

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const { data: nvrs, isLoading: nvrsLoading } = useNvrs(selectedSiteId ?? undefined, { enabled: !!selectedSiteId });
  const createNvr = useCreateNvr();
  const updateNvr = useUpdateNvr();
  const deleteNvr = useDeleteNvr();

  const [selectedNvrId, setSelectedNvrId] = useState<string | null>(null);
  const { data: cameras, isLoading: camerasLoading } = useCameras(selectedNvrId ?? undefined, { enabled: !!selectedNvrId });
  const createCamera = useCreateCamera();
  const updateCamera = useUpdateCamera();
  const deleteCamera = useDeleteCamera();

  const [siteModal, setSiteModal] = useState(false);
  const [nvrModal, setNvrModal] = useState(false);
  const [cameraModal, setCameraModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [editingNvr, setEditingNvr] = useState<Nvr | null>(null);
  const [editingCamera, setEditingCamera] = useState<CameraType | null>(null);

  const [siteForm, setSiteForm] = useState<SiteFormData>({ name: "", location: "", description: "" });
  const [nvrForm, setNvrForm] = useState<NvrFormData>({ site: "", nvr_name: "", nvr_username: "", password: "", ip: "", port: 554 });
  const [cameraForm, setCameraForm] = useState<CameraFormData>({ nvr: "", camera: "", channel: 1, zone: "", purpose: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [siteLoading, setSiteLoading] = useState(false);
  const [nvrLoading, setNvrLoading] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);

  // Site handlers
  const openAddSite = () => {
    setEditingSite(null);
    setSiteForm({ name: "", location: "", description: "" });
    setSiteModal(true);
  };
  const openEditSite = (s: Site) => {
    setEditingSite(s);
    setSiteForm({ name: s.name, location: s.location, description: s.description });
    setSiteModal(true);
  };
  const handleSiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteForm.name) return;
    setSiteLoading(true);
    try {
      if (editingSite) await updateSite.mutateAsync({ id: editingSite.id, data: siteForm });
      else await createSite.mutateAsync(siteForm);
      setSiteModal(false);
    } finally { setSiteLoading(false); }
  };
  const handleDeleteSite = async (id: string) => {
    if (!confirm("Delete this site and all its NVRs & cameras?")) return;
    await deleteSite.mutateAsync(id);
    if (selectedSiteId === id) { setSelectedSiteId(null); setSelectedNvrId(null); }
  };

  // NVR handlers
  const openAddNvr = (siteId: string) => {
    setEditingNvr(null);
    setNvrForm({ site: siteId, nvr_name: "", nvr_username: "", password: "", ip: "", port: 554 });
    setShowPwd(false);
    setNvrModal(true);
  };
  const openEditNvr = (n: Nvr) => {
    setEditingNvr(n);
    setNvrForm({ site: n.site_id, nvr_name: n.nvr_name, nvr_username: n.nvr_username, password: "", ip: n.ip, port: n.port });
    setShowPwd(false);
    setNvrModal(true);
  };
  const handleNvrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nvrForm.nvr_name || !nvrForm.nvr_username || !nvrForm.ip) return;
    setNvrLoading(true);
    try {
      if (editingNvr) await updateNvr.mutateAsync({ id: editingNvr.id, data: nvrForm });
      else await createNvr.mutateAsync(nvrForm);
      setNvrModal(false);
    } finally { setNvrLoading(false); }
  };
  const handleDeleteNvr = async (id: string) => {
    if (!confirm("Delete this NVR and all its cameras?")) return;
    await deleteNvr.mutateAsync(id);
    if (selectedNvrId === id) setSelectedNvrId(null);
  };

  // Camera handlers
  const openAddCamera = (nvrId: string) => {
    setEditingCamera(null);
    setCameraForm({ nvr: nvrId, camera: "", channel: 1, zone: "", purpose: "" });
    setCameraModal(true);
  };
  const openEditCamera = (c: CameraType) => {
    setEditingCamera(c);
    setCameraForm({ nvr: c.nvr_id, camera: c.camera, channel: c.channel, zone: c.zone, purpose: c.purpose });
    setCameraModal(true);
  };
  const handleCameraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cameraForm.camera || cameraForm.channel == null) return;
    setCameraLoading(true);
    try {
      if (editingCamera) {
        const { nvr, ...rest } = cameraForm;
        await updateCamera.mutateAsync({ id: editingCamera.id, data: rest });
      } else {
        await createCamera.mutateAsync(cameraForm);
      }
      setCameraModal(false);
    } finally { setCameraLoading(false); }
  };
  const handleDeleteCamera = async (id: string) => {
    if (!confirm("Delete this camera?")) return;
    await deleteCamera.mutateAsync(id);
  };

  const selectSite = (id: string) => {
    setSelectedSiteId(selectedSiteId === id ? null : id);
    setSelectedNvrId(null);
  };

  return (
    <div>
      <PageHeader
        title="Camera Configuration"
        subtitle="Manage sites, NVRs, and cameras"
        actions={
          sitePerms.create && (
            <button onClick={openAddSite} className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90">
              <Plus className="w-4 h-4" /> Add Site
            </button>
          )
        }
      />

      {sitesLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : !sites?.length ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-2xl">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium mb-1">No sites yet</p>
          <p className="text-sm">Click &quot;Add Site&quot; to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((site) => {
            const siteNvrs = selectedSiteId === site.id ? nvrs : undefined;
            return (
              <SiteCard
                key={site.id}
                site={site}
                isOpen={selectedSiteId === site.id}
                onToggle={() => selectSite(site.id)}
                onEdit={() => openEditSite(site)}
                onDelete={() => handleDeleteSite(site.id)}
                canEdit={sitePerms.update}
                canDelete={sitePerms.delete}
              >
                {selectedSiteId === site.id && (
                  <NvrList
                    nvrs={siteNvrs}
                    loading={nvrsLoading}
                    siteId={site.id}
                    selectedNvrId={selectedNvrId}
                    onSelectNvr={setSelectedNvrId}
                    onAddNvr={() => openAddNvr(site.id)}
                    onEditNvr={openEditNvr}
                    onDeleteNvr={handleDeleteNvr}
                    canCreate={nvrPerms.create}
                    canEdit={nvrPerms.update}
                    canDelete={nvrPerms.delete}
                    cameras={cameras}
                    camerasLoading={camerasLoading}
                    onAddCamera={openAddCamera}
                    onEditCamera={openEditCamera}
                    onDeleteCamera={handleDeleteCamera}
                    canCreateCamera={cameraPerms.create}
                    canEditCamera={cameraPerms.update}
                    canDeleteCamera={cameraPerms.delete}
                  />
                )}
              </SiteCard>
            );
          })}
        </div>
      )}

      {/* Site Modal */}
      <FormModal open={siteModal} onClose={() => setSiteModal(false)} title={editingSite ? "Edit Site" : "Add Site"} onSubmit={handleSiteSubmit} loading={siteLoading} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 col-span-2 text-sm">
            <span className="text-muted-foreground">Site Name <span className="text-destructive">*</span></span>
            <input value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} className={inputCls} required />
          </label>
          <label className="flex flex-col gap-1 col-span-2 text-sm">
            <span className="text-muted-foreground">Location</span>
            <input value={siteForm.location} onChange={(e) => setSiteForm({ ...siteForm, location: e.target.value })} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 col-span-2 text-sm">
            <span className="text-muted-foreground">Description</span>
            <textarea value={siteForm.description} onChange={(e) => setSiteForm({ ...siteForm, description: e.target.value })} rows={2} className="bg-muted/40 border border-border rounded-md p-2 outline-none focus:ring-2 focus:ring-ring w-full text-sm" />
          </label>
        </div>
      </FormModal>

      {/* NVR Modal */}
      <FormModal open={nvrModal} onClose={() => setNvrModal(false)} title={editingNvr ? "Edit NVR" : "Add NVR"} onSubmit={handleNvrSubmit} loading={nvrLoading} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 col-span-2 text-sm">
            <span className="text-muted-foreground">NVR Name <span className="text-destructive">*</span></span>
            <input value={nvrForm.nvr_name} onChange={(e) => setNvrForm({ ...nvrForm, nvr_name: e.target.value })} className={inputCls} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Username <span className="text-destructive">*</span></span>
            <input value={nvrForm.nvr_username} onChange={(e) => setNvrForm({ ...nvrForm, nvr_username: e.target.value })} className={inputCls} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Password {!editingNvr && <span className="text-destructive">*</span>}</span>
            <div className="relative">
              <input type={showPwd ? "text" : "password"} value={nvrForm.password} onChange={(e) => setNvrForm({ ...nvrForm, password: e.target.value })} className={`${inputCls} pr-8`} required={!editingNvr} />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">IP Address <span className="text-destructive">*</span></span>
            <input value={nvrForm.ip} onChange={(e) => setNvrForm({ ...nvrForm, ip: e.target.value })} className={inputCls} required />
          </label>
          <label className="flex flex-col gap-1 col-span-2 text-sm">
            <span className="text-muted-foreground">Port <span className="text-destructive">*</span></span>
            <input type="number" value={nvrForm.port} onChange={(e) => setNvrForm({ ...nvrForm, port: parseInt(e.target.value) || 554 })} className={inputCls} required />
          </label>
        </div>
      </FormModal>

      {/* Camera Modal */}
      <FormModal open={cameraModal} onClose={() => setCameraModal(false)} title={editingCamera ? "Edit Camera" : "Add Camera"} onSubmit={handleCameraSubmit} loading={cameraLoading} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 col-span-2 text-sm">
            <span className="text-muted-foreground">Camera Name <span className="text-destructive">*</span></span>
            <input value={cameraForm.camera} onChange={(e) => setCameraForm({ ...cameraForm, camera: e.target.value })} className={inputCls} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Channel <span className="text-destructive">*</span></span>
            <input type="number" min={1} value={cameraForm.channel} onChange={(e) => setCameraForm({ ...cameraForm, channel: parseInt(e.target.value) || 1 })} className={inputCls} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Zone</span>
            <input value={cameraForm.zone} onChange={(e) => setCameraForm({ ...cameraForm, zone: e.target.value })} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 col-span-2 text-sm">
            <span className="text-muted-foreground">Purpose</span>
            <textarea value={cameraForm.purpose} onChange={(e) => setCameraForm({ ...cameraForm, purpose: e.target.value })} rows={2} className="bg-muted/40 border border-border rounded-md p-2 outline-none focus:ring-2 focus:ring-ring w-full text-sm" />
          </label>
        </div>
      </FormModal>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SiteCard({ site, isOpen, onToggle, onEdit, onDelete, canEdit, canDelete, children }: {
  site: Site; isOpen: boolean; onToggle: () => void;
  onEdit: () => void; onDelete: () => void; canEdit: boolean; canDelete: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-muted-foreground" />
          <div>
            <span className="font-medium">{site.name}</span>
            {site.location && <span className="text-xs text-muted-foreground ml-2">{site.location}</span>}
          </div>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{site.nvr_count} NVRs</span>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {canEdit && <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-muted"><Pencil className="w-4 h-4" /></button>}
          {canDelete && <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive"><Trash2 className="w-4 h-4" /></button>}
        </div>
      </button>
      {isOpen && <div className="border-t border-border">{children}</div>}
    </div>
  );
}

function NvrList({ nvrs, loading, siteId, selectedNvrId, onSelectNvr, onAddNvr, onEditNvr, onDeleteNvr,
  canCreate, canEdit, canDelete, cameras, camerasLoading, onAddCamera, onEditCamera, onDeleteCamera,
  canCreateCamera, canEditCamera, canDeleteCamera,
}: {
  nvrs?: Nvr[]; loading: boolean; siteId: string; selectedNvrId: string | null;
  onSelectNvr: (id: string | null) => void;
  onAddNvr: () => void; onEditNvr: (n: Nvr) => void; onDeleteNvr: (id: string) => void;
  canCreate: boolean; canEdit: boolean; canDelete: boolean;
  cameras?: CameraType[]; camerasLoading: boolean;
  onAddCamera: (nvrId: string) => void; onEditCamera: (c: CameraType) => void; onDeleteCamera: (id: string) => void;
  canCreateCamera: boolean; canEditCamera: boolean; canDeleteCamera: boolean;
}) {
  return (
    <div className="p-4 bg-muted/5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">NVR Devices</span>
        {canCreate && (
          <button onClick={onAddNvr} className="inline-flex items-center gap-1 text-xs px-2 h-7 rounded-md bg-primary text-primary-foreground hover:opacity-90">
            <Plus className="w-3 h-3" /> Add NVR
          </button>
        )}
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground py-2">Loading...</div>
      ) : !nvrs?.length ? (
        <div className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
          <Monitor className="w-6 h-6 mx-auto mb-1 opacity-40" />
          No NVRs. Click &quot;Add NVR&quot; to add one.
        </div>
      ) : (
        <div className="space-y-2">
          {nvrs.map((nvr) => {
            const isNvrOpen = selectedNvrId === nvr.id;
            return (
              <div key={nvr.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button onClick={() => onSelectNvr(isNvrOpen ? null : nvr.id)} className="w-full flex items-center justify-between p-3 hover:bg-muted/20 text-left">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{nvr.nvr_name}</span>
                    <span className="text-xs text-muted-foreground">{nvr.ip}:{nvr.port}</span>
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{nvr.camera_count} cameras</span>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {canEdit && <button onClick={() => onEditNvr(nvr)} className="p-1 rounded-md hover:bg-muted"><Pencil className="w-3.5 h-3.5" /></button>}
                    {canDelete && <button onClick={() => onDeleteNvr(nvr.id)} className="p-1 rounded-md hover:bg-destructive/15 text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                </button>
                {isNvrOpen && (
                  <CameraTable
                    nvrId={nvr.id}
                    cameras={cameras}
                    loading={camerasLoading}
                    onAdd={() => onAddCamera(nvr.id)}
                    onEdit={onEditCamera}
                    onDelete={onDeleteCamera}
                    canCreate={canCreateCamera}
                    canEdit={canEditCamera}
                    canDelete={canDeleteCamera}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CameraTable({ nvrId, cameras, loading, onAdd, onEdit, onDelete, canCreate, canEdit, canDelete }: {
  nvrId: string; cameras?: CameraType[]; loading: boolean;
  onAdd: () => void; onEdit: (c: CameraType) => void; onDelete: (id: string) => void;
  canCreate: boolean; canEdit: boolean; canDelete: boolean;
}) {
  const nvrCameras = cameras?.filter((c) => c.nvr_id === nvrId) ?? [];
  return (
    <div className="border-t border-border p-3 bg-muted/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Cameras</span>
        {canCreate && (
          <button onClick={onAdd} className="inline-flex items-center gap-1 text-xs px-2 h-6 rounded-md bg-primary text-primary-foreground hover:opacity-90">
            <Plus className="w-3 h-3" /> Add
          </button>
        )}
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground py-2">Loading...</div>
      ) : !nvrCameras.length ? (
        <div className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
          <Camera className="w-5 h-5 mx-auto mb-1 opacity-40" />
          No cameras
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left px-2 py-1.5 font-medium">Camera</th>
                <th className="text-left px-2 py-1.5 font-medium">CH</th>
                <th className="text-left px-2 py-1.5 font-medium">Zone</th>
                <th className="text-left px-2 py-1.5 font-medium">Purpose</th>
                <th className="text-right px-2 py-1.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {nvrCameras.map((cam) => (
                <tr key={cam.id} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-2 py-1.5">{cam.camera}</td>
                  <td className="px-2 py-1.5"><span className="bg-muted px-1.5 py-0.5 rounded font-mono">{cam.channel}</span></td>
                  <td className="px-2 py-1.5">{cam.zone || "—"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground max-w-[150px] truncate">{cam.purpose || "—"}</td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    {canEdit && <button onClick={() => onEdit(cam)} className="p-1 rounded-md hover:bg-muted inline-flex"><Pencil className="w-3 h-3" /></button>}
                    {canDelete && <button onClick={() => onDelete(cam.id)} className="p-1 rounded-md hover:bg-destructive/15 text-destructive inline-flex"><Trash2 className="w-3 h-3" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
