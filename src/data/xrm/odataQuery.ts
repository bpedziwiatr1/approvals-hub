import type { ApprovalQuery, ApprovalStatus, ProfileScope, SortField } from "../dataClient";
import { APPROVE_RESULTS, DISPLAY_STATUSES, REJECT_RESULTS } from "../displayStatus";
import { APPROVAL, APPROVAL_NAV, REQUEST_STATECODE_ACTIVE } from "./dataverse";

const LIST_SELECT = [APPROVAL.id, APPROVAL.title, APPROVAL.result, APPROVAL.statuscode, APPROVAL.createdOn];

const SORT_COLUMNS: Record<SortField, string> = {
  title: APPROVAL.title,
  status: APPROVAL.statuscode,
  createdOn: APPROVAL.createdOn,
};

const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const statusIs = (code: number) => `${APPROVAL.statuscode} eq ${code}`;
const resultIs = (value: string) => `${APPROVAL.result} eq ${literal(value)}`;
const resultIsNot = (value: string) => `${APPROVAL.result} ne ${literal(value)}`;
const anyOf = (conditions: string[]) => `(${conditions.join(" or ")})`;

/**
 * Condition for one display status (unparenthesised; `and` binds tighter than the `or` joining statuses); the inverse of deriveStatus,
 * built from the same DISPLAY_STATUSES table. String comparisons rely on Dataverse's case-insensitive collation, so `Approve`, `approve` and `Approved` all match.
 */
function statusCondition(status: ApprovalStatus): string {
  const entry = DISPLAY_STATUSES.find((s) => s.status === status)!;
  const codes = entry.statuscodes.map(statusIs).join(" or ");
  if (entry.results === undefined) return codes;
  if (entry.results === "other") {
    const neither = [...APPROVE_RESULTS, ...REJECT_RESULTS].map(resultIsNot).join(" and ");
    return `${codes} and (${APPROVAL.result} eq null or (${neither}))`;
  }
  return `${codes} and ${anyOf(entry.results.map(resultIs))}`;
}

/** GUIDs go into the filter unquoted, so anything else is refused rather than escaped. */
function guid(value: string): string {
  const bare = value.replace(/^\{|\}$/g, "").toLowerCase();
  if (!GUID.test(bare)) throw new Error(`Not a GUID: ${value}`);
  return bare;
}

function isoUtc(value: string): string {
  const time = Date.parse(value);
  if (Number.isNaN(time)) throw new Error(`Not a date: ${value}`);
  return new Date(time).toISOString();
}

/** Approvals with an Approval Request of this user; `activeOnly` keeps requests still waiting for a response. */
const requestOf = (userId: string, activeOnly: boolean) =>
  `${APPROVAL.requests}/any(r:r/${APPROVAL.owner} eq ${guid(userId)}${activeOnly ? ` and r/statecode eq ${REQUEST_STATECODE_ACTIVE}` : ""})`;

/** Conditions of a Profile Scope, one per criterion that is set; they are ANDed by the caller. */
function scopeConditions(scope: ProfileScope): string[] {
  const parts: string[] = [];
  if (scope.title) {
    const { mode, value } = scope.title;
    if (mode === "equals") parts.push(`${APPROVAL.title} eq ${literal(value)}`);
    else if (mode === "startsWith") parts.push(`startswith(${APPROVAL.title},${literal(value)})`);
    else parts.push(`contains(${APPROVAL.title},${literal(value)})`);
  }
  if (scope.category) parts.push(`${APPROVAL.category} eq ${literal(scope.category)}`);
  if (scope.tags) parts.push(`contains(${APPROVAL.tags},${literal(scope.tags)})`);
  return parts;
}

/**
 * `$filter` for the query's Profile Scope and filters, all ANDed; null when nothing narrows the list.
 * `currentUserId` resolves "Assigned to me".
 */
export function buildFilter(query: ApprovalQuery, currentUserId?: string): string | null {
  const parts: string[] = query.scope ? scopeConditions(query.scope) : [];
  if (query.title) parts.push(`contains(${APPROVAL.title},${literal(query.title)})`);
  if (query.statuses?.length) parts.push(`(${query.statuses.map(statusCondition).join(" or ")})`);
  if (query.ownerId) parts.push(`${APPROVAL.owner} eq ${guid(query.ownerId)}`);
  if (query.approverId) parts.push(requestOf(query.approverId, false));
  if (query.assignedToMe) {
    if (!currentUserId) throw new Error("Assigned to me needs the current user");
    parts.push(requestOf(currentUserId, query.assignedToMe.pendingOnly));
  }
  if (query.createdFrom) parts.push(`${APPROVAL.createdOn} ge ${isoUtc(query.createdFrom)}`);
  if (query.createdTo) parts.push(`${APPROVAL.createdOn} le ${isoUtc(query.createdTo)}`);
  return parts.length ? parts.join(" and ") : null;
}

/** Query options (`?$select=...&$filter=...&$orderby=...`) for the first page of the Approvals list. */
export function buildListOptions(query: ApprovalQuery, currentUserId?: string): string {
  const sort = query.sort ?? { field: "createdOn", descending: true };
  const filter = buildFilter(query, currentUserId);
  const params = [`$select=${LIST_SELECT.join(",")}`];
  if (filter) params.push(`$filter=${encodeURIComponent(filter)}`);
  params.push(`$orderby=${SORT_COLUMNS[sort.field]} ${sort.descending ? "desc" : "asc"}`);
  return `?${params.join("&")}`;
}

/** Alias of the row count in the rows `buildCountOptions` asks for. */
export const COUNT_ALIAS = "count";

/**
 * Query options for counting the Approvals that match the list query, in one request: the same filter, grouped by the two columns that decide
 * the display status, with the number of Approvals per group. No rows are paged; the caller maps each group to its status.
 */
export function buildCountOptions(query: ApprovalQuery, currentUserId?: string): string {
  const filter = buildFilter(query, currentUserId);
  const groups = `groupby((${APPROVAL.statuscode},${APPROVAL.result}),aggregate($count as ${COUNT_ALIAS}))`;
  return `?$apply=${encodeURIComponent(filter ? `filter(${filter})/${groups}` : groups)}`;
}

const DETAIL_SELECT = [...LIST_SELECT, APPROVAL.details, APPROVAL.itemLink];

const DETAIL_EXPAND = [
  [APPROVAL_NAV.requests, ["_ownerid_value", "msdyn_flow_approvalrequest_stepnumber", "statuscode"]],
  [
    APPROVAL_NAV.responses,
    ["_ownerid_value", "msdyn_flow_approvalresponse_response", "msdyn_flow_approvalresponse_comments", "msdyn_flow_approvalresponse_stepnumber", "createdon"],
  ],
  [APPROVAL_NAV.steps, ["msdyn_flow_approvalstep_number", "msdyn_flow_approvalstep_result", "msdyn_flow_approvalstep_stage"]],
] as const;

export const GUID = /^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i;

/** Query options for one Approval with its requests, responses and steps; `approvalId` must be a GUID. */
export function buildDetailOptions(approvalId: string): string {
  const expand = DETAIL_EXPAND.map(([nav, fields]) => `${nav}($select=${fields.join(",")})`).join(",");
  return `?$select=${DETAIL_SELECT.join(",")}&$filter=${APPROVAL.id} eq ${approvalId.replace(/[{}]/g, "")}&$expand=${expand}`;
}
