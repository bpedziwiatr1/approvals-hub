import type { ApprovalQuery, ApprovalStatus, SortField } from "../dataClient";
import { APPROVAL, APPROVAL_NAV, APPROVAL_STATUSCODE } from "./dataverse";

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

/** `$filter` for the query's title search and status set; null when nothing narrows the list. */
export function buildFilter(query: ApprovalQuery): string | null {
  const parts: string[] = [];
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

const DETAIL_SELECT = [...LIST_SELECT, APPROVAL.details];

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
