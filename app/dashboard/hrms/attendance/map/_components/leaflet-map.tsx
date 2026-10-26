"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// React's dev-mode background-tab reappear can re-attach a Leaflet map's DOM
// container to a fresh Map instance without the previous instance's cleanup
// (Map.remove()) running first, leaving a stale `_leaflet_id` on the element.
// Clear it before Leaflet's init check so remounting doesn't throw
// "Map container is already initialized".
type LeafletContainer = HTMLElement & { _leaflet_id?: number };
type MapProto = { _initContainer: (id: string | HTMLElement) => void };
const originalInitContainer = (L.Map.prototype as unknown as MapProto)._initContainer;
(L.Map.prototype as unknown as MapProto)._initContainer = function (this: L.Map, id: string | HTMLElement) {
  const container = (typeof id === "string" ? document.getElementById(id) : id) as LeafletContainer | null;
  if (container?._leaflet_id) delete container._leaflet_id;
  return originalInitContainer.call(this, id);
};

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function dotIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.25)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const OFFICE_ICON = dotIcon("#4f46e5");
const ZONE_COLORS: Record<string, string> = {
  office: "#16a34a",
  remote: "#d97706",
  unknown: "#6b7280",
};
const ZONE_ICONS: Record<string, L.DivIcon> = {
  office: dotIcon(ZONE_COLORS.office),
  remote: dotIcon(ZONE_COLORS.remote),
  unknown: dotIcon(ZONE_COLORS.unknown),
};

/** Recenters the map whenever `center` changes (MapContainer's center prop only applies on mount). */
function RecenterOnChange({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);
  return null;
}

function ClickToMove({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onMove(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

// ── Office location picker (used in Office Locations config dialog) ─────────

export function OfficeLocationPicker({
  latitude,
  longitude,
  radiusMeters,
  onChange,
}: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const center: [number, number] = [latitude, longitude];
  return (
    <MapContainer center={center} zoom={16} style={{ height: "320px", width: "100%", borderRadius: "0.75rem" }}>
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
      <Marker position={center} icon={OFFICE_ICON} />
      <Circle center={center} radius={radiusMeters} pathOptions={{ color: "#4f46e5", fillOpacity: 0.1 }} />
      <ClickToMove onMove={onChange} />
      <RecenterOnChange center={center} />
    </MapContainer>
  );
}

// ── Live attendance map (Office Locations + employee punches) ───────────────

export interface PunchMarker {
  id: string;
  latitude: number;
  longitude: number;
  zone: "office" | "remote" | null;
  label: string;
  detail: string;
}

export interface OfficeMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

export function AttendanceMapView({
  offices,
  markers,
  center,
  zoom,
}: {
  offices: OfficeMarker[];
  markers: PunchMarker[];
  center: [number, number];
  zoom: number;
}) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height: "420px", width: "100%", borderRadius: "0.75rem" }}>
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />

      {offices.flatMap((o) => [
        <Marker key={`${o.id}-marker`} position={[o.latitude, o.longitude]} icon={OFFICE_ICON}>
          <Popup>
            <strong>{o.name}</strong>
            <br />Office location (radius {o.radius_meters}m)
          </Popup>
        </Marker>,
        <Circle key={`${o.id}-circle`} center={[o.latitude, o.longitude]} radius={o.radius_meters} pathOptions={{ color: "#4f46e5", fillOpacity: 0.06 }} />,
      ])}

      {markers.map((m) => (
        <Marker key={m.id} position={[m.latitude, m.longitude]} icon={ZONE_ICONS[m.zone ?? "unknown"]}>
          <Popup>
            <strong>{m.label}</strong>
            <br />{m.detail}
          </Popup>
        </Marker>
      ))}

      <RecenterOnChange center={center} zoom={zoom} />
    </MapContainer>
  );
}
