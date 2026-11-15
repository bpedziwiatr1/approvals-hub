import { describe, expect, it } from "vitest";
import { selectClient } from "./selectClient";
import { buildApproval } from "./factories";
import { createFakeXrm } from "./xrm/fakeXrm";
import type { HostWindow } from "./xrm/xrmClient";

const noXrm: HostWindow = { parent: {} };

describe("selectClient", () => {
  it("uses the real Xrm of the model-driven app when it is present", async () => {
    const fake = createFakeXrm({ approvals: [buildApproval({ msdyn_flow_approval_title: "Contoso from Dataverse" })] });
    const { client, source } = selectClient("", { parent: { Xrm: fake.xrm } });

    const page = await client.listApprovals({}, { size: 50 });

    expect(source).toBe("xrm");
    expect(page.items.map((i) => i.title)).toEqual(["Contoso from Dataverse"]);
    expect(fake.requests).toHaveLength(1);
  });

  it("falls back to mockClient with the requested scenario when Xrm is absent", async () => {
    const { client, source } = selectClient("?scenario=longList", noXrm);
    expect(source).toBe("mock");
    expect((await client.listApprovals({}, { size: 10 })).continuationToken).not.toBeNull();
  });

  it("runs the real xrmClient against an in-memory fake Xrm with ?client=fakeXrm", async () => {
    const { client, source } = selectClient("?client=fakeXrm&scenario=default", noXrm);
    const page = await client.listApprovals({}, { size: 50 });
    expect(source).toBe("fakeXrm");
    expect(page.items.map((i) => [i.title, i.status])).toEqual([
      ["Contoso purchase order 1001", "pending"],
      ["Contoso travel request 2002", "approved"],
      ["Contoso contract renewal 3003", "rejected"],
    ]);
  });

  it("pages the longList scenario through @odata.nextLink with ?client=fakeXrm", async () => {
    const { client } = selectClient("?client=fakeXrm&scenario=longList", noXrm);
    const first = await client.listApprovals({}, { size: 100 });
    const second = await client.listApprovals({}, { size: 100, continuationToken: first.continuationToken });
    expect(first.items).toHaveLength(100);
    expect(second.items[0].title).toBe("Contoso long list approval 0101");
  });
});
