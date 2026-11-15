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
