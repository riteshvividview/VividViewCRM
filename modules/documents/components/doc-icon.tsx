"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faFile, faFileLines, faHandshake, faListCheck, faChartColumn, faLightbulb,
  faNoteSticky, faClipboard, faLink, faBullseye, faThumbtack, faBolt,
} from "@fortawesome/free-solid-svg-icons";

/** Document icons, stored by name in documents.icon (names kept compatible with older values). */
const DOC_ICONS: Record<string, IconDefinition> = {
  File: faFile, FileText: faFileLines, Handshake: faHandshake, ListChecks: faListCheck, BarChart2: faChartColumn,
  Lightbulb: faLightbulb, Note: faNoteSticky, Clipboard: faClipboard, Link: faLink, Target: faBullseye, Pin: faThumbtack, Bolt: faBolt,
};

export const DOC_ICON_KEYS = Object.keys(DOC_ICONS);

/** Unknown / legacy values (e.g. old emoji) fall back to a plain file icon. */
export function DocIcon({ name, className }: { name?: string | null; className?: string }) {
  return <FontAwesomeIcon icon={(name && DOC_ICONS[name]) || faFile} className={className ?? "h-5 w-5 text-muted-foreground"} />;
}
