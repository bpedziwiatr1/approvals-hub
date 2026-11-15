import type { RecordRef } from "./dataClient";

/** The Approval fields a Regarding Record can be read from. */
export interface RegardingSource {
  itemLink?: string | null;
  /** Markdown or HTML, as written by the flow. */
  details?: string | null;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const URL_IN_TEXT = /https?:\/\/[^\s<>"'()[\]]+/gi;
const PLACEHOLDER_BASE = "https://placeholder.invalid";

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw.trim(), PLACEHOLDER_BASE);
  } catch {
    return null;
  }
}

/** A Dataverse record link carries `etn`; null when it does not, undefined-free result otherwise. */
function recordLink(url: URL): { hasEtn: boolean; ref: RecordRef | null } {
  const etn = url.searchParams.get("etn")?.trim() ?? "";
  if (!url.searchParams.has("etn")) return { hasEtn: false, ref: null };
  const id = (url.searchParams.get("id") ?? "").trim().replace(/^\{|\}$/g, "");
  if (!etn || !GUID.test(id)) return { hasEtn: true, ref: null };
  return { hasEtn: true, ref: { entityName: etn.toLowerCase(), entityId: id.toLowerCase() } };
}

function decodeEntities(text: string): string {
  return text.replaceAll("&amp;", "&").replaceAll("&#38;", "&");
}

/**
 * Finds the Regarding Record of an Approval: its item link first; otherwise the first Dataverse record link
 * (a link with `etn`) in the details, whether markdown link, HTML anchor or bare URL. A record link whose id
 * is empty or not a GUID resolves to nothing.
 */
export function resolveRegarding(approval: RegardingSource): RecordRef | null {
  if (approval.itemLink) {
    const url = parseUrl(decodeEntities(approval.itemLink));
    const ref = url && recordLink(url).ref;
    if (ref) return ref;
  }
  for (const match of decodeEntities(approval.details ?? "").matchAll(URL_IN_TEXT)) {
    const url = parseUrl(match[0].replace(/[.,;:!?]+$/, ""));
    if (!url) continue;
    const { hasEtn, ref } = recordLink(url);
    if (hasEtn) return ref;
  }
  return null;
}
