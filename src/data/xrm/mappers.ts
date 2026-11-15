import type { ApprovalDetail, ApprovalListItem, ApprovalResponse, ApprovalStatus, ApprovalStepDetail, Approver } from "../dataClient";
import { resolveRegarding } from "../regarding";
import { APPROVAL, APPROVAL_STATUSCODE, REQUEST_STATUSCODE, type ApprovalRequestRow, type ApprovalResponseRow, type ApprovalRow, type ApprovalStepRow } from "./dataverse";
import type { Entity } from "./xrmTypes";

const APPROVED = new Set(["approve", "approved"]);
const REJECTED = new Set(["reject", "rejected"]);

/**
 * Display status from the stored statuscode and result text. Created and Suspended show as Pending;
 * an unknown statuscode also shows as Pending so the Approval stays visible.
 */
export function deriveStatus(statuscode: number, result: string | null): { status: ApprovalStatus; outcome: string | null } {
  switch (statuscode) {
    case APPROVAL_STATUSCODE.completed: {
      const normalised = result?.trim().toLowerCase() ?? "";
      if (APPROVED.has(normalised)) return { status: "approved", outcome: null };
      if (REJECTED.has(normalised)) return { status: "rejected", outcome: null };
      return { status: "completed", outcome: result?.trim() || null };
    }
    case APPROVAL_STATUSCODE.expired:
      return { status: "expired", outcome: null };
    case APPROVAL_STATUSCODE.cancelled:
      return { status: "cancelled", outcome: null };
    case APPROVAL_STATUSCODE.abandoned:
      return { status: "abandoned", outcome: null };
    default:
      return { status: "pending", outcome: null };
  }
}

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

/** One msdyn_flow_approval row (list columns) to an Approval list item. */
export function mapApprovalListItem(row: Entity): ApprovalListItem {
  const { status, outcome } = deriveStatus(Number(row[APPROVAL.statuscode]), text(row[APPROVAL.result]));
  return {
    id: String(row[APPROVAL.id]),
    title: text(row[APPROVAL.title]) ?? "",
    status,
    outcome,
    createdOn: String(row[APPROVAL.createdOn]),
  };
}

function approverOf(row: ApprovalRequestRow | ApprovalResponseRow): Approver {
  const id = row._ownerid_value;
  return { id, name: row["_ownerid_value@OData.Community.Display.V1.FormattedValue"] || id };
}

function mapResponse(row: ApprovalResponseRow): ApprovalResponse {
  return {
    approver: approverOf(row),
    response: row.msdyn_flow_approvalresponse_response ?? "",
    comments: row.msdyn_flow_approvalresponse_comments || null,
    respondedOn: new Date(row.createdon).toISOString(),
  };
}

/**
 * One msdyn_flow_approval row with its expanded requests, responses and steps to an Approval detail.
 * Rows without a step number belong to step 0; with no Approval Step rows at all, one implicit step is synthesised.
 */
export function mapApprovalDetail(row: ApprovalRow): ApprovalDetail {
  const listItem = mapApprovalListItem(row as unknown as Entity);
  const requests = row.msdyn_flow_approvalrelationship_approvalrequests ?? [];
  const responses = row.msdyn_flow_approvalrelationship_approvalresponses ?? [];
  const stepRows: ApprovalStepRow[] = row.msdyn_flow_approvalrelationship_approvalsteps ?? [];
  const stepOf = (n: number | null) => n ?? 0;

  const numbers = new Set<number>(stepRows.map((s) => s.msdyn_flow_approvalstep_number));
  requests.forEach((r) => numbers.add(stepOf(r.msdyn_flow_approvalrequest_stepnumber)));
  responses.forEach((r) => numbers.add(stepOf(r.msdyn_flow_approvalresponse_stepnumber)));
  if (numbers.size === 0) numbers.add(0);

  const steps: ApprovalStepDetail[] = [...numbers]
    .sort((a, b) => a - b)
    .map((number) => {
      const stepRow = stepRows.find((s) => s.msdyn_flow_approvalstep_number === number);
      const stepResponses = responses.filter((r) => stepOf(r.msdyn_flow_approvalresponse_stepnumber) === number);
      const stepRequests = requests.filter((r) => stepOf(r.msdyn_flow_approvalrequest_stepnumber) === number);
      const responded = new Set(stepResponses.map((r) => r._ownerid_value));
      const unique = (list: Approver[]) => list.filter((a, i) => list.findIndex((b) => b.id === a.id) === i);
      return {
        number,
        implicit: stepRow === undefined && stepRows.length === 0,
        stage: stepRow?.msdyn_flow_approvalstep_stage ?? null,
        result: stepRow?.msdyn_flow_approvalstep_result ?? null,
        responses: stepResponses.map(mapResponse).sort((a, b) => a.respondedOn.localeCompare(b.respondedOn)),
        pendingApprovers:
          listItem.status === "pending"
            ? unique(stepRequests.filter((r) => r.statuscode === REQUEST_STATUSCODE.active && !responded.has(r._ownerid_value)).map(approverOf))
            : [],
        reassignedApprovers: unique(stepRequests.filter((r) => r.statuscode === REQUEST_STATUSCODE.reassigned).map(approverOf)),
      };
    });

  const details = row.msdyn_flow_approval_details ?? "";
  return { ...listItem, details, steps, regarding: resolveRegarding({ itemLink: row.msdyn_flow_approval_itemlink, details }) };
}
