import type { ApprovalListItem } from "./dataClient";
import { APPROVAL_STATUSCODE, type ApprovalRow } from "./xrm/dataverse";

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
