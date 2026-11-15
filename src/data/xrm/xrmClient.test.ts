import { describe, expect, it } from "vitest";
import { DataError } from "../dataClient";
import { buildApproval } from "../factories";
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

describe("xrmClient countByStatus and exportApprovals contract", () => {
  it("counts with a minimal $select and the list $filter, in pages of 5000 and without a sort", async () => {
    const fake = createFakeXrm({ approvals: [buildApproval()] });
    await createXrmClient(fake.xrm).countByStatus({ title: "order", statuses: ["pending"] });

    expect(fake.requests).toEqual([
      {
        entitySet: "msdyn_flow_approvals",
        params: {
          $select: "statuscode,msdyn_flow_approval_result",
          $filter: "contains(msdyn_flow_approval_title,'order') and (statuscode eq 192350000 or statuscode eq 192350001 or statuscode eq 192350002)",
        },
        prefer: "odata.maxpagesize=5000",
      },
    ]);
  });

  it("counts every matching Approval across server pages, not only the first page", async () => {
    const approvals = [
      ...Array.from({ length: 5000 }, () => buildApproval({ statuscode: 192350001 })),
      ...Array.from({ length: 3 }, () => buildApproval({ statuscode: 192350004, msdyn_flow_approval_result: "Reject" })),
      buildApproval({ statuscode: 192350006 }),
    ];
    const fake = createFakeXrm({ approvals });
    const counts = await createXrmClient(fake.xrm).countByStatus({});

    expect(counts).toEqual({ pending: 5000, approved: 0, rejected: 3, completed: 0, cancelled: 1, expired: 0, abandoned: 0 });
    expect(fake.requests).toHaveLength(2);
    expect(fake.requests[1].params.$skiptoken).toBe("5000");
  });

  it("exports every matching Approval across server pages with the list $select and $orderby", async () => {
    const approvals = Array.from({ length: 5001 }, (_, i) =>
      buildApproval({
        msdyn_flow_approval_title: `Export ${i}`,
        createdon: `2025-01-01T00:${String(Math.floor(i / 60) % 60).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}Z`,
      }),
    );
    const fake = createFakeXrm({ approvals });
    const exported = [];
    for await (const item of createXrmClient(fake.xrm).exportApprovals({ title: "Export" })) exported.push(item);

    expect(exported).toHaveLength(5001);
    expect(new Set(exported.map((i) => i.id)).size).toBe(5001);
    expect(fake.requests).toHaveLength(2);
    expect(fake.requests[0]).toEqual({
      entitySet: "msdyn_flow_approvals",
      params: {
        $select: "msdyn_flow_approvalid,msdyn_flow_approval_title,msdyn_flow_approval_result,statuscode,createdon",
        $filter: "contains(msdyn_flow_approval_title,'Export')",
        $orderby: "createdon desc",
      },
      prefer: "odata.maxpagesize=5000",
    });
    expect(fake.requests[1].params.$skiptoken).toBe("5000");
  });

  it("maps a forbidden or server failure during count and export to the typed DataError", async () => {
    const forbidden = createXrmClient(createFakeXrm({ failWith: { status: 403, message: "missing privilege" } }).xrm);
    await expect(forbidden.countByStatus({})).rejects.toMatchObject({ kind: "forbidden" });
    const iterate = async () => {
      for await (const _ of forbidden.exportApprovals({})) void _;
    };
    await expect(iterate()).rejects.toMatchObject({ kind: "forbidden" });
  });
});
