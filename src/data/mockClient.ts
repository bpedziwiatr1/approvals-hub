import { DataError, type ApprovalQuery, type DataClient, type StatusCounts } from "./dataClient";
import { scenarioApprovals, type ScenarioName } from "./scenarios";
import { mapApprovalListItem } from "./xrm/mappers";

export { isScenarioName, type ScenarioName } from "./scenarios";

/** In-memory DataClient for local development and UI tests; pages through continuation tokens like Dataverse. */
export function createMockClient(scenario: ScenarioName): DataClient {
  const all = scenarioApprovals(scenario).map((row) => mapApprovalListItem({ ...row }));
  const matching = (query: ApprovalQuery) =>
    all.filter(
      (i) =>
        (!query.title || i.title.toLowerCase().includes(query.title.toLowerCase())) &&
        (!query.statuses?.length || query.statuses.includes(i.status)),
    );

  return {
    async listApprovals(query, page) {
      const start = page.continuationToken ? Number(page.continuationToken) : 0;
      const items = matching(query);
      const end = start + page.size;
      return { items: items.slice(start, end), continuationToken: end < items.length ? String(end) : null };
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
