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

  it("falls back to the Dataverse language of the user: Polish for 1045, English otherwise; ?lang= wins", () => {
    expect(resolveLang("", 1045)).toBe("pl");
    expect(resolveLang("", 1033)).toBe("en");
    expect(resolveLang("", 1031)).toBe("en");
    expect(resolveLang("?lang=en", 1045)).toBe("en");
    expect(resolveLang("?lang=xx", 1045)).toBe("pl");
  });
});
