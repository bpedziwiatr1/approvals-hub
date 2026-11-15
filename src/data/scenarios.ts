import { buildApproval, buildRequest, buildResponse, buildStep } from "./factories";
import { APPROVAL_STATUSCODE, REQUEST_STATUSCODE, type ApprovalRequestRow, type ApprovalRow } from "./xrm/dataverse";

/** Local scenarios (`?scenario=`); the same synthetic rows feed mockClient and fakeXrm. */
export const SCENARIO_NAMES = ["default", "multiStep", "longList", "statuses", "scoped", "currentUserIsApprover", "currentUserNotApprover", "noRegarding"] as const;
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

/** The signed-in user of mockClient and fakeXrm. */
export const CURRENT_USER_ID = "00000000-0000-0000-0000-0000000000f1";

const OWNER_1 = "00000000-0000-0000-0000-000000000e01";
const OWNER_2 = "00000000-0000-0000-0000-000000000e02";
const OTHER_APPROVER = "00000000-0000-0000-0000-0000000000b1";
const ACTIVE = 0;
const INACTIVE = 1;

/** Four Approvals with owners and Approval Requests; `me` is the Approver on the first two, or nobody when the current user has none. */
function assignmentRows(currentUserIsApprover: boolean): ApprovalRow[] {
  const me = currentUserIsApprover ? CURRENT_USER_ID : "00000000-0000-0000-0000-0000000000c1";
  const rows: [string, number, string | null, string, string, ApprovalRequestRow[]][] = [
    ["Alpha mine pending", APPROVAL_STATUSCODE.pending, null, "2025-05-03T12:00:00Z", OWNER_1, [buildRequest({ _ownerid_value: me, statecode: ACTIVE, statuscode: REQUEST_STATUSCODE.active })]],
    ["Beta mine decided", APPROVAL_STATUSCODE.completed, "Approve", "2025-05-02T00:00:00Z", OWNER_2, [buildRequest({ _ownerid_value: me, statecode: INACTIVE, statuscode: REQUEST_STATUSCODE.inactive }), buildRequest({ _ownerid_value: OTHER_APPROVER, statecode: INACTIVE, statuscode: REQUEST_STATUSCODE.inactive })]],
    ["Gamma others pending", APPROVAL_STATUSCODE.pending, null, "2025-05-01T23:59:59Z", OWNER_1, [buildRequest({ _ownerid_value: OTHER_APPROVER, statecode: ACTIVE, statuscode: REQUEST_STATUSCODE.active })]],
    ["Delta others completed", APPROVAL_STATUSCODE.completed, "Reject", "2025-04-30T12:00:00Z", OWNER_2, [buildRequest({ _ownerid_value: "00000000-0000-0000-0000-0000000000c2", statecode: INACTIVE, statuscode: REQUEST_STATUSCODE.inactive })]],
  ];
  return (currentUserIsApprover ? rows : rows.slice(0, 2)).map(([title, statuscode, result, createdon, owner, requests], i) =>
    buildApproval({
      msdyn_flow_approvalid: `00000000-0000-0000-0003-${String(i + 1).padStart(12, "0")}`,
      msdyn_flow_approval_title: title,
      statuscode,
      msdyn_flow_approval_result: result,
      createdon,
      _ownerid_value: owner,
      msdyn_flow_approvalrelationship_approvalrequests: requests,
    }),
  );
}

const ANN = "00000000-0000-0000-0000-0000000000c1";
const BOB = "00000000-0000-0000-0000-0000000000c2";
const CAROL = "00000000-0000-0000-0000-0000000000c3";
const DAVE = "00000000-0000-0000-0000-0000000000c4";
const NAME = "_ownerid_value@OData.Community.Display.V1.FormattedValue" as const;
const who = (id: string, name: string) => ({ _ownerid_value: id, [NAME]: name });

/** Approval rows of a scenario, newest first. */
export function scenarioApprovals(name: ScenarioName): ApprovalRow[] {
  switch (name) {
    case "default":
      return [
        buildApproval({ msdyn_flow_approvalid: "00000000-0000-0000-0000-00000000a001", msdyn_flow_approval_title: "Contoso purchase order 1001", msdyn_flow_approval_category: "Purchasing", msdyn_flow_approval_details: "Please approve **purchase order 1001**.", msdyn_flow_approval_itemlink: "https://contoso.crm.dynamics.com/main.aspx?pagetype=entityrecord&etn=account&id=00000000-0000-0000-0000-0000000000a1", msdyn_flow_approvalrelationship_approvalrequests: [buildRequest(who(ANN, "Ann Contoso")), buildRequest(who(BOB, "Bob Contoso"))], msdyn_flow_approvalrelationship_approvalresponses: [buildResponse({ ...who(ANN, "Ann Contoso"), msdyn_flow_approvalresponse_comments: "Fine by me" })], statuscode: APPROVAL_STATUSCODE.pending, createdon: "2025-03-12T08:30:00Z" }),
        buildApproval({ msdyn_flow_approvalid: "00000000-0000-0000-0000-00000000a002", msdyn_flow_approval_title: "Contoso travel request 2002", msdyn_flow_approval_category: "Travel", msdyn_flow_approvalrelationship_approvalrequests: [buildRequest(who(ANN, "Ann Contoso"))], msdyn_flow_approvalrelationship_approvalresponses: [buildResponse(who(ANN, "Ann Contoso"))], statuscode: APPROVAL_STATUSCODE.completed, msdyn_flow_approval_result: "Approve", createdon: "2025-03-10T13:05:00Z" }),
        buildApproval({ msdyn_flow_approvalid: "00000000-0000-0000-0000-00000000a003", msdyn_flow_approval_title: "Contoso contract renewal 3003", msdyn_flow_approval_category: "Legal", msdyn_flow_approvalrelationship_approvalrequests: [buildRequest(who(BOB, "Bob Contoso"))], msdyn_flow_approvalrelationship_approvalresponses: [buildResponse({ ...who(BOB, "Bob Contoso"), msdyn_flow_approvalresponse_response: "Reject", msdyn_flow_approvalresponse_comments: "Terms unclear" })], statuscode: APPROVAL_STATUSCODE.completed, msdyn_flow_approval_result: "Reject", createdon: "2025-03-08T16:45:00Z" }),
      ];
    case "multiStep":
      return [
        buildApproval({
          msdyn_flow_approvalid: "00000000-0000-0000-0000-00000000b001",
          msdyn_flow_approval_title: "Contoso budget approval",
          msdyn_flow_approval_details: "Budget for Q3.\n\n[Budget sheet](https://example.com/budget)\n\n| Item | Amount |\n| --- | --- |\n| Licences | 1200 |",
          statuscode: APPROVAL_STATUSCODE.pending,
          createdon: "2025-04-01T08:00:00Z",
          msdyn_flow_approvalrelationship_approvalsteps: [
            buildStep({ msdyn_flow_approvalstep_number: 1, msdyn_flow_approvalstep_stage: "Manager", msdyn_flow_approvalstep_result: "Approve" }),
            buildStep({ msdyn_flow_approvalstep_number: 2, msdyn_flow_approvalstep_stage: "Finance" }),
          ],
          msdyn_flow_approvalrelationship_approvalrequests: [
            buildRequest({ ...who(ANN, "Ann Contoso"), msdyn_flow_approvalrequest_stepnumber: 1 }),
            buildRequest({ ...who(CAROL, "Carol Contoso"), msdyn_flow_approvalrequest_stepnumber: 2, statuscode: 192350000 }),
            buildRequest({ ...who(BOB, "Bob Contoso"), msdyn_flow_approvalrequest_stepnumber: 2 }),
          ],
          msdyn_flow_approvalrelationship_approvalresponses: [
            buildResponse({ ...who(ANN, "Ann Contoso"), msdyn_flow_approvalresponse_stepnumber: 1, msdyn_flow_approvalresponse_comments: "Within budget", createdon: "2025-04-02T09:15:00Z" }),
          ],
        }),
        buildApproval({
          msdyn_flow_approvalid: "00000000-0000-0000-0000-00000000b002",
          msdyn_flow_approval_title: "Contoso rework request",
          msdyn_flow_approval_details: "Needs a second look.",
          statuscode: APPROVAL_STATUSCODE.completed,
          msdyn_flow_approval_result: "Send back",
          createdon: "2025-03-20T10:00:00Z",
          msdyn_flow_approvalrelationship_approvalrequests: [buildRequest(who(DAVE, "Dave Contoso"))],
          msdyn_flow_approvalrelationship_approvalresponses: [
            buildResponse({ ...who(DAVE, "Dave Contoso"), msdyn_flow_approvalresponse_response: "Send back", msdyn_flow_approvalresponse_comments: "Add the missing quote", createdon: "2025-03-21T11:30:00Z" }),
          ],
        }),
      ];
    case "currentUserIsApprover":
      return assignmentRows(true);
    case "currentUserNotApprover":
      return assignmentRows(false);
    case "noRegarding":
      return [
        buildApproval({
          msdyn_flow_approvalid: "00000000-0000-0000-0000-00000000c001",
          msdyn_flow_approval_title: "Contoso approval without a record",
          msdyn_flow_approval_details: "No record link here, only [a document](https://example.com/doc?id=1).",
          createdon: "2025-05-01T08:00:00Z",
        }),
        buildApproval({
          msdyn_flow_approvalid: "00000000-0000-0000-0000-00000000c002",
          msdyn_flow_approval_title: "Contoso approval with a broken record link",
          msdyn_flow_approval_details: "Record: https://contoso.crm.dynamics.com/main.aspx?etn=account&id=",
          createdon: "2025-04-30T08:00:00Z",
        }),
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
    case "scoped": {
      // Rows for Profile Scope checks: title forms, categories and tags the scope criteria must tell apart.
      const rows: [string, string, string | null, number, string | null][] = [
        ["Contoso PO 100", "Purchasing", "eu;urgent", APPROVAL_STATUSCODE.pending, null],
        ["Contoso PO 200", "Purchasing", "us", APPROVAL_STATUSCODE.completed, "Approve"],
        ["Contoso trip Berlin", "Travel", "eu", APPROVAL_STATUSCODE.completed, "Approve"],
        ["Annual Contoso PO review", "Purchasing", null, APPROVAL_STATUSCODE.completed, "Reject"],
        ["Contoso PO", "Legal", "eu", APPROVAL_STATUSCODE.pending, null],
      ];
      return rows.map(([title, category, tags, statuscode, result], i) =>
        buildApproval({
          msdyn_flow_approvalid: `00000000-0000-0000-0003-${String(i + 1).padStart(12, "0")}`,
          msdyn_flow_approval_title: title,
          msdyn_flow_approval_category: category,
          msdyn_flow_approval_tags: tags,
          statuscode,
          msdyn_flow_approval_result: result,
          createdon: new Date(Date.parse("2025-05-30T12:00:00Z") - i * 3_600_000).toISOString().replace(".000Z", "Z"),
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

/** Profile configuration served by mockClient and the fakeXrm environment variable, for `?profile=` locally. */
export const MOCK_CONFIG_JSON = JSON.stringify({
  profiles: {
    default: {},
    purchasing: { pageTitle: "Purchasing approvals", pageSize: 50, accentColor: "#107c10", scope: { category: "Purchasing" } },
    travel: { extends: "purchasing", pageTitle: "Travel approvals", accentColor: "#8e562e", defaultStatus: "approved", scope: { category: "Travel" } },
  },
});
