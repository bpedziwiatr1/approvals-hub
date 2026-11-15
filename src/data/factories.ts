import type { ApprovalListItem } from "./dataClient";
import { APPROVAL_STATUSCODE, REQUEST_STATUSCODE, type ApprovalRequestRow, type ApprovalResponseRow, type ApprovalRow, type ApprovalStepRow } from "./xrm/dataverse";

let counter = 0;
const nextGuid = () => {
  counter += 1;
  return `00000000-0000-0000-0000-${String(counter).padStart(12, "0")}`;
};

/** Synthetic Approval list item; ids are always 00000000-0000-... GUIDs. */
export function buildApprovalListItem(overrides: Partial<ApprovalListItem> = {}): ApprovalListItem {
  const id = nextGuid();
  return {
    id,
    title: `Contoso approval ${counter}`,
    status: "pending",
    outcome: null,
    createdOn: "2025-01-15T09:00:00Z",
    ...overrides,
  };
}

/** Synthetic msdyn_flow_approval row, shaped as Xrm.WebApi returns it. */
export function buildApproval(overrides: Partial<ApprovalRow> = {}): ApprovalRow {
  const id = nextGuid();
  return {
    msdyn_flow_approvalid: id,
    msdyn_flow_approval_title: `Contoso approval ${counter}`,
    msdyn_flow_approval_result: null,
    statuscode: APPROVAL_STATUSCODE.pending,
    createdon: "2025-01-15T09:00:00Z",
    ...overrides,
  };
}

/** Synthetic Approval Request row (an Approver asked to decide). */
export function buildRequest(overrides: Partial<ApprovalRequestRow> = {}): ApprovalRequestRow {
  return {
    _ownerid_value: nextGuid(),
    msdyn_flow_approvalrequest_stepnumber: null,
    statuscode: REQUEST_STATUSCODE.active,
    statecode: 0,
    ...overrides,
  };
}

/** Synthetic Approval Response row. */
export function buildResponse(overrides: Partial<ApprovalResponseRow> = {}): ApprovalResponseRow {
  return {
    _ownerid_value: nextGuid(),
    msdyn_flow_approvalresponse_response: "Approve",
    msdyn_flow_approvalresponse_comments: null,
    msdyn_flow_approvalresponse_stepnumber: null,
    createdon: "2025-01-16T10:00:00Z",
    ...overrides,
  };
}

/** Synthetic Approval Step row. */
export function buildStep(overrides: Partial<ApprovalStepRow> = {}): ApprovalStepRow {
  return {
    msdyn_flow_approvalstep_number: 1,
    msdyn_flow_approvalstep_result: null,
    msdyn_flow_approvalstep_stage: null,
    ...overrides,
  };
}
