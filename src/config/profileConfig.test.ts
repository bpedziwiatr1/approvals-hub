import { describe, expect, it } from "vitest";
import { profileNameFromSearch, resolveProfile } from "./profileConfig";

const BUILT_IN = {
  name: "default",
  pageTitle: null,
  columns: ["title", "status", "createdOn", "owner", "currentStep", "lastDecision"],
  pageSize: 100,
  defaultStatus: "pending",
  accentColor: null,
  scope: {},
};

const config = (profiles: Record<string, unknown>) => JSON.stringify({ profiles });

describe("resolveProfile fallback order", () => {
  it("uses the built-in defaults when there is no configuration value", () => {
    expect(resolveProfile(null, null)).toEqual({ profile: BUILT_IN, notices: [] });
  });

  it("uses the configured default profile when no profile is requested", () => {
    const { profile, notices } = resolveProfile(config({ default: { pageTitle: "All approvals", pageSize: 25 } }), null);
    expect(notices).toEqual([]);
    expect(profile).toEqual({ ...BUILT_IN, pageTitle: "All approvals", pageSize: 25 });
  });

  it("resolves a named profile with every setting", () => {
    const raw = config({
      purchasing: {
        pageTitle: "Purchasing",
        columns: ["status", "title"],
        pageSize: 50,
        defaultStatus: "pending",
        accentColor: "#0f6cbd",
        scope: { title: { mode: "startsWith", value: "Contoso PO" }, category: "Purchasing", tags: "urgent" },
      },
    });
    expect(resolveProfile(raw, "purchasing")).toEqual({
      profile: {
        name: "purchasing",
        pageTitle: "Purchasing",
        columns: ["status", "title"],
        pageSize: 50,
        defaultStatus: "pending",
        accentColor: "#0f6cbd",
        scope: { title: { mode: "startsWith", value: "Contoso PO" }, category: "Purchasing", tags: "urgent" },
      },
      notices: [],
    });
  });
});

describe("resolveProfile columns", () => {
  it("accepts every grid column in any order", () => {
    const columns = ["lastDecision", "owner", "currentStep", "createdOn", "status", "title"];
    expect(resolveProfile(config({ a: { columns } }), "a").profile.columns).toEqual(columns);
  });
});

describe("resolveProfile unknown profile", () => {
  it("reports it and shows the default profile", () => {
    const { profile, notices } = resolveProfile(config({ default: { pageTitle: "Home" } }), "nope");
    expect(notices).toEqual([{ kind: "unknownProfile", name: "nope" }]);
    expect(profile.name).toBe("default");
    expect(profile.pageTitle).toBe("Home");
  });

  it("falls back to the built-in defaults when the configuration defines no default", () => {
    const { profile, notices } = resolveProfile(config({ other: {} }), "nope");
    expect(notices).toEqual([{ kind: "unknownProfile", name: "nope" }]);
    expect(profile).toEqual(BUILT_IN);
  });
});

describe("resolveProfile extends", () => {
  it("inherits what the child does not set and overrides what it does", () => {
    const raw = config({
      base: { pageTitle: "Base", pageSize: 20, accentColor: "#112233" },
      child: { extends: "base", pageSize: 30 },
    });
    const { profile } = resolveProfile(raw, "child");
    expect(profile).toMatchObject({ name: "child", pageTitle: "Base", pageSize: 30, accentColor: "#112233" });
  });

  it("resolves chains recursively", () => {
    const raw = config({ a: { pageTitle: "A", pageSize: 10 }, b: { extends: "a", pageSize: 20 }, c: { extends: "b", defaultStatus: "approved" } });
    expect(resolveProfile(raw, "c").profile).toMatchObject({ pageTitle: "A", pageSize: 20, defaultStatus: "approved" });
  });

  it("merges the Profile Scope per criterion, the child winning", () => {
    const raw = config({
      base: { scope: { category: "Purchasing", tags: "eu" } },
      child: { extends: "base", scope: { category: "Travel", title: { mode: "contains", value: "trip" } } },
    });
    expect(resolveProfile(raw, "child").profile.scope).toEqual({ category: "Travel", tags: "eu", title: { mode: "contains", value: "trip" } });
  });

  it.each([
    ["a profile extending itself", { a: { extends: "a" } }],
    ["two profiles extending each other", { a: { extends: "b" }, b: { extends: "a" } }],
    ["a longer loop", { a: { extends: "b" }, b: { extends: "c" }, c: { extends: "a" } }],
  ])("detects a cycle: %s", (_, profiles) => {
    const { profile, notices } = resolveProfile(config(profiles), "a");
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ kind: "invalidConfig" });
    expect((notices[0] as { detail: string }).detail).toMatch(/cycle/i);
    expect(profile).toEqual(BUILT_IN);
  });

  it("reports extending a profile that does not exist", () => {
    const { profile, notices } = resolveProfile(config({ a: { extends: "ghost" } }), "a");
    expect(notices[0]).toMatchObject({ kind: "invalidConfig" });
    expect((notices[0] as { detail: string }).detail).toContain("ghost");
    expect(profile).toEqual(BUILT_IN);
  });
});

describe("resolveProfile invalid configuration", () => {
  it.each([
    ["JSON that does not parse", "{ not json"],
    ["a missing profiles object", "{}"],
    ["an unknown scope mode", config({ a: { scope: { title: { mode: "regex", value: "x" } } } })],
    ["a page size of zero", config({ a: { pageSize: 0 } })],
    ["an unknown column", config({ a: { columns: ["title", "colour"] } })],
    ["an unknown default status", config({ a: { defaultStatus: "maybe" } })],
    ["an accent colour that is not hex", config({ a: { accentColor: "blue" } })],
    ["an empty scope title value", config({ a: { scope: { title: { mode: "equals", value: "" } } } })],
  ])("shows a readable message and the built-in defaults for %s", (_, raw) => {
    const { profile, notices } = resolveProfile(raw, "a");
    expect(profile).toEqual(BUILT_IN);
    expect(notices).toHaveLength(1);
    expect(notices[0].kind).toBe("invalidConfig");
    expect((notices[0] as { detail: string }).detail.length).toBeGreaterThan(0);
  });

  it("does not add an unknown-profile notice on top of an invalid configuration", () => {
    expect(resolveProfile("{ not json", "nope").notices).toHaveLength(1);
  });
});

describe("profileNameFromSearch", () => {
  it.each([
    ["", null],
    ["?data=profile%3Dpurchasing", "purchasing"],
    ["?data=profile%3Dpurchasing%26other%3D1", "purchasing"],
    ["?profile=travel", "travel"],
    ["?data=other%3D1", null],
    ["?profile=", null],
  ])("%j gives %j", (search, expected) => {
    expect(profileNameFromSearch(search)).toBe(expected);
  });
});
