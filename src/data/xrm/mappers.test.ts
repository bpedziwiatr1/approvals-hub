import { describe, expect, it } from "vitest";
import { deriveStatus } from "./mappers";

describe("deriveStatus", () => {
  it.each([
    [192350000, null, "pending"],
    [192350001, null, "pending"],
    [192350002, null, "pending"],
    [192350005, null, "expired"],
    [192350006, null, "cancelled"],
    [192350007, null, "abandoned"],
  ])("maps statuscode %i to %s", (statuscode, result, expected) => {
    expect(deriveStatus(statuscode, result)).toEqual({ status: expected, outcome: null });
  });

  it.each(["Approve", "Approved", "approve", "APPROVED", " Approved "])("treats completed with result %j as approved", (result) => {
    expect(deriveStatus(192350004, result)).toEqual({ status: "approved", outcome: null });
  });

  it.each(["Reject", "Rejected", "reject", "REJECTED"])("treats completed with result %j as rejected", (result) => {
    expect(deriveStatus(192350004, result)).toEqual({ status: "rejected", outcome: null });
  });

  it("treats completed with any other result as completed with that Outcome", () => {
    expect(deriveStatus(192350004, "Needs rework")).toEqual({ status: "completed", outcome: "Needs rework" });
  });

  it("treats completed without a result as completed with no Outcome", () => {
    expect(deriveStatus(192350004, null)).toEqual({ status: "completed", outcome: null });
  });
});
