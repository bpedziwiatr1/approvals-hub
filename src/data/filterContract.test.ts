import { describe, expect, it } from "vitest";
import type { ApprovalQuery, DataClient } from "./dataClient";
import { createMockClient } from "./mockClient";
import { createFakeXrm } from "./xrm/fakeXrm";
import { createXrmClient } from "./xrm/xrmClient";
import { scenarioApprovals } from "./scenarios";

const clients = (): [string, DataClient][] => [
  ["mockClient", createMockClient("statuses")],
  ["xrmClient", createXrmClient(createFakeXrm({ approvals: scenarioApprovals("statuses") }).xrm)],
];

const titles = async (client: DataClient, query: ApprovalQuery) =>
  (await client.listApprovals(query, { size: 100 })).items.map((i) => i.title);

// Expected titles are written out by hand from the scenario, independent of either implementation.
const CASES: [string, ApprovalQuery, string[]][] = [
  ["no filter", {}, ["Alpha pending", "Beta created", "Gamma suspended", "Delta approve", "Epsilon Approved", "Zeta reject", "Eta REJECTED", "Theta send back", "Iota no result", "Kappa cancelled", "Lambda expired", "Mu abandoned", "O'Brien request"]],
  ["title is case-insensitive and matches any part", { title: "ALPH" }, ["Alpha pending"]],
  ["title with a single quote", { title: "O'Brien" }, ["O'Brien request"]],
  ["Pending includes Created and Suspended", { statuses: ["pending"] }, ["Alpha pending", "Beta created", "Gamma suspended", "O'Brien request"]],
  ["Approved tolerates both spellings and case", { statuses: ["approved"] }, ["Delta approve", "Epsilon Approved"]],
  ["Rejected tolerates both spellings and case", { statuses: ["rejected"] }, ["Zeta reject", "Eta REJECTED"]],
  ["Other completed keeps custom and empty results", { statuses: ["completed"] }, ["Theta send back", "Iota no result"]],
  ["several statuses are ORed", { statuses: ["cancelled", "expired", "abandoned"] }, ["Kappa cancelled", "Lambda expired", "Mu abandoned"]],
  ["title and statuses are ANDed", { title: "e", statuses: ["approved", "cancelled"] }, ["Delta approve", "Epsilon Approved", "Kappa cancelled"]],
];

describe.each(clients())("%s filtering", (_name, client) => {
  it.each(CASES)("%s", async (_label, query, expected) => {
    expect(await titles(client, query)).toEqual(expected);
  });
});
