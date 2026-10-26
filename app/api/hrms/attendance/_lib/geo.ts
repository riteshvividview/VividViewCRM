import type { SupabaseClient } from "@supabase/supabase-js";

// ── Office locations ────────────────────────────────────────────────────────

export interface OfficeLocation {
  id: string;
  workspace_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_default: boolean;
}

export async function getDefaultOfficeLocation(admin: SupabaseClient, workspaceId: string): Promise<OfficeLocation | null> {
  const { data } = await admin
    .from("hr_office_locations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_default", true)
    .maybeSingle();
  return (data as OfficeLocation) ?? null;
}

export async function getOfficeLocations(admin: SupabaseClient, workspaceId: string): Promise<OfficeLocation[]> {
  const { data } = await admin
    .from("hr_office_locations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return (data as OfficeLocation[]) ?? [];
}

// ── Distance ─────────────────────────────────────────────────────────────────

const EARTH_RADIUS_METERS = 6371000;

/** Great-circle distance between two lat/lng points, in meters. */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const a = sinDLat * sinDLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/** Nearest office location to the given point, and the distance to it (meters). Null if none configured. */
export function findNearestOffice(
  offices: OfficeLocation[],
  latitude: number,
  longitude: number
): { office: OfficeLocation; distance_meters: number } | null {
  if (offices.length === 0) return null;
  let best = offices[0];
  let bestDist = haversineMeters(latitude, longitude, best.latitude, best.longitude);
  for (const office of offices.slice(1)) {
    const dist = haversineMeters(latitude, longitude, office.latitude, office.longitude);
    if (dist < bestDist) {
      best = office;
      bestDist = dist;
    }
  }
  return { office: best, distance_meters: Math.round(bestDist) };
}

// ── Reverse geocoding (Nominatim / OpenStreetMap, no API key) ─────────────────

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const REVERSE_GEOCODE_TIMEOUT_MS = 4000;

/** Best-effort human-readable address for a lat/lng. Returns null on any failure (never blocks a punch). */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REVERSE_GEOCODE_TIMEOUT_MS);
    const url = `${NOMINATIM_URL}?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=0`;
    const res = await fetch(url, {
      headers: { "User-Agent": "VividCRM-HRMS/1.0 (attendance geolocation)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json?.display_name === "string" ? json.display_name : null;
  } catch {
    return null;
  }
}

// ── Punch location ──────────────────────────────────────────────────────────

export interface PunchCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

export interface PunchLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address: string | null;
  captured_at: string;
  distance_meters: number | null;
  zone: "office" | "remote" | null;
}

/**
 * Builds the JSONB value stored in hr_attendance.check_in_location / check_out_location.
 * Returns null when the client provided no coordinates (geolocation denied/unavailable) —
 * the punch itself always proceeds regardless.
 */
export async function buildPunchLocation(
  admin: SupabaseClient,
  workspaceId: string,
  coords: PunchCoordinates | null | undefined,
  capturedAtISO: string
): Promise<PunchLocation | null> {
  if (!coords || typeof coords.latitude !== "number" || typeof coords.longitude !== "number") return null;
  if (Number.isNaN(coords.latitude) || Number.isNaN(coords.longitude)) return null;

  const offices = await getOfficeLocations(admin, workspaceId);
  const nearest = findNearestOffice(offices, coords.latitude, coords.longitude);

  let zone: "office" | "remote" | null = null;
  let distance: number | null = null;
  if (nearest) {
    distance = nearest.distance_meters;
    zone = distance <= nearest.office.radius_meters ? "office" : "remote";
  }

  const address = await reverseGeocode(coords.latitude, coords.longitude);

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: typeof coords.accuracy === "number" ? Math.round(coords.accuracy) : null,
    address,
    captured_at: capturedAtISO,
    distance_meters: distance,
    zone,
  };
}
