import type { ApprovalQuery, SortField } from "../dataClient";
import { APPROVAL, APPROVAL_NAV } from "./dataverse";

const LIST_SELECT = [APPROVAL.id, APPROVAL.title, APPROVAL.result, APPROVAL.statuscode, APPROVAL.createdOn];

const SORT_COLUMNS: Record<SortField, string> = {
  title: APPROVAL.title,
  status: APPROVAL.statuscode,
  createdOn: APPROVAL.createdOn,
};

/** Query options (`?$select=...&$orderby=...`) for the first page of the Approvals list. */
export function buildListOptions(query: ApprovalQuery): string {
  const sort = query.sort ?? { field: "createdOn", descending: true };
  const params = [`$select=${LIST_SELECT.join(",")}`, `$orderby=${SORT_COLUMNS[sort.field]} ${sort.descending ? "desc" : "asc"}`];
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
