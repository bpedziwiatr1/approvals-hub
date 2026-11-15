import { describe, expect, it } from "vitest";
import { fluentTheme, resolveTheme } from "./theme";

describe("theme", () => {
  it("follows ?theme= and falls back to the system preference", () => {
    expect(resolveTheme("?theme=dark", false)).toBe("dark");
    expect(resolveTheme("?theme=light", true)).toBe("light");
    expect(resolveTheme("", true)).toBe("dark");
    expect(resolveTheme("", false)).toBe("light");
  });
});

describe("accent colour", () => {
  it("replaces the brand background of the theme", () => {
    expect(fluentTheme("light", "#107c10").colorBrandBackground).toBe("#107c10");
    expect(fluentTheme("dark", "#107c10").colorBrandBackground).toBe("#107c10");
  });

  it("keeps the stock theme without an accent", () => {
    expect(fluentTheme("light", null)).toBe(fluentTheme("light"));
  });
});
