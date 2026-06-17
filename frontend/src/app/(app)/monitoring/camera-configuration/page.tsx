"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, Building2, Monitor, Camera, ArrowLeft } from "lucide-react";
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

  const selectedSite = sites?.find((s) => s.id === selectedSiteId) ?? null;
  const selectedNvr = nvrs?.find((n) => n.id === selectedNvrId) ?? null;

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

  const toggleSite = (id: string) => {
    setSelectedSiteId(selectedSiteId === id ? null : id);
    setSelectedNvrId(null);
  };

  return (
    <div className="flex flex-col h-full">
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
        <div className="grid grid-cols-[380px_1fr] gap-4 flex-1 min-h-0">
          {/* ─── Left Panel: Sites List ─── */}
          <div className="border border-border rounded-2xl bg-card overflow-y-auto">
            <div className="p-3 border-b border-border">
              <span className="text-sm font-medium text-muted-foreground">Sites</span>
            </div>
            {sites.map((site) => (
              <button
                key={site.id}
                onClick={() => toggleSite(site.id)}
                className={`w-full flex items-center gap-3 p-3 text-left border-b border-border/50 hover:bg-muted/30 transition-colors last:border-b-0 ${
                  selectedSiteId === site.id ? "bg-primary/5 ring-1 ring-primary/20" : ""
                }`}
              >
                <Building2 className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{site.name}</div>
                  {site.location && <div className="text-xs text-muted-foreground truncate">{site.location}</div>}
                </div>
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">{site.nvr_count} NVRs</span>
              </button>
            ))}
          </div>

          {/* ─── Right Panel: Detail View ─── */}
          <div className="border border-border rounded-2xl bg-card overflow-y-auto">
            {!selectedSiteId ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
                <Building2 className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Select a site</p>
                <p className="text-sm">Choose a site from the list to view its details</p>
              </div>
            ) : selectedNvrId && selectedNvr ? (
              /* ── NVR Detail View ── */
              <div>
                <div className="p-4 border-b border-border">
                  <button
                    onClick={() => setSelectedNvrId(null)}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to {selectedSite?.name ?? "Site"}
                  </button>

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Monitor className="w-6 h-6 text-muted-foreground" />
                      <div>
                        <h2 className="text-lg font-semibold">{selectedNvr.nvr_name}</h2>
                        <p className="text-sm text-muted-foreground">
                          {selectedNvr.ip}:{selectedNvr.port}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {nvrPerms.update && (
                        <button onClick={() => openEditNvr(selectedNvr)} className="p-1.5 rounded-md hover:bg-muted">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {nvrPerms.delete && (
                        <button onClick={() => handleDeleteNvr(selectedNvr.id)} className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm">
                    <div><span className="text-muted-foreground">Username:</span> {selectedNvr.nvr_username}</div>
                    <div><span className="text-muted-foreground">Site:</span> {selectedNvr.site_name}</div>
                  </div>
                </div>

                {/* Cameras section */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-muted-foreground">Cameras</h3>
                    {cameraPerms.create && (
                      <button onClick={() => openAddCamera(selectedNvr.id)} className="inline-flex items-center gap-1 text-xs px-2 h-7 rounded-md bg-primary text-primary-foreground hover:opacity-90">
                        <Plus className="w-3 h-3" /> Add Camera
                      </button>
                    )}
                  </div>
                  <CameraTable
                    nvrId={selectedNvr.id}
                    cameras={cameras}
                    loading={camerasLoading}
                    onEdit={openEditCamera}
                    onDelete={handleDeleteCamera}
                    canEdit={cameraPerms.update}
                    canDelete={cameraPerms.delete}
                  />
                </div>
              </div>
            ) : (
              /* ── Site Detail View ── */
              <div>
                {selectedSite && (
                  <>
                    <div className="p-4 border-b border-border">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Building2 className="w-6 h-6 text-muted-foreground" />
                          <div>
                            <h2 className="text-lg font-semibold">{selectedSite.name}</h2>
                            {selectedSite.location && (
                              <p className="text-sm text-muted-foreground">{selectedSite.location}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {sitePerms.update && (
                            <button onClick={() => openEditSite(selectedSite)} className="p-1.5 rounded-md hover:bg-muted">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {sitePerms.delete && (
                            <button onClick={() => handleDeleteSite(selectedSite.id)} className="p-1.5 rounded-md hover:bg-destructive/15 text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      {selectedSite.description && (
                        <p className="text-sm text-muted-foreground mt-2">{selectedSite.description}</p>
                      )}
                    </div>

                    {/* NVR list */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-muted-foreground">NVR Devices</h3>
                        {nvrPerms.create && (
                          <button onClick={() => openAddNvr(selectedSite.id)} className="inline-flex items-center gap-1 text-xs px-2 h-7 rounded-md bg-primary text-primary-foreground hover:opacity-90">
                            <Plus className="w-3 h-3" /> Add NVR
                          </button>
                        )}
                      </div>
                      {nvrsLoading ? (
                        <div className="text-sm text-muted-foreground py-6 text-center">Loading...</div>
                      ) : !nvrs?.length ? (
                        <div className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-xl">
                          <Monitor className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          No NVRs for this site
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {nvrs.map((nvr) => (
                            <div
                              key={nvr.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedNvrId(nvr.id)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedNvrId(nvr.id); } }}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors hover:bg-muted/20 cursor-pointer ${
                                selectedNvrId === nvr.id ? "border-primary/30 bg-primary/5" : "border-border"
                              }`}
                            >
                              <Monitor className="w-5 h-5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{nvr.nvr_name}</div>
                                <div className="text-xs text-muted-foreground">{nvr.ip}:{nvr.port}</div>
                              </div>
                              <span className="text-xs bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">{nvr.camera_count} cameras</span>
                              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                {nvrPerms.update && (
                                  <button onClick={() => openEditNvr(nvr)} className="p-1 rounded-md hover:bg-muted">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {nvrPerms.delete && (
                                  <button onClick={() => handleDeleteNvr(nvr.id)} className="p-1 rounded-md hover:bg-destructive/15 text-destructive">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
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

/* ─── Sub-components ─── */

function CameraTable({ nvrId, cameras, loading, onEdit, onDelete, canEdit, canDelete }: {
  nvrId: string; cameras?: CameraType[]; loading: boolean;
  onEdit: (c: CameraType) => void; onDelete: (id: string) => void;
  canEdit: boolean; canDelete: boolean;
}) {
  const nvrCameras = cameras?.filter((c) => c.nvr_id === nvrId) ?? [];

  if (loading) return <div className="text-sm text-muted-foreground py-6 text-center">Loading...</div>;

  if (!nvrCameras.length) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-xl">
        <Camera className="w-8 h-8 mx-auto mb-2 opacity-40" />
        No cameras for this NVR
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase text-muted-foreground border-b border-border">
            <th className="text-left px-3 py-2 font-medium">Camera</th>
            <th className="text-left px-3 py-2 font-medium">Channel</th>
            <th className="text-left px-3 py-2 font-medium">Zone</th>
            <th className="text-left px-3 py-2 font-medium">Purpose</th>
            <th className="text-right px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {nvrCameras.map((cam) => (
            <tr key={cam.id} className="border-b border-border/30 hover:bg-muted/20">
              <td className="px-3 py-2 font-medium">{cam.camera}</td>
              <td className="px-3 py-2">
                <span className="bg-muted px-2 py-0.5 rounded text-xs font-mono">CH {cam.channel}</span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{cam.zone || "—"}</td>
              <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{cam.purpose || "—"}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                {canEdit && (
                  <button onClick={() => onEdit(cam)} className="p-1 rounded-md hover:bg-muted">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => onDelete(cam.id)} className="p-1 rounded-md hover:bg-destructive/15 text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
