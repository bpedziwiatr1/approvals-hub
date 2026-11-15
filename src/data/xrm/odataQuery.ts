import type { ApprovalQuery, ApprovalStatus, ProfileScope, SortField } from "../dataClient";
import { APPROVAL, APPROVAL_STATUSCODE } from "./dataverse";

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
 * Condition for one display status (unparenthesised; `and` binds tighter than the `or` joining statuses); the inverse of deriveStatus. String comparisons rely on
 * Dataverse's case-insensitive collation, so `Approve`, `approve` and `Approved` all match.
 */
function statusCondition(status: ApprovalStatus): string {
  const { completed } = APPROVAL_STATUSCODE;
  switch (status) {
    case "pending":
      return [APPROVAL_STATUSCODE.created, APPROVAL_STATUSCODE.pending, APPROVAL_STATUSCODE.suspended].map(statusIs).join(" or ");
    case "approved":
      return `${statusIs(completed)} and ${anyOf([resultIs("Approve"), resultIs("Approved")])}`;
    case "rejected":
      return `${statusIs(completed)} and ${anyOf([resultIs("Reject"), resultIs("Rejected")])}`;
    case "completed": {
      const neither = ["Approve", "Approved", "Reject", "Rejected"].map(resultIsNot).join(" and ");
      return `${statusIs(completed)} and (${APPROVAL.result} eq null or (${neither}))`;
    }
    case "cancelled":
      return statusIs(APPROVAL_STATUSCODE.cancelled);
    case "expired":
      return statusIs(APPROVAL_STATUSCODE.expired);
    case "abandoned":
      return statusIs(APPROVAL_STATUSCODE.abandoned);
  }
}

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

/** `$filter` for the query's Profile Scope, title search and status set, all ANDed; null when nothing narrows the list. */
export function buildFilter(query: ApprovalQuery): string | null {
  const parts: string[] = query.scope ? scopeConditions(query.scope) : [];
  if (query.title) parts.push(`contains(${APPROVAL.title},${literal(query.title)})`);
  if (query.statuses?.length) parts.push(`(${query.statuses.map(statusCondition).join(" or ")})`);
  return parts.length ? parts.join(" and ") : null;
}

/** Query options (`?$select=...&$filter=...&$orderby=...`) for the first page of the Approvals list. */
export function buildListOptions(query: ApprovalQuery): string {
  const sort = query.sort ?? { field: "createdOn", descending: true };
  const filter = buildFilter(query);
  const params = [`$select=${LIST_SELECT.join(",")}`];
  if (filter) params.push(`$filter=${encodeURIComponent(filter)}`);
  params.push(`$orderby=${SORT_COLUMNS[sort.field]} ${sort.descending ? "desc" : "asc"}`);
  return `?${params.join("&")}`;
}
