import { describe, expect, it } from "vitest";
import { resolveRegarding } from "./regarding";

const ID = "00000000-0000-0000-0000-0000000000aa";
const link = (query: string) => `https://contoso.crm.dynamics.com/main.aspx?${query}`;
const expected = { entityName: "account", entityId: ID };

describe("resolveRegarding", () => {
  it("resolves the item link", () => {
    expect(resolveRegarding({ itemLink: link(`pagetype=entityrecord&etn=account&id=${ID}`), details: "" })).toEqual(expected);
  });

  it("prefers the item link over a link in the details", () => {
    const other = "00000000-0000-0000-0000-0000000000bb";
    const result = resolveRegarding({ itemLink: link(`etn=account&id=${ID}`), details: `[x](${link(`etn=contact&id=${other}`)})` });
    expect(result).toEqual(expected);
  });

  it("falls back to the details when the item link is empty, null or not a record link", () => {
    const details = `See ${link(`etn=account&id=${ID}`)}`;
    expect(resolveRegarding({ itemLink: "", details })).toEqual(expected);
    expect(resolveRegarding({ itemLink: null, details })).toEqual(expected);
    expect(resolveRegarding({ itemLink: "https://example.com/page", details })).toEqual(expected);
    expect(resolveRegarding({ details })).toEqual(expected);
  });

  it.each([
    ["markdown link", (u: string) => `Please check [the record](${u}) today.`],
    ["HTML anchor", (u: string) => `<p>Open <a href="${u.replaceAll("&", "&amp;")}">record</a></p>`],
    ["bare URL", (u: string) => `Record: ${u}.`],
    ["bare URL in angle brackets", (u: string) => `Record: <${u}>`],
  ])("finds a %s in the details", (_name, wrap) => {
    expect(resolveRegarding({ itemLink: null, details: wrap(link(`pagetype=entityrecord&etn=account&id=${ID}`)) })).toEqual(expected);
  });

  it("uses the first Dataverse record link and skips links without etn", () => {
    const details = `[docs](https://example.com/a?id=1) then ${link(`etn=contact&id=${ID}`)} and ${link("etn=account&id=00000000-0000-0000-0000-0000000000cc")}`;
    expect(resolveRegarding({ details })).toEqual({ entityName: "contact", entityId: ID });
  });

  it("accepts braces, any case in the id and a missing pagetype, and normalises the result", () => {
    const upper = "{00000000-0000-0000-0000-0000000000AA}";
    expect(resolveRegarding({ itemLink: link(`etn=Account&id=${upper}`) })).toEqual(expected);
    expect(resolveRegarding({ itemLink: link(`etn=account&id=${encodeURIComponent(upper)}`) })).toEqual(expected);
  });

  it("accepts a relative item link", () => {
    expect(resolveRegarding({ itemLink: `/main.aspx?etn=account&id=${ID}` })).toEqual(expected);
  });

  it.each([
    ["empty id", link("etn=account&id=")],
    ["missing id", link("etn=account")],
    ["invalid id", link("etn=account&id=not-a-guid")],
    ["missing etn", link(`id=${ID}`)],
    ["empty etn", link(`etn=&id=${ID}`)],
  ])("returns null for a link with %s", (_name, url) => {
    expect(resolveRegarding({ itemLink: url })).toBeNull();
    expect(resolveRegarding({ details: `[x](${url})` })).toBeNull();
  });

  it("returns null for garbage and for nothing", () => {
    expect(resolveRegarding({})).toBeNull();
    expect(resolveRegarding({ itemLink: "%%%not a url", details: "no links here, id=1 etn=account" })).toBeNull();
    expect(resolveRegarding({ itemLink: "http://", details: "http://[" })).toBeNull();
  });
});
