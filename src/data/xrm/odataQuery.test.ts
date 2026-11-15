import { describe, expect, it } from "vitest";
import { buildFilter, buildListOptions } from "./odataQuery";

const NOT_APPROVE_REJECT =
  "(msdyn_flow_approval_result eq null or (msdyn_flow_approval_result ne 'Approve' and msdyn_flow_approval_result ne 'Approved' and msdyn_flow_approval_result ne 'Reject' and msdyn_flow_approval_result ne 'Rejected'))";

describe("buildFilter", () => {
  it("is null without title or statuses", () => {
    expect(buildFilter({})).toBeNull();
    expect(buildFilter({ title: "", statuses: [] })).toBeNull();
  });

  it("matches the title with contains", () => {
    expect(buildFilter({ title: "order" })).toBe("contains(msdyn_flow_approval_title,'order')");
  });

  it("escapes a single quote as two single quotes", () => {
    expect(buildFilter({ title: "O'Brien's" })).toBe("contains(msdyn_flow_approval_title,'O''Brien''s')");
  });

  it("translates Pending to the Created, Pending and Suspended statuscodes", () => {
    expect(buildFilter({ statuses: ["pending"] })).toBe("(statuscode eq 192350000 or statuscode eq 192350001 or statuscode eq 192350002)");
  });

  it("translates Approved and Rejected to Completed plus both result spellings", () => {
    expect(buildFilter({ statuses: ["approved"] })).toBe(
      "(statuscode eq 192350004 and (msdyn_flow_approval_result eq 'Approve' or msdyn_flow_approval_result eq 'Approved'))",
    );
    expect(buildFilter({ statuses: ["rejected"] })).toBe(
      "(statuscode eq 192350004 and (msdyn_flow_approval_result eq 'Reject' or msdyn_flow_approval_result eq 'Rejected'))",
    );
  });

  it("translates the other Completed outcome to Completed with any result that is neither approve nor reject", () => {
    expect(buildFilter({ statuses: ["completed"] })).toBe(`(statuscode eq 192350004 and ${NOT_APPROVE_REJECT})`);
  });

  it("translates Cancelled, Expired and Abandoned directly to statuscode", () => {
    expect(buildFilter({ statuses: ["cancelled", "expired", "abandoned"] })).toBe(
      "(statuscode eq 192350006 or statuscode eq 192350005 or statuscode eq 192350007)",
    );
  });

  it("ORs the statuses and ANDs them with the title", () => {
    expect(buildFilter({ title: "x", statuses: ["cancelled", "expired"] })).toBe(
      "contains(msdyn_flow_approval_title,'x') and (statuscode eq 192350006 or statuscode eq 192350005)",
    );
  });
});

describe("buildListOptions", () => {
  it("adds the filter, URL-encoded, to the list options", () => {
    const options = buildListOptions({ title: "a&b+c'd" });
    const params = new URLSearchParams(options.slice(1));
    expect(params.get("$filter")).toBe("contains(msdyn_flow_approval_title,'a&b+c''d')");
    expect(params.get("$orderby")).toBe("createdon desc");
  });
});

describe("buildFilter Profile Scope", () => {
  it.each([
    ["equals", "msdyn_flow_approval_title eq 'Contoso PO'"],
    ["startsWith", "startswith(msdyn_flow_approval_title,'Contoso PO')"],
    ["contains", "contains(msdyn_flow_approval_title,'Contoso PO')"],
  ] as const)("maps the %s title mode", (mode, expected) => {
    expect(buildFilter({ scope: { title: { mode, value: "Contoso PO" } } })).toBe(expected);
  });

  it("matches category exactly and tags with contains, escaping quotes", () => {
    expect(buildFilter({ scope: { category: "O'Brien", tags: "eu" } })).toBe(
      "msdyn_flow_approval_category eq 'O''Brien' and contains(msdyn_flow_approval_tags,'eu')",
    );
  });

  it("ANDs every scope criterion with the title search and the status set", () => {
    expect(
      buildFilter({
        scope: { title: { mode: "startsWith", value: "PO" }, category: "Purchasing", tags: "eu" },
        title: "order",
        statuses: ["cancelled"],
      }),
    ).toBe(
      "startswith(msdyn_flow_approval_title,'PO') and msdyn_flow_approval_category eq 'Purchasing' and contains(msdyn_flow_approval_tags,'eu')" +
        " and contains(msdyn_flow_approval_title,'order') and (statuscode eq 192350006)",
    );
  });

  it("is null for an empty scope", () => {
    expect(buildFilter({ scope: {} })).toBeNull();
  });
});
