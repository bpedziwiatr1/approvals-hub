import { describe, expect, it } from "vitest";
import { buildApproval, buildRequest, buildResponse, buildStep } from "../factories";
import { deriveStatus, mapApprovalDetail } from "./mappers";

describe("deriveStatus", () => {
  it.each([
    [192350000, null, "pending"],
    [192350001, null, "pending"],
    [192350002, null, "pending"],
    [192350005, null, "expired"],
    [192350006, null, "cancelled"],
    [192350007, null, "abandoned"],
  ])("maps statuscode %i to %s", (statuscode, result, expected) => {
    expect(deriveStatus(statuscode, result)).toEqual({ status: expected, outcome: null });
  });

  it.each(["Approve", "Approved", "approve", "APPROVED", " Approved "])("treats completed with result %j as approved", (result) => {
    expect(deriveStatus(192350004, result)).toEqual({ status: "approved", outcome: null });
  });

  it.each(["Reject", "Rejected", "reject", "REJECTED"])("treats completed with result %j as rejected", (result) => {
    expect(deriveStatus(192350004, result)).toEqual({ status: "rejected", outcome: null });
  });

  it("treats completed with any other result as completed with that Outcome", () => {
    expect(deriveStatus(192350004, "Needs rework")).toEqual({ status: "completed", outcome: "Needs rework" });
  });

  it("treats completed without a result as completed with no Outcome", () => {
    expect(deriveStatus(192350004, null)).toEqual({ status: "completed", outcome: null });
  });
});

const FV = "_ownerid_value@OData.Community.Display.V1.FormattedValue";
const A1 = "00000000-0000-0000-0000-0000000000a1";
const A2 = "00000000-0000-0000-0000-0000000000a2";
const A3 = "00000000-0000-0000-0000-0000000000a3";

describe("mapApprovalDetail", () => {
  it("synthesises one implicit step 0 for an Approval without step rows, with responses and pending Approvers", () => {
    const detail = mapApprovalDetail(
      buildApproval({
        msdyn_flow_approvalid: "00000000-0000-0000-0000-00000000c001",
        msdyn_flow_approval_details: "**Hello**",
        statuscode: 192350001,
        msdyn_flow_approvalrelationship_approvalrequests: [
          buildRequest({ _ownerid_value: A1, [FV]: "Ann Contoso" }),
          buildRequest({ _ownerid_value: A2, [FV]: "Bob Contoso" }),
        ],
        msdyn_flow_approvalrelationship_approvalresponses: [
          buildResponse({ _ownerid_value: A1, [FV]: "Ann Contoso", msdyn_flow_approvalresponse_response: "Approve", msdyn_flow_approvalresponse_comments: "Looks fine" }),
        ],
        msdyn_flow_approvalrelationship_approvalsteps: [],
      }),
    );

    expect(detail.details).toBe("**Hello**");
    expect(detail.steps).toEqual([
      {
        number: 0,
        implicit: true,
        stage: null,
        result: null,
        responses: [{ approver: { id: A1, name: "Ann Contoso" }, response: "Approve", comments: "Looks fine", respondedOn: "2025-01-16T10:00:00.000Z" }],
        pendingApprovers: [{ id: A2, name: "Bob Contoso" }],
        reassignedApprovers: [],
      },
    ]);
  });

  it("groups responses and requests by Approval Step in step order for a multi-step Approval", () => {
    const detail = mapApprovalDetail(
      buildApproval({
        statuscode: 192350001,
        msdyn_flow_approvalrelationship_approvalsteps: [
          buildStep({ msdyn_flow_approvalstep_number: 2, msdyn_flow_approvalstep_stage: "Finance" }),
          buildStep({ msdyn_flow_approvalstep_number: 1, msdyn_flow_approvalstep_stage: "Manager", msdyn_flow_approvalstep_result: "Approve" }),
        ],
        msdyn_flow_approvalrelationship_approvalrequests: [
          buildRequest({ _ownerid_value: A1, msdyn_flow_approvalrequest_stepnumber: 1 }),
          buildRequest({ _ownerid_value: A2, msdyn_flow_approvalrequest_stepnumber: 2 }),
        ],
        msdyn_flow_approvalrelationship_approvalresponses: [buildResponse({ _ownerid_value: A1, msdyn_flow_approvalresponse_stepnumber: 1 })],
      }),
    );

    expect(detail.steps.map((s) => [s.number, s.implicit, s.stage, s.result])).toEqual([
      [1, false, "Manager", "Approve"],
      [2, false, "Finance", null],
    ]);
    expect(detail.steps[0].responses).toHaveLength(1);
    expect(detail.steps[0].pendingApprovers).toEqual([]);
    expect(detail.steps[1].responses).toEqual([]);
    expect(detail.steps[1].pendingApprovers.map((a) => a.id)).toEqual([A2]);
  });

  it("handles an Approval with no requests, responses or steps", () => {
    const detail = mapApprovalDetail(buildApproval({ msdyn_flow_approval_details: null }));
    expect(detail.details).toBe("");
    expect(detail.steps).toEqual([
      { number: 0, implicit: true, stage: null, result: null, responses: [], pendingApprovers: [], reassignedApprovers: [] },
    ]);
  });

  it("lists reassigned Approval Requests apart from pending Approvers", () => {
    const detail = mapApprovalDetail(
      buildApproval({
        statuscode: 192350001,
        msdyn_flow_approvalrelationship_approvalrequests: [buildRequest({ _ownerid_value: A1, statuscode: 192350000 }), buildRequest({ _ownerid_value: A3 })],
      }),
    );
    expect(detail.steps[0].reassignedApprovers).toEqual([{ id: A1, name: A1 }]);
    expect(detail.steps[0].pendingApprovers).toEqual([{ id: A3, name: A3 }]);
  });

  it("lists no pending Approvers once the Approval is no longer pending", () => {
    const detail = mapApprovalDetail(
      buildApproval({ statuscode: 192350006, msdyn_flow_approvalrelationship_approvalrequests: [buildRequest({ _ownerid_value: A1 })] }),
    );
    expect(detail.steps[0].pendingApprovers).toEqual([]);
  });

  it("keeps custom response options verbatim and the Outcome of the Approval", () => {
    const detail = mapApprovalDetail(
      buildApproval({
        statuscode: 192350004,
        msdyn_flow_approval_result: "Send back",
        msdyn_flow_approvalrelationship_approvalresponses: [buildResponse({ msdyn_flow_approvalresponse_response: "Send back" })],
      }),
    );
    expect(detail.status).toBe("completed");
    expect(detail.outcome).toBe("Send back");
    expect(detail.steps[0].responses[0].response).toBe("Send back");
  });

  it("normalises response times with any UTC offset to the same UTC instant, oldest first", () => {
    const detail = mapApprovalDetail(
      buildApproval({
        msdyn_flow_approvalrelationship_approvalresponses: [
          buildResponse({ createdon: "2025-03-01T12:00:00+02:00" }),
          buildResponse({ createdon: "2025-03-01T09:00:00Z" }),
        ],
      }),
    );
    expect(detail.steps[0].responses.map((r) => r.respondedOn)).toEqual(["2025-03-01T09:00:00.000Z", "2025-03-01T10:00:00.000Z"]);
  });
});
