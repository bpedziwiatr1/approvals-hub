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
