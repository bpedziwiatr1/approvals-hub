import { describe, expect, it } from "vitest";
import { formatInUserTime, userDayRange } from "./userTime";

// Offsets are minutes to add to UTC to get the user's local time (Warsaw in winter: +60, New York in winter: -300).
describe("userDayRange", () => {
  it("covers the user's calendar days, both ends inclusive, as UTC instants", () => {
    expect(userDayRange({ from: "2025-03-10", to: "2025-03-12" }, 60)).toEqual({
      createdFrom: "2025-03-09T23:00:00.000Z",
      createdTo: "2025-03-12T22:59:59.999Z",
    });
  });

  it("works west of UTC", () => {
    expect(userDayRange({ from: "2025-01-05", to: "2025-01-05" }, -300)).toEqual({
      createdFrom: "2025-01-05T05:00:00.000Z",
      createdTo: "2025-01-06T04:59:59.999Z",
    });
  });

  it("leaves an open end open", () => {
    expect(userDayRange({ from: "2025-03-10" }, 0)).toEqual({ createdFrom: "2025-03-10T00:00:00.000Z" });
    expect(userDayRange({ to: "2025-03-10" }, 0)).toEqual({ createdTo: "2025-03-10T23:59:59.999Z" });
    expect(userDayRange({}, 120)).toEqual({});
  });

  it("puts an instant just before local midnight on the earlier user day", () => {
    const { createdFrom } = userDayRange({ from: "2025-03-10" }, 60);
    expect(Date.parse("2025-03-09T22:59:59.999Z")).toBeLessThan(Date.parse(createdFrom!));
    expect(Date.parse("2025-03-09T23:00:00.000Z")).toBe(Date.parse(createdFrom!));
  });
});

describe("formatInUserTime", () => {
  it("shows the instant in the user's time zone, in the user's language format", () => {
    expect(formatInUserTime("2025-04-01T23:30:00Z", "en", 120)).toMatch(/^Apr 2, 2025, 1:30\sAM$/);
    expect(formatInUserTime("2025-04-01T23:30:00Z", "en", -300)).toMatch(/^Apr 1, 2025, 6:30\sPM$/);
  });

  it("uses the Polish format for pl", () => {
    expect(formatInUserTime("2025-04-01T23:30:00Z", "pl", 120)).toMatch(/^2 kwi 2025,? 01:30$/);
  });
});
