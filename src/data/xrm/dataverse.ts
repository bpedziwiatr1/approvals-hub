/** Dataverse names for the approval tables (see spec #1, "Dataverse mapping"). */

export const APPROVAL = {
  logicalName: "msdyn_flow_approval",
  entitySet: "msdyn_flow_approvals",
  id: "msdyn_flow_approvalid",
  title: "msdyn_flow_approval_title",
  result: "msdyn_flow_approval_result",
  statuscode: "statuscode",
  createdOn: "createdon",
  owner: "_ownerid_value",
  requests: "msdyn_flow_approvalrelationship_approvalrequests",
  details: "msdyn_flow_approval_details",
} as const;

/** Approval Request `statecode`: 0 is active (still waiting for the Approver). */
export const REQUEST_STATECODE_ACTIVE = 0;

/** Entity sets by logical name, for transports that address the Web API by URL. */
export const ENTITY_SETS: Record<string, string> = {
  msdyn_flow_approval: "msdyn_flow_approvals",
  msdyn_flow_approvalrequest: "msdyn_flow_approvalrequests",
  msdyn_flow_approvalresponse: "msdyn_flow_approvalresponses",
  msdyn_flow_approvalstep: "msdyn_flow_approvalsteps",
  environmentvariabledefinition: "environmentvariabledefinitions",
};

export const APPROVAL_STATUSCODE = {
  created: 192350000,
  pending: 192350001,
  suspended: 192350002,
  completed: 192350004,
  expired: 192350005,
  cancelled: 192350006,
  abandoned: 192350007,
} as const;

/** One msdyn_flow_approval row with the list columns, as Xrm.WebApi returns it. */
export interface ApprovalRow {
  msdyn_flow_approvalid: string;
  msdyn_flow_approval_title: string;
  msdyn_flow_approval_result: string | null;
  statuscode: number;
  createdon: string;
  /** The Owner (flow connection user). */
  _ownerid_value?: string;
  msdyn_flow_approval_details?: string | null;
  msdyn_flow_approvalrelationship_approvalrequests?: ApprovalRequestRow[];
  msdyn_flow_approvalrelationship_approvalresponses?: ApprovalResponseRow[];
  msdyn_flow_approvalrelationship_approvalsteps?: ApprovalStepRow[];
}

/** Navigation properties from an Approval to its children, for `$expand`. */
export const APPROVAL_NAV = {
  requests: "msdyn_flow_approvalrelationship_approvalrequests",
  responses: "msdyn_flow_approvalrelationship_approvalresponses",
  steps: "msdyn_flow_approvalrelationship_approvalsteps",
} as const;

export const REQUEST_STATUSCODE = { active: 1, inactive: 2, reassigned: 192350000 } as const;

/** Approval Request row: the Approver is `_ownerid_value`. */
export interface ApprovalRequestRow {
  _ownerid_value: string;
  "_ownerid_value@OData.Community.Display.V1.FormattedValue"?: string;
  msdyn_flow_approvalrequest_stepnumber: number | null;
  statuscode: number;
  /** 0 is active (still waiting for the Approver). */
  statecode?: number;
}

/** Approval Response row: the responder is `_ownerid_value`. */
export interface ApprovalResponseRow {
  _ownerid_value: string;
  "_ownerid_value@OData.Community.Display.V1.FormattedValue"?: string;
  msdyn_flow_approvalresponse_response: string | null;
  msdyn_flow_approvalresponse_comments: string | null;
  msdyn_flow_approvalresponse_stepnumber: number | null;
  createdon: string;
}

export interface ApprovalStepRow {
  msdyn_flow_approvalstep_number: number;
  msdyn_flow_approvalstep_result: string | null;
  msdyn_flow_approvalstep_stage: string | null;
}
