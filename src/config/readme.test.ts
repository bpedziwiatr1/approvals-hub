import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveProfile } from "./profileConfig";

// Every ```json block in the README is a whole configuration value; each Profile it names must resolve without notices.
// Vitest runs from the repository root.
const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
const examples = [...readme.matchAll(/```json\n([\s\S]*?)```/g)].map((match) => match[1]);

describe("README configuration examples", () => {
  it("contains configuration examples", () => {
    expect(examples.length).toBeGreaterThan(0);
  });

  it.each(examples.map((raw, i) => [i, raw]))("example %i validates against the profile schema", (_i, raw) => {
    const names = Object.keys((JSON.parse(raw) as { profiles: Record<string, unknown> }).profiles);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(resolveProfile(raw, name).notices).toEqual([]);
    }
  });
});
