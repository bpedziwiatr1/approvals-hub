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

const ME = "00000000-0000-0000-0000-0000000000f1";
const OTHER = "00000000-0000-0000-0000-0000000000b1";
const REQUESTS = "msdyn_flow_approvalrelationship_approvalrequests";

describe("buildFilter: Owner, Approver, Assigned to me and dates", () => {
  it("matches the Owner on the owner lookup", () => {
    expect(buildFilter({ ownerId: OTHER })).toBe(`_ownerid_value eq ${OTHER}`);
  });

  it("matches the Approver with any() over the Approval Requests", () => {
    expect(buildFilter({ approverId: OTHER })).toBe(`${REQUESTS}/any(r:r/_ownerid_value eq ${OTHER})`);
  });

  it("matches Assigned to me with any() for the current user", () => {
    expect(buildFilter({ assignedToMe: { pendingOnly: false } }, ME)).toBe(`${REQUESTS}/any(r:r/_ownerid_value eq ${ME})`);
  });

  it("adds the active state of the request when Assigned to me is pending only", () => {
    expect(buildFilter({ assignedToMe: { pendingOnly: true } }, ME)).toBe(`${REQUESTS}/any(r:r/_ownerid_value eq ${ME} and r/statecode eq 0)`);
  });

  it("needs the current user for Assigned to me", () => {
    expect(() => buildFilter({ assignedToMe: { pendingOnly: false } })).toThrow(/current user/i);
  });

  it("accepts a GUID with braces and capitals", () => {
    expect(buildFilter({ ownerId: "{00000000-0000-0000-0000-0000000000B1}" })).toBe(`_ownerid_value eq ${OTHER}`);
  });

  it("rejects an id that is not a GUID, so nothing is injected into the filter", () => {
    expect(() => buildFilter({ ownerId: "x or 1 eq 1" })).toThrow(/guid/i);
    expect(() => buildFilter({ approverId: "x)" })).toThrow(/guid/i);
  });

  it("sends the date range as ISO UTC, both ends inclusive", () => {
    expect(buildFilter({ createdFrom: "2025-05-02T00:00:00Z", createdTo: "2025-05-02T23:59:59.999Z" })).toBe(
      "createdon ge 2025-05-02T00:00:00.000Z and createdon le 2025-05-02T23:59:59.999Z",
    );
  });

  it("normalises an offset date to UTC", () => {
    expect(buildFilter({ createdFrom: "2025-05-02T02:00:00+02:00" })).toBe("createdon ge 2025-05-02T00:00:00.000Z");
  });

  it("rejects an unparsable date", () => {
    expect(() => buildFilter({ createdTo: "tomorrow-ish" })).toThrow(/date/i);
  });

  it("ANDs every filter", () => {
    expect(buildFilter({ title: "x", ownerId: OTHER, createdFrom: "2025-01-01T00:00:00Z" })).toBe(
      `contains(msdyn_flow_approval_title,'x') and _ownerid_value eq ${OTHER} and createdon ge 2025-01-01T00:00:00.000Z`,
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
