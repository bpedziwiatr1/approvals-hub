/** Dataverse names for the approval tables (see spec #1, "Dataverse mapping"). */

export const APPROVAL = {
  logicalName: "msdyn_flow_approval",
  entitySet: "msdyn_flow_approvals",
  id: "msdyn_flow_approvalid",
  title: "msdyn_flow_approval_title",
  result: "msdyn_flow_approval_result",
  statuscode: "statuscode",
  createdOn: "createdon",
} as const;

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
}
