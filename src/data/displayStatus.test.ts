import { describe, expect, it } from "vitest";
import type { ApprovalStatus } from "./dataClient";
import { DISPLAY_STATUS_ORDER } from "./displayStatus";
import { toTiles } from "./statusTiles";
import { compileFilter } from "./xrm/fakeFilter";
import { deriveStatus } from "./xrm/mappers";
import { buildFilter } from "./xrm/odataQuery";

const [CREATED, PENDING, SUSPENDED, COMPLETED, EXPIRED, CANCELLED, ABANDONED] = [192350000, 192350001, 192350002, 192350004, 192350005, 192350006, 192350007];

// Stored values written out by hand, with the Display Status each must have.
const STORED: [number, string | null, ApprovalStatus][] = [
  [CREATED, null, "pending"],
  [PENDING, null, "pending"],
  [SUSPENDED, null, "pending"],
  [COMPLETED, "Approve", "approved"],
  [COMPLETED, "approved", "approved"],
  [COMPLETED, "Reject", "rejected"],
  [COMPLETED, "Rejected", "rejected"],
  [COMPLETED, "Maybe", "completed"],
  [COMPLETED, null, "completed"],
  [CANCELLED, null, "cancelled"],
  [EXPIRED, null, "expired"],
  [ABANDONED, null, "abandoned"],
];

describe("display status table", () => {
  it.each(STORED)("statuscode %d with result %j is shown as %s", (statuscode, result, expected) => {
    expect(deriveStatus(statuscode, result).status).toBe(expected);
  });

  it("ignores case and surrounding blanks of the result when deriving the status", () => {
    expect(deriveStatus(COMPLETED, " APPROVED ").status).toBe("approved");
  });

  it("shows an unknown statuscode as Pending so the Approval stays visible", () => {
    expect(deriveStatus(1, null).status).toBe("pending");
  });

  it("lists the statuses in UI order", () => {
    expect([...DISPLAY_STATUS_ORDER]).toEqual(["pending", "approved", "rejected", "completed", "cancelled", "expired", "abandoned"]);
  });

  it("the $filter of each status matches exactly the stored values deriveStatus shows as that status", () => {
    for (const status of DISPLAY_STATUS_ORDER) {
      const matches = compileFilter(buildFilter({ statuses: [status] })!);
      for (const [statuscode, result, expected] of STORED) {
        expect(matches({ statuscode, msdyn_flow_approval_result: result }), `${status} vs ${statuscode}/${result}`).toBe(expected === status);
      }
    }
  });

  it("every status counts in exactly one summary tile", () => {
    for (const status of DISPLAY_STATUS_ORDER) {
      const counts = Object.fromEntries(DISPLAY_STATUS_ORDER.map((s) => [s, s === status ? 1 : 0])) as Record<ApprovalStatus, number>;
      expect(Object.values(toTiles(counts)).reduce((a, b) => a + b, 0)).toBe(1);
    }
  });
});
