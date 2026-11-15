import { describe, expect, it } from "vitest";
import { readFilters, writeFilters } from "./urlState";

describe("filters in the URL query string", () => {
  it("reads title and statuses", () => {
    expect(readFilters("?q=order&status=pending,rejected")).toEqual({ title: "order", statuses: ["pending", "rejected"] });
  });

  it("reads empty filters when absent", () => {
    expect(readFilters("")).toEqual({ title: "", statuses: [] });
  });

  it("ignores unknown statuses and duplicates", () => {
    expect(readFilters("?status=pending,bogus,pending")).toEqual({ title: "", statuses: ["pending"] });
  });

  it("writes filters and keeps unrelated parameters", () => {
    expect(writeFilters("?scenario=default&lang=en", { title: "a b&c", statuses: ["approved", "completed"] })).toBe(
      "?scenario=default&lang=en&q=a+b%26c&status=approved%2Ccompleted",
    );
  });

  it("removes the parameters when the filters are empty", () => {
    expect(writeFilters("?scenario=default&q=x&status=pending", { title: "", statuses: [] })).toBe("?scenario=default");
    expect(writeFilters("?q=x", { title: "", statuses: [] })).toBe("");
  });

  it("round-trips", () => {
    const filters = { title: "O'Brien é", statuses: ["cancelled" as const, "expired" as const] };
    expect(readFilters(writeFilters("", filters))).toEqual(filters);
  });
});

describe("Owner, Approver, date range and Assigned to me in the URL", () => {
  const OWNER = "00000000-0000-0000-0000-000000000e01";
  const APPROVER = "00000000-0000-0000-0000-0000000000b1";

  it("reads them", () => {
    expect(readFilters(`?owner=${OWNER}&approver=${APPROVER}&from=2025-05-01&to=2025-05-31&mine=pending`)).toEqual({
      title: "",
      statuses: [],
      ownerId: OWNER,
      approverId: APPROVER,
      createdFrom: "2025-05-01",
      createdTo: "2025-05-31",
      assignedToMe: { pendingOnly: true },
    });
    expect(readFilters("?mine=1").assignedToMe).toEqual({ pendingOnly: false });
  });

  it("ignores a malformed id, date or mine value", () => {
    expect(readFilters("?owner=x&approver=1 or 1&from=2025-13-40&to=soon&mine=maybe")).toEqual({ title: "", statuses: [] });
  });

  it("writes them and keeps other parameters", () => {
    expect(
      writeFilters("?scenario=default", { title: "", statuses: [], ownerId: OWNER, approverId: APPROVER, createdFrom: "2025-05-01", createdTo: "2025-05-31", assignedToMe: { pendingOnly: true } }),
    ).toBe(`?scenario=default&owner=${OWNER}&approver=${APPROVER}&from=2025-05-01&to=2025-05-31&mine=pending`);
    expect(writeFilters("", { title: "", statuses: [], assignedToMe: { pendingOnly: false } })).toBe("?mine=1");
  });

  it("removes them when cleared", () => {
    expect(writeFilters(`?owner=${OWNER}&mine=1&from=2025-05-01`, { title: "", statuses: [] })).toBe("");
  });

  it("round-trips", () => {
    const filters = { title: "x", statuses: [], ownerId: OWNER, createdTo: "2025-05-31", assignedToMe: { pendingOnly: true } };
    expect(readFilters(writeFilters("", filters))).toEqual({ ...filters });
  });
});
