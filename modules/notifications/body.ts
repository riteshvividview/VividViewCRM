/**
 * A notification's body can carry "this message had files" as a trailing marker,
 * so the bell and the popup can show an attachment badge next to the text.
 * Example: "Here you go\n[[attachments:2|Resume.pdf]]"
 */
const MARKER = /\n?\[\[attachments:(\d+)\|([^\]]*)\]\]$/;

export function withAttachments(text: string, fileNames: string[]): string {
  if (!fileNames.length) return text;
  return `${text}\n[[attachments:${fileNames.length}|${fileNames[0].replace(/[\[\]|]/g, " ").slice(0, 80)}]]`;
}

export function parseNotificationBody(body: string | null | undefined): { text: string; attachments: { count: number; name: string } | null } {
  const raw = body ?? "";
  const m = MARKER.exec(raw);
  if (!m) return { text: raw, attachments: null };
  return { text: raw.slice(0, m.index).trim(), attachments: { count: Number(m[1]), name: m[2].trim() } };
}

/** "Resume.pdf" or "Resume.pdf +2" */
export function attachmentLabel(a: { count: number; name: string }): string {
  return a.count > 1 ? `${a.name || "Files"} +${a.count - 1}` : a.name || "1 file";
}
