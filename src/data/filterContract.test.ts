import { describe, expect, it } from "vitest";
import type { ApprovalQuery, DataClient } from "./dataClient";
import { createMockClient } from "./mockClient";
import { createFakeXrm } from "./xrm/fakeXrm";
import { createXrmClient } from "./xrm/xrmClient";
import { scenarioApprovals, type ScenarioName } from "./scenarios";

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

const scopedClients = (): [string, DataClient][] => [
  ["mockClient", createMockClient("scoped")],
  ["xrmClient", createXrmClient(createFakeXrm({ approvals: scenarioApprovals("scoped") }).xrm)],
];

const SCOPE_CASES: [string, ApprovalQuery, string[]][] = [
  ["no scope", {}, ["Contoso PO 100", "Contoso PO 200", "Contoso trip Berlin", "Annual Contoso PO review", "Contoso PO"]],
  ["title equals is exact and case-insensitive", { scope: { title: { mode: "equals", value: "contoso po" } } }, ["Contoso PO"]],
  ["title startsWith", { scope: { title: { mode: "startsWith", value: "Contoso PO" } } }, ["Contoso PO 100", "Contoso PO 200", "Contoso PO"]],
  ["title contains", { scope: { title: { mode: "contains", value: "po " } } }, ["Contoso PO 100", "Contoso PO 200", "Annual Contoso PO review"]],
  ["category", { scope: { category: "Travel" } }, ["Contoso trip Berlin"]],
  ["tags are matched with contains", { scope: { tags: "urgent" } }, ["Contoso PO 100"]],
  ["scope criteria are ANDed", { scope: { title: { mode: "startsWith", value: "Contoso PO" }, category: "Purchasing", tags: "eu" } }, ["Contoso PO 100"]],
  ["scope and title search are ANDed", { scope: { category: "Purchasing" }, title: "review" }, ["Annual Contoso PO review"]],
  ["scope and statuses are ANDed", { scope: { category: "Purchasing" }, statuses: ["approved"] }, ["Contoso PO 200"]],
  ["a title search cannot widen the scope", { scope: { category: "Travel" }, title: "PO" }, []],
];

describe.each(scopedClients())("%s Profile Scope", (_name, client) => {
  it.each(SCOPE_CASES)("%s", async (_label, query, expected) => {
    expect(await titles(client, query)).toEqual(expected);
  });
});

const assignmentClients = (name: ScenarioName): [string, DataClient][] => [
  ["mockClient", createMockClient(name)],
  ["xrmClient", createXrmClient(createFakeXrm({ approvals: scenarioApprovals(name) }).xrm)],
];

const OWNER_1 = "00000000-0000-0000-0000-000000000e01";
const OWNER_2 = "00000000-0000-0000-0000-000000000e02";
const OTHER_APPROVER = "00000000-0000-0000-0000-0000000000b1";
const EVERY = ["Alpha mine pending", "Beta mine decided", "Gamma others pending", "Delta others completed"];

// Scenario currentUserIsApprover, newest first. Expected titles are written out by hand from its rows.
const ASSIGNMENT_CASES: [string, ApprovalQuery, string[]][] = [
  ["no filter", {}, EVERY],
  ["Assigned to me: any Approval Request of the current user", { assignedToMe: { pendingOnly: false } }, ["Alpha mine pending", "Beta mine decided"]],
  ["Assigned to me, pending only: the request must still be active", { assignedToMe: { pendingOnly: true } }, ["Alpha mine pending"]],
  ["Approver: any Approval Request of that user", { approverId: OTHER_APPROVER }, ["Beta mine decided", "Gamma others pending"]],
  ["Owner", { ownerId: OWNER_1 }, ["Alpha mine pending", "Gamma others pending"]],
  ["created from is inclusive", { createdFrom: "2025-05-02T00:00:00Z" }, ["Alpha mine pending", "Beta mine decided"]],
  ["created to is inclusive", { createdTo: "2025-05-02T00:00:00Z" }, ["Beta mine decided", "Gamma others pending", "Delta others completed"]],
  ["created to one second earlier excludes the boundary row", { createdTo: "2025-05-01T23:59:59Z" }, ["Gamma others pending", "Delta others completed"]],
  ["date range", { createdFrom: "2025-05-01T23:59:59Z", createdTo: "2025-05-02T00:00:00Z" }, ["Beta mine decided", "Gamma others pending"]],
  ["filters combine", { assignedToMe: { pendingOnly: false }, ownerId: OWNER_2 }, ["Beta mine decided"]],
  ["Approver and Assigned to me combine", { assignedToMe: { pendingOnly: false }, approverId: OTHER_APPROVER }, ["Beta mine decided"]],
];

describe.each(assignmentClients("currentUserIsApprover"))("%s assignment filtering (currentUserIsApprover)", (_name, client) => {
  it.each(ASSIGNMENT_CASES)("%s", async (_label, query, expected) => {
    expect(await titles(client, query)).toEqual(expected);
  });
});

describe.each(assignmentClients("currentUserNotApprover"))("%s Assigned to me (currentUserNotApprover)", (_name, client) => {
  it("finds nothing when the current user has no Approval Request", async () => {
    expect(await titles(client, { assignedToMe: { pendingOnly: false } })).toEqual([]);
    expect(await titles(client, {})).toHaveLength(2);
  });
});
