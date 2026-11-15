import { describe, expect, it } from "vitest";
import en from "./en.json";
import pl from "./pl.json";
import { resolveLang } from "./index";

describe("i18n", () => {
  it("has the same keys in PL and EN", () => {
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
  });

  it("resolves language from ?lang=, defaulting to en", () => {
    expect(resolveLang("?lang=pl")).toBe("pl");
    expect(resolveLang("?lang=en")).toBe("en");
    expect(resolveLang("?lang=xx")).toBe("en");
    expect(resolveLang("")).toBe("en");
  });
});
