import type { ApprovalStatus } from "../data/dataClient";
import { DISPLAY_STATUS_ORDER, isDisplayStatus } from "../data/displayStatus";

/** What the user can change in the filter bar; the only filter state that lives in the URL. */
export interface Filters {
  title: string;
  statuses: ApprovalStatus[];
  /** GUID of the Owner (flow connection user). */
  ownerId?: string;
  /** GUID of an Approver. */
  approverId?: string;
  /** Created-on range as calendar days, `YYYY-MM-DD` (UTC days), both inclusive. */
  createdFrom?: string;
  createdTo?: string;
  assignedToMe?: { pendingOnly: boolean };
}

export const STATUS_ORDER = DISPLAY_STATUS_ORDER;

const isStatus = isDisplayStatus;

const GUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d\d-\d\d$/;

const guidParam = (value: string | null) => (value && GUID.test(value) ? value : undefined);
/** A real calendar day; `2025-13-40` is not one. */
const isDay = (value: string) => DAY.test(value) && new Date(Date.parse(`${value}T00:00:00Z`)).toISOString().startsWith(value);
const dayParam = (value: string | null) => (value && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && isDay(value) ? value : undefined);

export function readFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const statuses = (params.get("status") ?? "").split(",").filter(isStatus);
  const mine = params.get("mine");
  const filters: Filters = { title: params.get("q") ?? "", statuses: [...new Set(statuses)] };
  const ownerId = guidParam(params.get("owner"));
  const approverId = guidParam(params.get("approver"));
  const createdFrom = dayParam(params.get("from"));
  const createdTo = dayParam(params.get("to"));
  if (ownerId) filters.ownerId = ownerId;
  if (approverId) filters.approverId = approverId;
  if (createdFrom) filters.createdFrom = createdFrom;
  if (createdTo) filters.createdTo = createdTo;
  if (mine === "1" || mine === "pending") filters.assignedToMe = { pendingOnly: mine === "pending" };
  return filters;
}

/** Returns `search` with the filter parameters replaced; every other parameter is kept. */
export function writeFilters(search: string, filters: Filters): string {
  const params = new URLSearchParams(search);
  params.delete("q");
  params.delete("status");
  for (const key of ["owner", "approver", "from", "to", "mine"]) params.delete(key);
  if (filters.title) params.set("q", filters.title);
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.ownerId) params.set("owner", filters.ownerId);
  if (filters.approverId) params.set("approver", filters.approverId);
  if (filters.createdFrom) params.set("from", filters.createdFrom);
  if (filters.createdTo) params.set("to", filters.createdTo);
  if (filters.assignedToMe) params.set("mine", filters.assignedToMe.pendingOnly ? "pending" : "1");
  const written = params.toString();
  return written ? `?${written}` : "";
}
