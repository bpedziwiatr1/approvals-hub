import { describe, expect, it } from "vitest";
import { createMockClient } from "./mockClient";

describe("mockClient default scenario", () => {
  it("returns a page of Approval list items through the DataClient interface", async () => {
    const client = createMockClient("default");
    const page = await client.listApprovals({}, { size: 50 });
    expect(page.items.map(i => i.status)).toEqual(["pending", "approved", "rejected"]);
    expect(page.continuationToken).toBeNull();
  });
});
