"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Building2, ChevronLeft, ChevronRight, Crosshair, Pencil, Plus, Trash2 } from "lucide-react";
import { HRGuard } from "@/components/hrms/hr-guard";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { OfficeMarker, PunchMarker } from "./_components/leaflet-map";

function MapSkeleton({ height }: { height: string }) {
  return <div className="rounded-xl bg-gray-100 animate-pulse" style={{ height }} />;
}

const OfficeLocationPicker = dynamic(
  () => import("./_components/leaflet-map").then((m) => m.OfficeLocationPicker),
  { ssr: false, loading: () => <MapSkeleton height="320px" /> }
);
const AttendanceMapView = dynamic(
  () => import("./_components/leaflet-map").then((m) => m.AttendanceMapView),
  { ssr: false, loading: () => <MapSkeleton height="420px" /> }
);

// ── Types ─────────────────────────────────────────────────────────────────

interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_default: boolean;
}

interface PunchLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address: string | null;
  captured_at: string;
  distance_meters: number | null;
  zone: "office" | "remote" | null;
}

interface PunchRecord {
  attendance_id: string;
  employee_id: string;
  employee: {
    employee_code: string;
    designation: string | null;
    profiles: { full_name: string; avatar_url: string | null } | null;
  } | null;
  status: string;
  work_mode: string;
  check_in: string | null;
  check_out: string | null;
  check_in_location: PunchLocation | null;
  check_out_location: PunchLocation | null;
}

interface GeoReportEmployee {
  id: string;
  employee_code: string;
  designation: string | null;
  department: { name: string } | null;
  profile: { full_name: string; avatar_url: string | null } | null;
}

interface GeoReportSummaryRow {
  employee: GeoReportEmployee;
  gps_days: number;
  office_days: number;
  remote_days: number;
  no_zone_days: number;
  remote_percentage: number;
  avg_distance_meters: number | null;
}

interface GeoReportRemoteRecord {
  attendance_id: string;
  date: string;
  employee: GeoReportEmployee | null;
  status: string;
  check_in: string | null;
  check_out: string | null;
  check_in_zone: "office" | "remote" | null;
  check_out_zone: "office" | "remote" | null;
  distance_meters: number | null;
  address: string | null;
}

interface GeoReportTotals {
  gps_days: number;
  office_days: number;
  remote_days: number;
  remote_percentage: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function currentISTMonth() {
  const [y, m] = istToday().split("-").map(Number);
  return { year: y, month: m };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
}

function fmtDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_STYLE: Record<string, string> = {
  present: "bg-green-100 text-green-700",
  late: "bg-yellow-100 text-yellow-700",
  half_day: "bg-orange-100 text-orange-700",
  work_from_home: "bg-purple-100 text-purple-700",
  on_leave: "bg-blue-100 text-blue-700",
  holiday: "bg-pink-100 text-pink-700",
  weekend: "bg-gray-100 text-gray-600",
  absent: "bg-red-100 text-red-700",
};

const ZONE_BADGE: Record<string, { label: string; className: string }> = {
  office: { label: "Office", className: "bg-green-100 text-green-700" },
  remote: { label: "Remote", className: "bg-amber-100 text-amber-700" },
};

function ZoneBadge({ zone }: { zone: "office" | "remote" | null | undefined }) {
  if (!zone) return <Badge variant="secondary" className="text-[10px]">No GPS</Badge>;
  const cfg = ZONE_BADGE[zone];
  return <Badge className={cn("text-[10px]", cfg.className)}>{cfg.label}</Badge>;
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function AttendanceMapPage() {
  return (
    <HRGuard>
      <AttendanceMapContent />
    </HRGuard>
  );
}

function AttendanceMapContent() {
  return (
    <div className="space-y-6">
      <PageHeader title="Attendance Map" subtitle="GPS punch locations and office geofence configuration" />

      <Tabs defaultValue="live" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="live">Live Map</TabsTrigger>
          <TabsTrigger value="offices">Office Locations</TabsTrigger>
          <TabsTrigger value="geo-report">Geo-Fencing Report</TabsTrigger>
        </TabsList>

        <TabsContent value="live"><LiveMapTab /></TabsContent>
        <TabsContent value="offices"><OfficeLocationsTab /></TabsContent>
        <TabsContent value="geo-report"><GeoFencingReportTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Live Map Tab ─────────────────────────────────────────────────────────────

function LiveMapTab() {
  const [date, setDate] = useState(istToday());
  const [offices, setOffices] = useState<OfficeLocation[]>([]);
  const [punches, setPunches] = useState<PunchRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hrms/attendance/map?date=${date}`);
      const json = await res.json();
      if (res.ok) {
        setOffices(json.offices ?? []);
        setPunches(json.punches ?? []);
      } else {
        toast.error(json.error ?? "Failed to load map data");
      }
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const markers = useMemo<PunchMarker[]>(() => {
    return punches
      .map((p) => {
        const loc = p.check_in_location ?? p.check_out_location;
        if (!loc) return null;
        const name = p.employee?.profiles?.full_name ?? p.employee?.employee_code ?? "Employee";
        const detail = [
          p.check_in ? `In: ${fmtTime(p.check_in)}${p.check_in_location ? ` (${p.check_in_location.zone ?? "unknown"})` : ""}` : null,
          p.check_out ? `Out: ${fmtTime(p.check_out)}${p.check_out_location ? ` (${p.check_out_location.zone ?? "unknown"})` : ""}` : null,
          loc.address,
        ].filter(Boolean).join(" · ");
        return { id: p.attendance_id, latitude: loc.latitude, longitude: loc.longitude, zone: loc.zone, label: name, detail };
      })
      .filter((m): m is PunchMarker => m !== null);
  }, [punches]);

  const officeMarkers = useMemo<OfficeMarker[]>(
    () => offices.map((o) => ({ id: o.id, name: o.name, latitude: o.latitude, longitude: o.longitude, radius_meters: o.radius_meters })),
    [offices]
  );

  const { center, zoom } = useMemo(() => {
    const points: [number, number][] = [
      ...officeMarkers.map((o): [number, number] => [o.latitude, o.longitude]),
      ...markers.map((m): [number, number] => [m.latitude, m.longitude]),
    ];
    if (points.length === 0) return { center: [20.5937, 78.9629] as [number, number], zoom: 4 };
    const avgLat = points.reduce((s, p) => s + p[0], 0) / points.length;
    const avgLng = points.reduce((s, p) => s + p[1], 0) / points.length;
    return { center: [avgLat, avgLng] as [number, number], zoom: 14 };
  }, [officeMarkers, markers]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Label className="text-sm">Date</Label>
          <Input type="date" value={date} max={istToday()} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-600 inline-block" />Office</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-600 inline-block" />Remote</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gray-500 inline-block" />Unknown</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-indigo-600 inline-block" />Office Location</span>
        </div>
      </div>

      {loading ? <MapSkeleton height="420px" /> : <AttendanceMapView offices={officeMarkers} markers={markers} center={center} zoom={zoom} />}

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-4 py-2.5">Employee</th>
              <th className="text-left px-4 py-2.5">Check In</th>
              <th className="text-left px-4 py-2.5">Check Out</th>
              <th className="text-left px-4 py-2.5">Address</th>
              <th className="text-left px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && punches.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No GPS punches recorded for this date.</td></tr>
            )}
            {punches.map((p) => (
              <tr key={p.attendance_id}>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-gray-900">{p.employee?.profiles?.full_name ?? p.employee?.employee_code ?? "—"}</p>
                  <p className="text-xs text-gray-400">{p.employee?.employee_code}</p>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">{fmtTime(p.check_in)} <ZoneBadge zone={p.check_in_location?.zone} /></div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">{fmtTime(p.check_out)} <ZoneBadge zone={p.check_out_location?.zone} /></div>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500 max-w-xs truncate">
                  {(p.check_in_location ?? p.check_out_location)?.address ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <Badge className={cn("text-[10px]", STATUS_STYLE[p.status] ?? "bg-gray-100 text-gray-600")}>{p.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Office Locations Tab ────────────────────────────────────────────────────

const EMPTY_OFFICE_FORM = { name: "", latitude: "20.5937", longitude: "78.9629", radius_meters: "200", is_default: false };

function OfficeLocationsTab() {
  const [locations, setLocations] = useState<OfficeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OfficeLocation | null>(null);
  const [form, setForm] = useState(EMPTY_OFFICE_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OfficeLocation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hrms/attendance/office-locations");
      const json = await res.json();
      if (res.ok) setLocations(json.locations ?? []);
      else toast.error(json.error ?? "Failed to load office locations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_OFFICE_FORM);
    setDialogOpen(true);
  }

  function openEdit(loc: OfficeLocation) {
    setEditTarget(loc);
    setForm({
      name: loc.name,
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      radius_meters: String(loc.radius_meters),
      is_default: loc.is_default,
    });
    setDialogOpen(true);
  }

  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) { toast.error("Geolocation is not supported by your browser"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, latitude: String(pos.coords.latitude), longitude: String(pos.coords.longitude) })),
      () => toast.error("Could not get your current location"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Location name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radius_meters: Number(form.radius_meters) || 200,
        is_default: form.is_default,
      };
      const url = editTarget ? `/api/hrms/attendance/office-locations/${editTarget.id}` : "/api/hrms/attendance/office-locations";
      const method = editTarget ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save office location");

      toast.success(editTarget ? "Office location updated" : "Office location added");
      setDialogOpen(false);
      load();
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
      const res = await fetch(`/api/hrms/attendance/office-locations/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to remove office location");

      toast.success("Office location removed");
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Office Location</Button>
      </div>

      {loading ? (
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
      ) : locations.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No office locations configured</p>
          <p className="text-sm text-gray-400 mb-4">Add your office location to enable Remote Attendance detection.</p>
          <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Add Office Location</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locations.map((loc) => (
            <div key={loc.id} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(loc)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteTarget(loc)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">{loc.name}</h3>
                {loc.is_default && <Badge className="text-[10px] bg-indigo-100 text-indigo-700">Default</Badge>}
              </div>
              <p className="text-sm text-gray-500">{loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}</p>
              <p className="text-xs text-gray-400">Radius: {loc.radius_meters}m</p>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Office Location" : "Add Office Location"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name *</Label>
              <Input placeholder="e.g. Head Office" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Latitude</Label>
                <Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label>Radius (meters)</Label>
                <Input type="number" min="10" value={form.radius_meters} onChange={(e) => setForm({ ...form, radius_meters: e.target.value })} />
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={useCurrentLocation}>
                <Crosshair className="h-4 w-4" />Use My Location
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
              <Label>Set as default office location</Label>
            </div>
            <div>
              <Label className="block mb-1.5">Click on the map to set the exact location</Label>
              <OfficeLocationPicker
                latitude={Number(form.latitude) || 0}
                longitude={Number(form.longitude) || 0}
                radiusMeters={Number(form.radius_meters) || 200}
                onChange={(lat, lng) => setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editTarget ? "Save Changes" : "Add Location"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Office Location</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Remove &quot;{deleteTarget?.name}&quot;? Past punches keep their recorded zone; future punches will no longer be matched against this location.
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

// ── Geo-Fencing Report Tab ───────────────────────────────────────────────────

const EMPTY_TOTALS: GeoReportTotals = { gps_days: 0, office_days: 0, remote_days: 0, remote_percentage: 0 };

function GeoFencingReportTab() {
  const [month, setMonth] = useState(currentISTMonth());
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [summary, setSummary] = useState<GeoReportSummaryRow[]>([]);
  const [remoteRecords, setRemoteRecords] = useState<GeoReportRemoteRecord[]>([]);
  const [totals, setTotals] = useState<GeoReportTotals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("hr_departments").select("id, name").order("name");
      setDepartments(data ?? []);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(month.year), month: String(month.month) });
      if (departmentId !== "all") params.set("department_id", departmentId);
      const res = await fetch(`/api/hrms/attendance/geo-report?${params}`);
      const json = await res.json();
      if (res.ok) {
        setSummary(json.summary ?? []);
        setRemoteRecords(json.remote_records ?? []);
        setTotals(json.totals ?? EMPTY_TOTALS);
      } else {
        toast.error(json.error ?? "Failed to load geo-fencing report");
      }
    } finally {
      setLoading(false);
    }
  }, [month, departmentId]);

  useEffect(() => { load(); }, [load]);

  const cur = currentISTMonth();
  const isCurrentMonth = month.year === cur.year && month.month === cur.month;
  const monthLabel = `${MONTHS[month.month - 1]} ${month.year}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => {
            const d = new Date(m.year, m.month - 2, 1);
            return { year: d.getFullYear(), month: d.getMonth() + 1 };
          })}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-gray-900 w-28 text-center">{monthLabel}</span>
          <Button variant="outline" size="icon" disabled={isCurrentMonth} onClick={() => setMonth((m) => {
            const d = new Date(m.year, m.month, 1);
            return { year: d.getFullYear(), month: d.getMonth() + 1 };
          })}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">GPS-Tagged Days</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{totals.gps_days}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Office Attendance</p>
          <p className="text-2xl font-semibold text-green-700 mt-1">{totals.office_days}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Remote Attendance</p>
          <p className="text-2xl font-semibold text-amber-700 mt-1">{totals.remote_days}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Remote %</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{totals.remote_percentage}%</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Employee</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">GPS Days</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Office</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Remote</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Remote %</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Avg Distance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : summary.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No employees found</td></tr>
              ) : summary.every((r) => r.gps_days === 0) ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No GPS-tagged punches recorded for {monthLabel}</td></tr>
              ) : (
                summary.map((r) => (
                  <tr key={r.employee.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.employee.profile?.full_name ?? r.employee.employee_code}</p>
                      <p className="text-xs text-gray-400">{r.employee.department?.name ?? r.employee.designation ?? ""}</p>
                    </td>
                    <td className="px-3 py-3 text-center text-gray-700">{r.gps_days}</td>
                    <td className="px-3 py-3 text-center text-green-700 font-medium">{r.office_days}</td>
                    <td className="px-3 py-3 text-center text-amber-700 font-medium">{r.remote_days}</td>
                    <td className="px-3 py-3 text-center text-gray-700">{r.gps_days > 0 ? `${r.remote_percentage}%` : "—"}</td>
                    <td className="px-3 py-3 text-center text-gray-500 hidden sm:table-cell">{r.avg_distance_meters !== null ? `${r.avg_distance_meters} m` : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">Remote Attendance Records</h3>
          <p className="text-xs text-gray-400">Punches recorded outside every configured office radius.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Employee</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Check In</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Check Out</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Distance</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Address</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!loading && remoteRecords.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No remote attendance recorded for {monthLabel}.</td></tr>
              )}
              {remoteRecords.map((r) => (
                <tr key={r.attendance_id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{fmtDate(r.date)}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900">{r.employee?.profile?.full_name ?? r.employee?.employee_code ?? "—"}</p>
                    <p className="text-xs text-gray-400">{r.employee?.employee_code}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">{fmtTime(r.check_in)} <ZoneBadge zone={r.check_in_zone} /></div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">{fmtTime(r.check_out)} <ZoneBadge zone={r.check_out_zone} /></div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{r.distance_meters !== null ? `${r.distance_meters} m` : "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 max-w-xs truncate">{r.address ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <Badge className={cn("text-[10px]", STATUS_STYLE[r.status] ?? "bg-gray-100 text-gray-600")}>{r.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
