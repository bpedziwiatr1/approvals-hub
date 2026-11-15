import type { ApprovalStatus } from "../data/dataClient";

/** What the user can change in the filter bar; the only filter state that lives in the URL. */
export interface Filters {
  title: string;
  statuses: ApprovalStatus[];
}

export const STATUS_ORDER: readonly ApprovalStatus[] = ["pending", "approved", "rejected", "completed", "cancelled", "expired", "abandoned"];

const isStatus = (value: string): value is ApprovalStatus => (STATUS_ORDER as readonly string[]).includes(value);

export function readFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const statuses = (params.get("status") ?? "").split(",").filter(isStatus);
  return { title: params.get("q") ?? "", statuses: [...new Set(statuses)] };
}

/** Returns `search` with the filter parameters replaced; every other parameter is kept. */
export function writeFilters(search: string, filters: Filters): string {
  const params = new URLSearchParams(search);
  params.delete("q");
  params.delete("status");
  if (filters.title) params.set("q", filters.title);
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  const written = params.toString();
  return written ? `?${written}` : "";
}
