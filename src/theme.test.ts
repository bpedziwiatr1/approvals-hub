import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";

describe("theme", () => {
  it("follows ?theme= and falls back to the system preference", () => {
    expect(resolveTheme("?theme=dark", false)).toBe("dark");
    expect(resolveTheme("?theme=light", true)).toBe("light");
    expect(resolveTheme("", true)).toBe("dark");
    expect(resolveTheme("", false)).toBe("light");
  });
});
