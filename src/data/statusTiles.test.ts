import { describe, expect, it } from "vitest";
import { toTiles } from "./statusTiles";

describe("toTiles", () => {
  it("shows Pending, Approved and Rejected as they are and sums Completed with another outcome, Cancelled, Expired and Abandoned as Other", () => {
    expect(
      toTiles({ pending: 4, approved: 3, rejected: 2, completed: 1, cancelled: 5, expired: 6, abandoned: 7 }),
    ).toEqual({ pending: 4, approved: 3, rejected: 2, other: 19 });
  });

  it("is all zeros when nothing matches", () => {
    expect(toTiles({ pending: 0, approved: 0, rejected: 0, completed: 0, cancelled: 0, expired: 0, abandoned: 0 })).toEqual({
      pending: 0,
      approved: 0,
      rejected: 0,
      other: 0,
    });
  });
});
