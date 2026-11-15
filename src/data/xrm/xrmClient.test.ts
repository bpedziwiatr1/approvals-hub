import { describe, expect, it } from "vitest";
import { DataError } from "../dataClient";
import { buildApproval, buildRequest, buildResponse } from "../factories";
import { createFakeXrm } from "./fakeXrm";
import { createXrmClient } from "./xrmClient";

describe("xrmClient listApprovals contract", () => {
  it("queries the Approvals entity set with the list $select, newest first, one server page at a time", async () => {
    const fake = createFakeXrm({ approvals: [buildApproval()] });
    const client = createXrmClient(fake.xrm);

    await client.listApprovals({}, { size: 50 });

    expect(fake.requests).toEqual([
      {
        entitySet: "msdyn_flow_approvals",
        params: {
          $select: "msdyn_flow_approvalid,msdyn_flow_approval_title,msdyn_flow_approval_result,statuscode,createdon",
          $orderby: "createdon desc",
        },
        prefer: "odata.maxpagesize=50",
      },
    ]);
  });

  it("follows @odata.nextLink page by page with one request per page, never fetching everything", async () => {
    const approvals = Array.from({ length: 120 }, (_, i) =>
      buildApproval({ createdon: `2025-01-01T00:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}Z` }),
    );
    const fake = createFakeXrm({ approvals });
    const client = createXrmClient(fake.xrm);

    const first = await client.listApprovals({}, { size: 50 });
    expect(first.items).toHaveLength(50);
    expect(first.continuationToken).not.toBeNull();
    expect(fake.requests).toHaveLength(1);

    const second = await client.listApprovals({}, { size: 50, continuationToken: first.continuationToken });
    const third = await client.listApprovals({}, { size: 50, continuationToken: second.continuationToken });

    expect(second.items).toHaveLength(50);
    expect(third.items).toHaveLength(20);
    expect(third.continuationToken).toBeNull();
    expect(fake.requests).toHaveLength(3);
    expect(fake.requests[1]).toEqual({
      entitySet: "msdyn_flow_approvals",
      params: {
        $select: "msdyn_flow_approvalid,msdyn_flow_approval_title,msdyn_flow_approval_result,statuscode,createdon",
        $orderby: "createdon desc",
        $skiptoken: "50",
      },
      prefer: "odata.maxpagesize=50",
    });
    const ids = [...first.items, ...second.items, ...third.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(120);
    expect(first.items[0].createdOn).toBe("2025-01-01T00:01:59Z");
    expect(third.items[19].createdOn).toBe("2025-01-01T00:00:00Z");
  });

  it.each([
    ["an HTTP 403", { status: 403, errorCode: -2147220960, message: "Principal user is missing prvReadmsdyn_flow_approval privilege" }],
    ["a privilege error code without HTTP status", { errorCode: -2147220960, message: "SecLib::CheckPrivilege failed" }],
    ["a missing-privilege message", { errorCode: -2147220891, message: "Principal user is missing prvReadmsdyn_flow_approval privilege" }],
  ])("maps %s to a typed forbidden error", async (_, failWith) => {
    const client = createXrmClient(createFakeXrm({ failWith }).xrm);
    await expect(client.listApprovals({}, { size: 50 })).rejects.toMatchObject({ name: "DataError", kind: "forbidden", message: expect.any(String) });
  });

  it.each([
    ["an HTTP 500", { status: 500, errorCode: -2147220970, message: "Generic SQL error." }],
    ["an error without status or code", { message: "Network request failed" }],
    ["a non-object rejection", "boom"],
  ])("maps %s to a typed server error with its message", async (_, failWith) => {
    const client = createXrmClient(createFakeXrm({ failWith: failWith as never }).xrm);
    const error = await client.listApprovals({}, { size: 50 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataError);
    expect(error).toMatchObject({ kind: "server" });
    expect((error as DataError).message).not.toBe("");
  });

  it("maps synthetic Approval rows to list items with a derived display status and Outcome", async () => {
    const fake = createFakeXrm({
      approvals: [
        buildApproval({
          msdyn_flow_approvalid: "00000000-0000-0000-0000-00000000b001",
          msdyn_flow_approval_title: "Contoso invoice 1",
          statuscode: 192350004,
          msdyn_flow_approval_result: "Approve",
          createdon: "2025-02-01T10:00:00Z",
        }),
        buildApproval({
          msdyn_flow_approvalid: "00000000-0000-0000-0000-00000000b002",
          msdyn_flow_approval_title: "Contoso invoice 2",
          statuscode: 192350004,
          msdyn_flow_approval_result: "Send back",
          createdon: "2025-01-01T10:00:00Z",
        }),
      ],
    });

    const page = await createXrmClient(fake.xrm).listApprovals({}, { size: 50 });

    expect(page).toEqual({
      items: [
        { id: "00000000-0000-0000-0000-00000000b001", title: "Contoso invoice 1", status: "approved", outcome: null, createdOn: "2025-02-01T10:00:00Z" },
        { id: "00000000-0000-0000-0000-00000000b002", title: "Contoso invoice 2", status: "completed", outcome: "Send back", createdOn: "2025-01-01T10:00:00Z" },
      ],
      continuationToken: null,
    });
  });
});

describe("xrmClient getApprovalDetail contract", () => {
  const ID = "00000000-0000-0000-0000-00000000d001";
  const NAV = "msdyn_flow_approvalrelationship_approval";

  it("fetches the Approval with its requests, responses and steps in one $expand request", async () => {
    const fake = createFakeXrm({ approvals: [buildApproval({ msdyn_flow_approvalid: ID })] });

    await createXrmClient(fake.xrm).getApprovalDetail(ID);

    expect(fake.requests).toHaveLength(1);
    const [request] = fake.requests;
    expect(request.entitySet).toBe("msdyn_flow_approvals");
    expect(request.params.$filter).toBe(`msdyn_flow_approvalid eq ${ID}`);
    expect(request.params.$select).toBe(
      "msdyn_flow_approvalid,msdyn_flow_approval_title,msdyn_flow_approval_result,statuscode,createdon,msdyn_flow_approval_details",
    );
    expect(request.params.$expand).toBe(
      [
        `${NAV}requests($select=_ownerid_value,msdyn_flow_approvalrequest_stepnumber,statuscode)`,
        `${NAV}responses($select=_ownerid_value,msdyn_flow_approvalresponse_response,msdyn_flow_approvalresponse_comments,msdyn_flow_approvalresponse_stepnumber,createdon)`,
        `${NAV}steps($select=msdyn_flow_approvalstep_number,msdyn_flow_approvalstep_result,msdyn_flow_approvalstep_stage)`,
      ].join(","),
    );
  });

  it("maps the expanded rows to steps with responses and pending Approvers", async () => {
    const approver = "00000000-0000-0000-0000-0000000000a1";
    const fake = createFakeXrm({
      approvals: [
        buildApproval({
          msdyn_flow_approvalid: ID,
          msdyn_flow_approval_details: "Please approve",
          msdyn_flow_approvalrelationship_approvalrequests: [buildRequest({ _ownerid_value: approver })],
          msdyn_flow_approvalrelationship_approvalresponses: [buildResponse({ msdyn_flow_approvalresponse_comments: "ok" })],
        }),
      ],
    });

    const detail = await createXrmClient(fake.xrm).getApprovalDetail(ID);

    expect(detail.details).toBe("Please approve");
    expect(detail.steps).toHaveLength(1);
    expect(detail.steps[0].responses[0].comments).toBe("ok");
    expect(detail.steps[0].pendingApprovers).toEqual([{ id: approver, name: approver }]);
  });

  it("rejects with notFound when the Approval does not exist or the id is not a GUID", async () => {
    const fake = createFakeXrm({ approvals: [] });
    const client = createXrmClient(fake.xrm);
    await expect(client.getApprovalDetail(ID)).rejects.toMatchObject({ name: "DataError", kind: "notFound" });
    await expect(client.getApprovalDetail("x' or 1 eq 1")).rejects.toMatchObject({ kind: "notFound" });
    expect(fake.requests).toHaveLength(1);
  });

  it("maps a 403 to forbidden", async () => {
    const client = createXrmClient(createFakeXrm({ failWith: { status: 403, message: "denied" } }).xrm);
    await expect(client.getApprovalDetail(ID)).rejects.toMatchObject({ kind: "forbidden" });
  });
});
