import { describe, expect, it } from "vitest";
import definitionXml from "../../solution/src/environmentvariabledefinitions/bpt_ApprovalsHubConfig/environmentvariabledefinition.xml?raw";
import { resolveProfile } from "./profileConfig";

/** The default value of the environment variable as shipped in the solution, with XML escaping undone. */
function shippedDefaultValue(): string {
  const match = /<defaultvalue>([\s\S]*?)<\/defaultvalue>/.exec(definitionXml);
  if (!match) throw new Error("The environment variable definition has no default value.");
  return match[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

describe("shipped default value of bpt_ApprovalsHubConfig", () => {
  it("is a valid configuration whose default Profile shows Pending Approvals first", () => {
    const { profile, notices } = resolveProfile(shippedDefaultValue(), null);
    expect(notices).toEqual([]);
    expect(profile.name).toBe("default");
    expect(profile.defaultStatus).toBe("pending");
  });
});
