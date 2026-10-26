"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Fingerprint, Plus, Pencil, Trash2, RefreshCw, Wifi, MapPin, History, ScrollText,
  CheckCircle2, XCircle, AlertTriangle, Clock, Loader2,
} from "lucide-react";
import { HRGuard } from "@/components/hrms/hr-guard";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

interface Device {
  id: string;
  device_name: string;
  device_model: string | null;
  serial_number: string | null;
  ip_address: string | null;
  port: number | null;
  location: string | null;
  status: string;
  sync_interval_minutes: number;
  last_sync_at: string | null;
  last_sync_status: string | null;
  notes: string | null;
}

interface SyncLog {
  id: string;
  device_id: string;
  sync_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  records_fetched: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  error_message: string | null;
  hr_biometric_devices: { device_name: string; device_model: string | null } | null;
}

interface AuditLog {
  id: string;
  entity_type: string;
  action: string;
  description: string | null;
  performed_by_profile: { full_name: string; avatar_url: string | null } | null;
  created_at: string;
}

// ── Shared helpers ────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtRelative(iso: string | null) {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function fmtDuration(start: string, end: string | null) {
  if (!end) return "—";
  const secs = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

const DEVICE_STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  maintenance: "bg-amber-100 text-amber-700",
};

const SYNC_STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  success: { label: "Success", className: "bg-green-100 text-green-700", icon: CheckCircle2 },
  partial: { label: "Partial", className: "bg-amber-100 text-amber-700", icon: AlertTriangle },
  failed: { label: "Failed", className: "bg-red-100 text-red-700", icon: XCircle },
  running: { label: "Running", className: "bg-blue-100 text-blue-700", icon: Loader2 },
};

function SyncStatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="secondary" className="text-[10px]">Never synced</Badge>;
  const cfg = SYNC_STATUS_CONFIG[status] ?? { label: status, className: "bg-gray-100 text-gray-600", icon: Clock };
  const Icon = cfg.icon;
  return <Badge className={cn("text-[10px] gap-1", cfg.className)}><Icon className={cn("h-3 w-3", status === "running" && "animate-spin")} />{cfg.label}</Badge>;
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function BiometricDevicesPage() {
  return (
    <HRGuard>
      <BiometricContent />
    </HRGuard>
  );
}

function BiometricContent() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    try {
      const res = await fetch("/api/hrms/attendance/biometric/devices");
      const json = await res.json();
      if (res.ok) setDevices(json.devices ?? []);
      else toast.error(json.error ?? "Failed to load devices");
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const summary = useMemo(() => {
    const total = devices.length;
    const active = devices.filter((d) => d.status === "active").length;
    const failedLastSync = devices.filter((d) => d.last_sync_status === "failed").length;
    const lastSyncAt = devices.reduce<string | null>((latest, d) => {
      if (!d.last_sync_at) return latest;
      if (!latest || d.last_sync_at > latest) return d.last_sync_at;
      return latest;
    }, null);
    return { total, active, failedLastSync, lastSyncAt };
  }, [devices]);

  return (
    <div className="space-y-6">
      <PageHeader title="Biometric Devices" subtitle="Device registry, sync monitoring, and audit trail" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={Fingerprint} label="Total Devices" value={String(summary.total)} />
        <SummaryCard icon={CheckCircle2} label="Active" value={String(summary.active)} accent="text-green-600" />
        <SummaryCard icon={XCircle} label="Failed Last Sync" value={String(summary.failedLastSync)} accent={summary.failedLastSync > 0 ? "text-red-600" : "text-gray-400"} />
        <SummaryCard icon={Clock} label="Last Sync" value={fmtRelative(summary.lastSyncAt)} />
      </div>

      <Tabs defaultValue="devices" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="sync-logs">Sync Logs</TabsTrigger>
          <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="devices"><DevicesTab devices={devices} loading={loadingDevices} reload={loadDevices} /></TabsContent>
        <TabsContent value="sync-logs"><SyncLogsTab devices={devices} /></TabsContent>
        <TabsContent value="audit-logs"><AuditLogsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, accent }: { icon: typeof Fingerprint; label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
      <div className={cn("h-9 w-9 rounded-lg bg-gray-50 flex items-center justify-center", accent)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <p className={cn("text-sm font-semibold text-gray-900", accent)}>{value}</p>
        <p className="text-[11px] text-gray-400">{label}</p>
      </div>
    </div>
  );
}

// ── Devices Tab ───────────────────────────────────────────────────────────

const EMPTY_DEVICE_FORM = {
  device_name: "",
  device_model: "",
  serial_number: "",
  ip_address: "",
  port: "4370",
  location: "",
  status: "inactive",
  sync_interval_minutes: "30",
  notes: "",
};

function DevicesTab({ devices, loading, reload }: { devices: Device[]; loading: boolean; reload: () => Promise<void> }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Device | null>(null);
  const [form, setForm] = useState(EMPTY_DEVICE_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_DEVICE_FORM);
    setDialogOpen(true);
  }

  function openEdit(device: Device) {
    setEditTarget(device);
    setForm({
      device_name: device.device_name,
      device_model: device.device_model ?? "",
      serial_number: device.serial_number ?? "",
      ip_address: device.ip_address ?? "",
      port: device.port ? String(device.port) : "",
      location: device.location ?? "",
      status: device.status,
      sync_interval_minutes: String(device.sync_interval_minutes),
      notes: device.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.device_name.trim()) { toast.error("Device name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        device_name: form.device_name.trim(),
        device_model: form.device_model.trim(),
        serial_number: form.serial_number.trim(),
        ip_address: form.ip_address.trim(),
        port: form.port ? Number(form.port) : null,
        location: form.location.trim(),
        status: form.status,
        sync_interval_minutes: Number(form.sync_interval_minutes) || 30,
        notes: form.notes.trim(),
      };

      const url = editTarget ? `/api/hrms/attendance/biometric/devices/${editTarget.id}` : "/api/hrms/attendance/biometric/devices";
      const method = editTarget ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save device");

      toast.success(editTarget ? "Device updated" : "Device registered");
      setDialogOpen(false);
      reload();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/hrms/attendance/biometric/devices/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to remove device");
      toast.success("Device removed");
      setDeleteTarget(null);
      reload();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  async function syncNow(device: Device) {
    setSyncingId(device.id);
    try {
      const res = await fetch(`/api/hrms/attendance/biometric/devices/${device.id}/sync`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sync failed to start");

      const log = json.sync_log;
      if (log.status === "success") toast.success(`Sync completed for "${device.device_name}"`);
      else toast.error(log.error_message ?? `Sync failed for "${device.device_name}"`);

      reload();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Device</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-44 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <Fingerprint className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No biometric devices registered</p>
          <p className="text-sm text-gray-400 mb-4">Register a device to start monitoring attendance sync.</p>
          <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add Device</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {devices.map((device) => (
            <div key={device.id} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Fingerprint className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(device)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteTarget(device)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">{device.device_name}</h3>
                <Badge className={cn("text-[10px]", DEVICE_STATUS_STYLE[device.status] ?? "bg-gray-100 text-gray-600")}>{device.status}</Badge>
              </div>

              <p className="text-sm text-gray-500">{device.device_model || "Model not set"}</p>
              {device.serial_number && <p className="text-xs text-gray-400">SN: {device.serial_number}</p>}

              <div className="flex flex-col gap-1 mt-3 text-xs text-gray-500">
                {device.ip_address && (
                  <span className="flex items-center gap-1.5"><Wifi className="h-3.5 w-3.5 text-gray-400" />{device.ip_address}{device.port ? `:${device.port}` : ""}</span>
                )}
                {device.location && (
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-gray-400" />{device.location}</span>
                )}
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5">
                  <SyncStatusBadge status={device.last_sync_status} />
                  <span className="text-[11px] text-gray-400">{fmtRelative(device.last_sync_at)}</span>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 h-7" onClick={() => syncNow(device)} disabled={syncingId === device.id}>
                  <RefreshCw className={cn("h-3.5 w-3.5", syncingId === device.id && "animate-spin")} />
                  {syncingId === device.id ? "Syncing…" : "Sync Now"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Device" : "Register Device"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Device Name *</Label>
              <Input placeholder="e.g. Main Gate Scanner" value={form.device_name} onChange={(e) => setForm({ ...form, device_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Device Model</Label>
                <Input placeholder="e.g. GEON X990" value={form.device_model} onChange={(e) => setForm({ ...form, device_model: e.target.value })} />
              </div>
              <div>
                <Label>Serial Number</Label>
                <Input placeholder="e.g. SN-12345" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>IP Address</Label>
                <Input placeholder="e.g. 192.168.1.150" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} />
              </div>
              <div>
                <Label>Port</Label>
                <Input type="number" placeholder="4370" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <Input placeholder="e.g. Main Office - Reception" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sync Interval (minutes)</Label>
                <Input type="number" min="1" value={form.sync_interval_minutes} onChange={(e) => setForm({ ...form, sync_interval_minutes: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes about this device" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editTarget ? "Update" : "Register"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Remove Device?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">
            <span className="font-medium text-gray-900">{deleteTarget?.device_name}</span> and its sync history will be permanently removed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>{deleting ? "Removing…" : "Remove"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sync Logs Tab ─────────────────────────────────────────────────────────

function SyncLogsTab({ devices }: { devices: Device[] }) {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (deviceFilter !== "all") params.set("device_id", deviceFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/hrms/attendance/biometric/sync-logs?${params.toString()}`);
      const json = await res.json();
      if (res.ok) setLogs(json.sync_logs ?? []);
      else toast.error(json.error ?? "Failed to load sync logs");
    } finally {
      setLoading(false);
    }
  }, [deviceFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={deviceFilter} onValueChange={setDeviceFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All devices" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All devices</SelectItem>
            {devices.map((d) => <SelectItem key={d.id} value={d.id}>{d.device_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="running">Running</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Device</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Started</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Duration</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Records (F/C/U/X)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No sync runs yet</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className={cn("border-b border-gray-50 hover:bg-gray-50", log.status === "failed" && "bg-red-50/40")}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{log.hr_biometric_devices?.device_name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{log.hr_biometric_devices?.device_model ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-600 capitalize">{log.sync_type}</td>
                    <td className="px-4 py-3"><SyncStatusBadge status={log.status} /></td>
                    <td className="px-4 py-3 text-gray-600">{fmtDateTime(log.started_at)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-600">{fmtDuration(log.started_at, log.completed_at)}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                      {log.records_fetched}/{log.records_created}/{log.records_updated}/{log.records_failed}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[280px]">
                      {log.error_message ?? <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Audit Logs Tab ────────────────────────────────────────────────────────

function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hrms/attendance/biometric/audit-logs");
      const json = await res.json();
      if (res.ok) setLogs(json.audit_logs ?? []);
      else toast.error(json.error ?? "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">When</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Entity</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">No audit activity yet</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDateTime(log.created_at)}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant="secondary" className="text-[10px]">{log.entity_type.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-700 capitalize whitespace-nowrap">{log.action.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-gray-600">{log.description ?? "—"}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-gray-600">{log.performed_by_profile?.full_name ?? "System"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && logs.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
          <History className="h-3.5 w-3.5" />Showing the most recent {logs.length} entries
          <ScrollText className="h-3.5 w-3.5 ml-auto" />
        </div>
      )}
    </div>
  );
}
