import { buildApproval } from "./factories";
import { APPROVAL_STATUSCODE, type ApprovalRow } from "./xrm/dataverse";

/** Local scenarios (`?scenario=`); the same synthetic rows feed mockClient and fakeXrm. */
export const SCENARIO_NAMES = ["default", "longList", "statuses"] as const;
export type ScenarioName = (typeof SCENARIO_NAMES)[number];

export function isScenarioName(value: string | null): value is ScenarioName {
  return (SCENARIO_NAMES as readonly (string | null)[]).includes(value);
}

const LONG_LIST_SIZE = 5000;
const LONG_LIST_STATES: Pick<ApprovalRow, "statuscode" | "msdyn_flow_approval_result">[] = [
  { statuscode: APPROVAL_STATUSCODE.pending, msdyn_flow_approval_result: null },
  { statuscode: APPROVAL_STATUSCODE.completed, msdyn_flow_approval_result: "Approve" },
  { statuscode: APPROVAL_STATUSCODE.completed, msdyn_flow_approval_result: "Reject" },
  { statuscode: APPROVAL_STATUSCODE.completed, msdyn_flow_approval_result: "Send back" },
  { statuscode: APPROVAL_STATUSCODE.cancelled, msdyn_flow_approval_result: null },
];

/** Approval rows of a scenario, newest first. */
export function scenarioApprovals(name: ScenarioName): ApprovalRow[] {
  switch (name) {
    case "default":
      return [
        buildApproval({ msdyn_flow_approvalid: "00000000-0000-0000-0000-00000000a001", msdyn_flow_approval_title: "Contoso purchase order 1001", statuscode: APPROVAL_STATUSCODE.pending, createdon: "2025-03-12T08:30:00Z" }),
        buildApproval({ msdyn_flow_approvalid: "00000000-0000-0000-0000-00000000a002", msdyn_flow_approval_title: "Contoso travel request 2002", statuscode: APPROVAL_STATUSCODE.completed, msdyn_flow_approval_result: "Approve", createdon: "2025-03-10T13:05:00Z" }),
        buildApproval({ msdyn_flow_approvalid: "00000000-0000-0000-0000-00000000a003", msdyn_flow_approval_title: "Contoso contract renewal 3003", statuscode: APPROVAL_STATUSCODE.completed, msdyn_flow_approval_result: "Reject", createdon: "2025-03-08T16:45:00Z" }),
      ];
    case "statuses": {
      // One Approval per stored state, newest first, including result spellings and the odd title the filters must cope with.
      const states: [string, number, string | null][] = [
        ["Alpha pending", APPROVAL_STATUSCODE.pending, null],
        ["Beta created", APPROVAL_STATUSCODE.created, null],
        ["Gamma suspended", APPROVAL_STATUSCODE.suspended, null],
        ["Delta approve", APPROVAL_STATUSCODE.completed, "Approve"],
        ["Epsilon Approved", APPROVAL_STATUSCODE.completed, "Approved"],
        ["Zeta reject", APPROVAL_STATUSCODE.completed, "reject"],
        ["Eta REJECTED", APPROVAL_STATUSCODE.completed, "Rejected"],
        ["Theta send back", APPROVAL_STATUSCODE.completed, "Send back"],
        ["Iota no result", APPROVAL_STATUSCODE.completed, null],
        ["Kappa cancelled", APPROVAL_STATUSCODE.cancelled, null],
        ["Lambda expired", APPROVAL_STATUSCODE.expired, null],
        ["Mu abandoned", APPROVAL_STATUSCODE.abandoned, null],
        ["O'Brien request", APPROVAL_STATUSCODE.pending, null],
      ];
      return states.map(([title, statuscode, result], i) =>
        buildApproval({
          msdyn_flow_approvalid: `00000000-0000-0000-0002-${String(i + 1).padStart(12, "0")}`,
          msdyn_flow_approval_title: title,
          statuscode,
          msdyn_flow_approval_result: result,
          createdon: new Date(Date.parse("2025-04-30T12:00:00Z") - i * 3_600_000).toISOString().replace(".000Z", "Z"),
        }),
      );
    }
    case "longList": {
      const newest = Date.parse("2025-06-30T12:00:00Z");
      return Array.from({ length: LONG_LIST_SIZE }, (_, i) =>
        buildApproval({
          msdyn_flow_approvalid: `00000000-0000-0000-0001-${String(i + 1).padStart(12, "0")}`,
          msdyn_flow_approval_title: `Contoso long list approval ${String(i + 1).padStart(4, "0")}`,
          createdon: new Date(newest - i * 37 * 60_000).toISOString().replace(".000Z", "Z"),
          ...LONG_LIST_STATES[i % LONG_LIST_STATES.length],
        }),
      );
    }
  }
}
