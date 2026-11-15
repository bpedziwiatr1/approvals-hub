import { describe, expect, it } from "vitest";
import type { ApprovalQuery, DataClient } from "./dataClient";
import { createMockClient } from "./mockClient";
import { scenarioApprovals, type ScenarioName } from "./scenarios";
import { createFakeXrm } from "./xrm/fakeXrm";
import { createXrmClient } from "./xrm/xrmClient";

const clients = (scenario: ScenarioName): [string, DataClient][] => [
  ["mockClient", createMockClient(scenario)],
  ["xrmClient", createXrmClient(createFakeXrm({ approvals: scenarioApprovals(scenario) }).xrm)],
];

const titles = async (client: DataClient, query: ApprovalQuery) => (await client.listApprovals(query, { size: 100 })).items.map((i) => i.title);

// Expected orders are written out by hand from the scenarios. Ties are broken by created on, newest first.
const STATUSES: [string, ApprovalQuery, string[]][] = [
  ["title ascending", { sort: { field: "title", descending: false } }, ["Alpha pending", "Beta created", "Delta approve", "Epsilon Approved", "Eta REJECTED", "Gamma suspended", "Iota no result", "Kappa cancelled", "Lambda expired", "Mu abandoned", "O'Brien request", "Theta send back", "Zeta reject"]],
  ["title descending", { sort: { field: "title", descending: true } }, ["Zeta reject", "Theta send back", "O'Brien request", "Mu abandoned", "Lambda expired", "Kappa cancelled", "Iota no result", "Gamma suspended", "Eta REJECTED", "Epsilon Approved", "Delta approve", "Beta created", "Alpha pending"]],
  ["created on ascending", { sort: { field: "createdOn", descending: false } }, ["O'Brien request", "Mu abandoned", "Lambda expired", "Kappa cancelled", "Iota no result", "Theta send back", "Eta REJECTED", "Zeta reject", "Epsilon Approved", "Delta approve", "Gamma suspended", "Beta created", "Alpha pending"]],
  ["status ascending, by stored status code", { sort: { field: "status", descending: false } }, ["Beta created", "Alpha pending", "O'Brien request", "Gamma suspended", "Delta approve", "Epsilon Approved", "Zeta reject", "Eta REJECTED", "Theta send back", "Iota no result", "Lambda expired", "Kappa cancelled", "Mu abandoned"]],
  ["a filter and a sort together", { statuses: ["cancelled", "expired", "abandoned"], sort: { field: "title", descending: true } }, ["Mu abandoned", "Lambda expired", "Kappa cancelled"]],
];

describe.each(clients("statuses"))("%s sorting", (_name, client) => {
  it.each(STATUSES)("%s", async (_label, query, expected) => {
    expect(await titles(client, query)).toEqual(expected);
  });
});

const OWNERS: [string, ApprovalQuery, string[]][] = [
  ["owner ascending", { sort: { field: "owner", descending: false } }, ["Alpha mine pending", "Gamma others pending", "Beta mine decided", "Delta others completed"]],
  ["owner descending", { sort: { field: "owner", descending: true } }, ["Beta mine decided", "Delta others completed", "Alpha mine pending", "Gamma others pending"]],
];

describe.each(clients("currentUserIsApprover"))("%s sorting by owner", (_name, client) => {
  it.each(OWNERS)("%s", async (_label, query, expected) => {
    expect(await titles(client, query)).toEqual(expected);
  });
});

describe.each(clients("multiStep"))("%s sorting by current Approval Step", (_name, client) => {
  it("orders by the current step number", async () => {
    expect(await titles(client, { sort: { field: "currentStep", descending: false } })).toEqual(["Contoso rework request", "Contoso budget approval"]);
    expect(await titles(client, { sort: { field: "currentStep", descending: true } })).toEqual(["Contoso budget approval", "Contoso rework request"]);
  });

  it("pages in the sorted order", async () => {
    const query: ApprovalQuery = { sort: { field: "currentStep", descending: true } };
    const first = await client.listApprovals(query, { size: 1 });
    const second = await client.listApprovals(query, { size: 1, continuationToken: first.continuationToken });
    expect([first.items[0].title, second.items[0].title]).toEqual(["Contoso budget approval", "Contoso rework request"]);
  });
});

describe.each(clients("multiStep"))("%s list columns", (_name, client) => {
  it("gives the Owner, the current Approval Step and the last decision of each Approval", async () => {
    const { items } = await client.listApprovals({}, { size: 10 });
    const budget = items.find((i) => i.title === "Contoso budget approval")!;
    expect(budget.currentStep).toBe(2);
    expect(budget.owner).toEqual({ id: "00000000-0000-0000-0000-0000000000e1", name: "Olga Contoso" });
    expect(budget.lastDecision).toEqual({ approver: { id: "00000000-0000-0000-0000-0000000000c1", name: "Ann Contoso" }, response: "Approve", decidedOn: "2025-04-02T09:15:00.000Z" });
    const rework = items.find((i) => i.title === "Contoso rework request")!;
    expect(rework.lastDecision).toMatchObject({ approver: { name: "Dave Contoso" }, response: "Send back" });
  });

  it("has no last decision for an Approval nobody answered yet", async () => {
    const { items } = await createMockClient("noRegarding").listApprovals({}, { size: 10 });
    expect(items[0]).toMatchObject({ owner: null, currentStep: null, lastDecision: null });
  });
});
