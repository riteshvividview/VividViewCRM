import type { TaskAttachment, TaskFileKind } from "../types";

const SERVER_MAX_BYTES = 25 * 1024 * 1024;

function putWithProgress(url: string, file: File, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(file);
  });
}

/**
 * Uploads one file to a task section. With Cloudflare R2 configured the browser
 * sends the file straight to storage (large videos never pass through the app
 * server); otherwise it falls back to a server upload (25 MB limit).
 */
export async function uploadTaskFile(taskId: string, file: File, kind: TaskFileKind, onProgress?: (pct: number) => void): Promise<TaskAttachment> {
  const base = `/api/tasks/${taskId}/attachments`;
  const json = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const meta = { kind, file_name: file.name, size: file.size, mime: file.type || "application/octet-stream" };

  const pre = await fetch(base, json({ action: "presign", ...meta }));
  const preJson = await pre.json().catch(() => ({}));
  if (!pre.ok) throw new Error(preJson.error ?? "Upload failed");

  if (preJson.mode === "direct") {
    await putWithProgress(preJson.upload_url, file, onProgress);
    const done = await fetch(base, json({ action: "confirm", path: preJson.path, ...meta }));
    const doneJson = await done.json().catch(() => ({}));
    if (!done.ok) throw new Error(doneJson.error ?? "Upload failed");
    return doneJson.attachments[0];
  }

  if (file.size > SERVER_MAX_BYTES) throw new Error(`${file.name} is larger than 25 MB`);
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const res = await fetch(base, { method: "POST", body: form });
  const resJson = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(resJson.error ?? "Upload failed");
  onProgress?.(100);
  return resJson.attachments[0];
}

export async function addTaskLink(taskId: string, url: string, kind: TaskFileKind = "reference"): Promise<TaskAttachment> {
  const res = await fetch(`/api/tasks/${taskId}/attachments`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "link", url, kind }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Could not add link");
  return json.attachments[0];
}

export function formatFileSize(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
