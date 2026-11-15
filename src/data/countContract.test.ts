import { describe, expect, it } from "vitest";
import type { ApprovalQuery, DataClient, StatusCounts } from "./dataClient";
import { createMockClient } from "./mockClient";
import { scenarioApprovals } from "./scenarios";
import { createFakeXrm } from "./xrm/fakeXrm";
import { createXrmClient } from "./xrm/xrmClient";

const clients = (): [string, DataClient][] => [
  ["mockClient", createMockClient("statuses")],
  ["xrmClient", createXrmClient(createFakeXrm({ approvals: scenarioApprovals("statuses") }).xrm)],
];

const zero = (): StatusCounts => ({ pending: 0, approved: 0, rejected: 0, completed: 0, cancelled: 0, expired: 0, abandoned: 0 });

// Expected counts are written out by hand from the "statuses" scenario, independent of either implementation.
const CASES: [string, ApprovalQuery, Partial<StatusCounts>][] = [
  ["no filter", {}, { pending: 4, approved: 2, rejected: 2, completed: 2, cancelled: 1, expired: 1, abandoned: 1 }],
  ["title narrows the counts", { title: "ALPH" }, { pending: 1 }],
  ["statuses narrow the counts", { statuses: ["cancelled", "expired"] }, { cancelled: 1, expired: 1 }],
  ["title and statuses are ANDed", { title: "e", statuses: ["approved", "cancelled"] }, { approved: 2, cancelled: 1 }],
  ["no match gives zeros", { title: "no such approval" }, {}],
];

describe.each(clients())("%s countByStatus", (_name, client) => {
  it.each(CASES)("%s", async (_label, query, expected) => {
    expect(await client.countByStatus(query)).toEqual({ ...zero(), ...expected });
  });
});

describe("exportApprovals", () => {
  it.each(clients())("%s yields every matching Approval in list order", async (_name, client) => {
    const exported: string[] = [];
    for await (const item of client.exportApprovals({ statuses: ["pending"] })) exported.push(item.title);
    const listed = (await client.listApprovals({ statuses: ["pending"] }, { size: 100 })).items.map((i) => i.title);
    expect(exported).toEqual(listed);
    expect(exported).toHaveLength(4);
  });
});
