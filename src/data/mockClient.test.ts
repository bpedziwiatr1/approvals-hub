import { describe, expect, it } from "vitest";
import { createMockClient, isScenarioName } from "./mockClient";

describe("mockClient default scenario", () => {
  it("returns a page of Approval list items through the DataClient interface", async () => {
    const client = createMockClient("default");
    const page = await client.listApprovals({}, { size: 50 });
    expect(page.items.map(i => i.status)).toEqual(["pending", "approved", "rejected"]);
    expect(page.continuationToken).toBeNull();
  });
});

describe("mockClient longList scenario", () => {
  it("serves thousands of Approvals page by page through continuation tokens", async () => {
    const client = createMockClient("longList");
    const ids = new Set<string>();
    let token: string | null = null;
    let pages = 0;
    do {
      const page = await client.listApprovals({}, { size: 100, continuationToken: token });
      expect(page.items.length).toBeLessThanOrEqual(100);
      page.items.forEach((i) => ids.add(i.id));
      token = page.continuationToken;
      pages += 1;
    } while (token);

    expect(ids.size).toBe(5000);
    expect(pages).toBe(50);
  });

  it("is a known scenario name", () => {
    expect(isScenarioName("longList")).toBe(true);
    expect(isScenarioName("nope")).toBe(false);
  });
});

describe("mockClient multiStep scenario", () => {
  it("demonstrates a multi-stage Approval through getApprovalDetail", async () => {
    const client = createMockClient("multiStep");
    const page = await client.listApprovals({}, { size: 50 });
    const budget = page.items.find((i) => i.title === "Contoso budget approval")!;
    const detail = await client.getApprovalDetail(budget.id);
    expect(detail.steps.map((s) => s.number)).toEqual([1, 2]);
    expect(detail.steps[1].pendingApprovers.length).toBeGreaterThan(0);
  });

  it("rejects an unknown Approval with a notFound error", async () => {
    await expect(createMockClient("default").getApprovalDetail("00000000-0000-0000-0000-00000000ffff")).rejects.toMatchObject({ kind: "notFound" });
  });
});

describe("mockClient Regarding Record", () => {
  it("records openRecord calls", async () => {
    const client = createMockClient("default");
    await client.openRecord({ entityName: "account", entityId: "00000000-0000-0000-0000-0000000000aa" });
    expect(client.openedRecords).toEqual([{ entityName: "account", entityId: "00000000-0000-0000-0000-0000000000aa" }]);
  });

  it("resolves a Regarding Record in default and none in noRegarding", async () => {
    const withLink = await createMockClient("default").getApprovalDetail("00000000-0000-0000-0000-00000000a001");
    expect(withLink.regarding).not.toBeNull();
    const none = createMockClient("noRegarding");
    const { items } = await none.listApprovals({}, { size: 50 });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect((await none.getApprovalDetail(item.id)).regarding).toBeNull();
    expect(isScenarioName("noRegarding")).toBe(true);
  });
});
