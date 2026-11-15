import { DataError, type ApprovalListItem, type ApprovalQuery, type DataClient, type StatusCounts } from "./dataClient";
import { buildApprovalListItem } from "./factories";

export type ScenarioName = "default";

function scenarioItems(name: ScenarioName): ApprovalListItem[] {
  switch (name) {
    case "default":
      return [
        buildApprovalListItem({ id: "00000000-0000-0000-0000-00000000a001", title: "Contoso purchase order 1001", status: "pending", createdOn: "2025-03-12T08:30:00Z" }),
        buildApprovalListItem({ id: "00000000-0000-0000-0000-00000000a002", title: "Contoso travel request 2002", status: "approved", createdOn: "2025-03-10T13:05:00Z" }),
        buildApprovalListItem({ id: "00000000-0000-0000-0000-00000000a003", title: "Contoso contract renewal 3003", status: "rejected", createdOn: "2025-03-08T16:45:00Z" }),
      ];
  }
}

export function isScenarioName(value: string | null): value is ScenarioName {
  return value === "default";
}

export function createMockClient(scenario: ScenarioName): DataClient {
  const all = scenarioItems(scenario);
  const matching = (query: ApprovalQuery) =>
    all.filter(
      (i) =>
        (!query.title || i.title.toLowerCase().includes(query.title.toLowerCase())) &&
        (!query.statuses?.length || query.statuses.includes(i.status)),
    );

  return {
    async listApprovals(query, page) {
      return { items: matching(query).slice(0, page.size), continuationToken: null };
    },
    async countByStatus(query) {
      const counts: StatusCounts = { pending: 0, approved: 0, rejected: 0, completed: 0, cancelled: 0, expired: 0, abandoned: 0 };
      for (const i of matching(query)) counts[i.status] += 1;
      return counts;
    },
    async getApprovalDetail(approvalId) {
      const found = all.find((i) => i.id === approvalId);
      if (!found) throw new DataError("notFound", `Approval ${approvalId} not found`);
      return { ...found, details: "" };
    },
    async *exportApprovals(query) {
      yield* matching(query);
    },
    async getCurrentUser() {
      return { id: "00000000-0000-0000-0000-0000000000f1", name: "Alex Contoso", languageId: 1033 };
    },
    async loadConfigValue() {
      return null;
    },
    async openRecord() {},
  };
}
