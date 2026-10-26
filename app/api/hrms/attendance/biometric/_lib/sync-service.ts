import { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "../../_lib/helpers";

export { writeAuditLog };

export interface BiometricDevice {
  id: string;
  workspace_id: string;
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

export interface SyncResult {
  status: "success" | "partial" | "failed";
  records_fetched: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  error_message: string | null;
}

type DeviceAdapter = (device: BiometricDevice) => Promise<SyncResult>;

/**
 * Device-model -> sync adapter registry. Empty by design — Prompt 2 builds the
 * generic architecture only. Prompt 3 (GEON Integration) registers a real
 * adapter here once the device model/API is known.
 */
const DEVICE_ADAPTERS: Record<string, DeviceAdapter> = {};

/**
 * Runs a sync for a device: opens a sync log, dispatches to the registered
 * adapter (if any), records the outcome on the log + device, and writes an
 * audit trail entry. With no adapters registered, every sync completes as
 * `failed` with a "no adapter configured" message — this is expected until
 * Prompt 3 wires up a real device.
 */
export async function runDeviceSync(
  admin: SupabaseClient,
  workspaceId: string,
  device: BiometricDevice,
  triggeredBy: string,
  syncType: "manual" | "scheduled" = "manual"
) {
  const { data: syncLog, error: insertError } = await admin
    .from("hr_biometric_sync_logs")
    .insert({
      workspace_id: workspaceId,
      device_id: device.id,
      sync_type: syncType,
      status: "running",
      triggered_by: triggeredBy,
    })
    .select("*")
    .single();

  if (insertError || !syncLog) throw new Error(insertError?.message ?? "Failed to start sync");

  await writeAuditLog(admin, workspaceId, {
    entity_type: "biometric_device",
    entity_id: device.id,
    action: "sync_triggered",
    description: `${syncType === "manual" ? "Manual" : "Scheduled"} sync started for "${device.device_name}"`,
    performed_by: triggeredBy,
  });

  const adapter = device.device_model ? DEVICE_ADAPTERS[device.device_model.toUpperCase()] : undefined;

  let result: SyncResult;
  if (!adapter) {
    result = {
      status: "failed",
      records_fetched: 0,
      records_created: 0,
      records_updated: 0,
      records_failed: 0,
      error_message: `No integration adapter configured for device model "${device.device_model || "unspecified"}". Device-specific sync arrives with Prompt 3 (GEON Integration).`,
    };
  } else {
    try {
      result = await adapter(device);
    } catch (e) {
      result = {
        status: "failed",
        records_fetched: 0,
        records_created: 0,
        records_updated: 0,
        records_failed: 0,
        error_message: (e as Error).message,
      };
    }
  }

  const completedAt = new Date().toISOString();

  const { data: updatedLog, error: updateError } = await admin
    .from("hr_biometric_sync_logs")
    .update({
      status: result.status,
      completed_at: completedAt,
      records_fetched: result.records_fetched,
      records_created: result.records_created,
      records_updated: result.records_updated,
      records_failed: result.records_failed,
      error_message: result.error_message,
    })
    .eq("id", syncLog.id)
    .select("*")
    .single();

  if (updateError) throw new Error(updateError.message);

  await admin
    .from("hr_biometric_devices")
    .update({ last_sync_at: completedAt, last_sync_status: result.status, updated_at: completedAt })
    .eq("id", device.id);

  await writeAuditLog(admin, workspaceId, {
    entity_type: "biometric_device",
    entity_id: device.id,
    action: `sync_${result.status}`,
    description:
      result.error_message ??
      `Sync completed for "${device.device_name}" (${result.records_created} created, ${result.records_updated} updated)`,
    changes: result as unknown as Record<string, unknown>,
    performed_by: triggeredBy,
  });

  return updatedLog;
}
